import { cafes } from "./mockData.js";

// Testing only. Replace this lookup with backend-managed, hashed codes.
export const canteenAccessCodes = Object.fromEntries(
  cafes.map((cafe) => [cafe.id, cafe.name])
);
