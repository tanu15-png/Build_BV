import { normalizeStudentEmail } from "./orderRules.js";

export function studentAccount({ email, name, register, password }, students) {
  const normalized = normalizeStudentEmail(email);

  if (!password?.trim()) {
    throw new Error("Enter your password.");
  }

  if (register) {
    if (!name?.trim()) {
      throw new Error("Enter your name to sign up.");
    }

    if (students[normalized]) {
      throw new Error("This email is already registered. Please log in.");
    }

    return {
      name: name.trim(),
      email: normalized,
      role: "student",
      password: password
    };
  }

  const user = students[normalized];

  if (!user) {
    throw new Error("This email is not registered. Sign up with your name first.");
  }

  if (user.password !== password) {
    throw new Error("Incorrect password. Please try again.");
  }

  return user;
}

export function canteenMember({ email, cafeId, secretCode }, cafes, codes) {
  const cafe = cafes.find((item) => item.id === cafeId);

  if (!cafe) {
    throw new Error("Select the canteen you represent.");
  }

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
    throw new Error("Enter a valid member email.");
  }

  if (secretCode !== codes[cafe.id]) {
    throw new Error("Incorrect access code for the selected canteen.");
  }

  return {
    role: "canteen",
    email: email.trim().toLowerCase(),
    name: cafe.name,
    cafeId: cafe.id
  };
}

export function revokeCanteenMember(members, actor, memberId, now = new Date()) {
  const target = members.find((member) => member.id === memberId);
  const authorized = actor?.role === "canteen" && members.some((member) =>
    member.cafeId === actor.cafeId && member.email === actor.email && member.status === "ACTIVE");
  if (!authorized || !target || target.cafeId !== actor.cafeId) {
    throw new Error("You can only remove members from your own canteen.");
  }
  return members.map((member) => member.id === memberId
    ? { ...member, status: "REVOKED", revokedAt: now.toISOString(), revokedBy: actor.email }
    : member);
}

export function canteenSessionActive(session, members, now = Date.now()) {
  return Boolean(session && new Date(session.expiresAt).getTime() > now && members.some((member) =>
    member.id === session.memberId && member.status === "ACTIVE" &&
    member.email === session.email && member.cafeId === session.cafeId));
}
