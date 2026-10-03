/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from "react";
import { cafes } from "../data/mockData";
import { canteenAccessCodes } from "../data/canteenAccess";
import { studentAccount, canteenMember } from "../utils/authRules";
import { readStoredValue } from "../hooks/usePersistentState";

const AuthContext = createContext();
export function AuthProvider({ children }) {
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
    (savedUser.role === "canteen" && cafes.some((cafe) => cafe.id === savedUser.cafeId)) ||
    savedUser.role === "admin"
  ) ? savedUser : null;

  const login = ({ role, email, name, register, cafeId, secretCode, password }) => {
    let nextUser;
    if (role === "student") {
      const students = readStoredValue("campusEatsStudentsV2", {});
      nextUser = studentAccount({ email, name, register, password },students);
      if (register) {students[nextUser.email] = nextUser;
      localStorage.setItem(
      "campusEatsStudentsV2",JSON.stringify(students));

     // Do not create a login session during signup
     return nextUser;
    }setUser(nextUser);
    return nextUser;
    } else if (role === "canteen") {
      nextUser = canteenMember({ email, cafeId, secretCode }, cafes, canteenAccessCodes);
    } else if (role === "admin") {
      if (email.trim().toLowerCase() !== "admin@campuseats.com" || password !== "admin123") {
        throw new Error("Incorrect admin email or password.");
      }
      nextUser = { role, email: "admin@campuseats.com", name: "CampusEats Admin" };
    } else {
      throw new Error("Choose a valid account role.");
    }
    setUser(nextUser);
    return nextUser;
  };

  return <AuthContext.Provider value={{ user, login, logout: () => setUser(null) }}>{children}</AuthContext.Provider>;
}
export function useAuth() { return useContext(AuthContext); }
