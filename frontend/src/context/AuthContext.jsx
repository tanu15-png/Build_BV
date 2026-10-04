/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react";
import { cafes } from "../data/mockData";
import { canteenAccessCodes } from "../data/canteenAccess";
import { studentAccount, canteenMember, revokeCanteenMember, canteenSessionActive } from "../utils/authRules";
import { readStoredValue, usePersistentState } from "../hooks/usePersistentState";

const AuthContext = createContext();
const emptyRecords = [];
const memberKey = "campusEatsMembersV2";
const sessionKey = "campusEatsStaffSessionsV2";
export function AuthProvider({ children }) {
  const [members, setMembers] = usePersistentState(memberKey, emptyRecords);
  const [staffSessions, setStaffSessions] = usePersistentState(sessionKey, emptyRecords);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const [savedUser, setSavedUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("campusEatsSessionV2")); }
    catch { return null; }
  });
  const setUser = (next) => {
    sessionStorage.setItem("campusEatsSessionV2", JSON.stringify(next));
    setSavedUser(next);
  };
  const user = savedUser && (
    (savedUser.role === "student" && /^[^@\s]+@banasthali\.in$/.test(savedUser.email)) ||
    (savedUser.role === "canteen" && canteenSessionActive(
      staffSessions.find((session) => session.id === savedUser.sessionId), members, now)) ||
    savedUser.role === "admin"
  ) ? savedUser : null;

  const login = ({ role, email, name, register, cafeId, secretCode, password }) => {
    let nextUser;
    if (role === "student") {
      const students = readStoredValue("campusEatsStudentsV2", {});
      const account = studentAccount({ email, name, register, password }, students);
      if (register) {
        students[account.email] = account;
        localStorage.setItem("campusEatsStudentsV2", JSON.stringify(students));
        return { role: account.role, email: account.email, name: account.name };
      }
      nextUser = { role: account.role, email: account.email, name: account.name };
    } else if (role === "canteen") {
      nextUser = canteenMember({ email, cafeId, secretCode }, cafes, canteenAccessCodes);
      const at = new Date();
      let membership;
      setMembers((current) => {
        const existing = current.find((member) => member.email === nextUser.email && member.cafeId === cafeId);
        if (existing?.status === "REVOKED") throw new Error("Your access to this canteen has been removed. Contact the canteen administrator.");
        membership = existing || { id: crypto.randomUUID(), email: nextUser.email, cafeId, status: "ACTIVE", joinedAt: at.toISOString() };
        return existing ? current : [...current, membership];
      });
      const session = { id: crypto.randomUUID(), memberId: membership.id, email: nextUser.email, cafeId,
        createdAt: at.toISOString(), expiresAt: new Date(at.getTime() + 12 * 60 * 60 * 1000).toISOString() };
      setStaffSessions((current) => [...current.filter((item) => item.id !== savedUser?.sessionId && canteenSessionActive(item, readStoredValue(memberKey, emptyRecords), at.getTime())), session]);
      nextUser = { ...nextUser, sessionId: session.id };
    } else if (role === "admin") {
      if (email.trim().toLowerCase() !== "admin@campuseats.com" || password !== "admin123") {
        throw new Error("Incorrect admin email or password.");
      }
      nextUser = { role, email: "admin@campuseats.com", name: "SpoonAte Admin" };
    } else {
      throw new Error("Choose a valid account role.");
    }
    if (role !== "canteen" && savedUser?.sessionId) {
      setStaffSessions((current) => current.filter((session) => session.id !== savedUser.sessionId));
    }
    setNow(Date.now());
    setUser(nextUser);
    return nextUser;
  };
  const removeMember = (memberId) => {
    const currentMembers = readStoredValue(memberKey, emptyRecords);
    const session = readStoredValue(sessionKey, emptyRecords).find((item) => item.id === savedUser?.sessionId);
    if (!canteenSessionActive(session, currentMembers)) throw new Error("Sign in again to manage canteen members.");
    setMembers((current) => revokeCanteenMember(current, user, memberId));
    setStaffSessions((current) => current.filter((item) => item.memberId !== memberId));
  };
  const logout = () => {
    setStaffSessions((current) => current.filter((session) => session.id !== savedUser?.sessionId));
    setUser(null);
  };
  const activeSessions = staffSessions.filter((session) => canteenSessionActive(session, members, now));
  const canteenMembers = user?.role === "canteen" ? members.filter((member) => member.cafeId === user.cafeId).map((member) => ({
    ...member, sessionCount: activeSessions.filter((session) => session.memberId === member.id).length,
  })) : [];
  return <AuthContext.Provider value={{ user, login, logout, canteenMembers, removeMember }}>{children}</AuthContext.Provider>;
}
export function useAuth() { return useContext(AuthContext); }
