import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

export async function hashPassword(password) {
  if (!password || typeof password !== "string" || password.trim().length === 0) {
    throw new Error("Password must be a non-empty string");
  }

  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    return hash;
  } catch (error) {
    throw new Error("Error hashing password: " + error.message);
  }
}

export async function verifyPassword(password, hash) {
  if (!password || typeof password !== "string") {
    throw new Error("Password must be a non-empty string");
  }

  if (!hash || typeof hash !== "string") {
    throw new Error("Hash must be a valid string");
  }

  try {
    const isValid = await bcrypt.compare(password, hash);
    return isValid;
  } catch (error) {
    throw new Error("Error verifying password: " + error.message);
  }
}

export function getPasswordStrength(password) {
  if (!password) return 0;

  let strength = 0;

  if (password.length >= 8) strength++;
  if (password.length >= 12) strength++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
  if (/d/.test(password)) strength++;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength++;

  return Math.min(strength, 4);
}

export function getPasswordStrengthLabel(password) {
  const levels = ["Weak", "Fair", "Good", "Strong", "Very Strong"];
  const strength = getPasswordStrength(password);
  return levels[strength];
}
