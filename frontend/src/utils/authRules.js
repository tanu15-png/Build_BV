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