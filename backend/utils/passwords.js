import bcrypt from "bcrypt";
import { config } from "../config.js";

export const MIN_PASSWORD_LENGTH = 8;

// The most common leaked passwords that pass the length check. Compared case-insensitively.
const COMMON_PASSWORDS = new Set([
  "12345678", "123456789", "1234567890", "12345678910", "123123123", "11111111", "00000000", "88888888",
  "87654321", "11223344", "12341234", "147258369", "123qweasd", "1q2w3e4r", "1q2w3e4r5t", "1qaz2wsx",
  "qwertyui", "qwertyuiop", "qwerty123", "qwerty12", "asdfghjk", "asdfghjkl", "zxcvbnm1", "password",
  "password1", "password12", "password123", "passw0rd", "p@ssw0rd", "iloveyou", "iloveyou1", "sunshine",
  "princess", "football", "baseball", "superman", "starwars", "whatever", "trustno1", "letmein1",
  "welcome1", "welcome123", "admin123", "administrator", "abc12345", "abcd1234", "aa123456", "q1w2e3r4",
  "computer", "michelle", "jennifer", "corvette", "mercedes", "liverpool", "chelsea1", "arsenal1",
  "dragon12", "monkey12", "shadow12", "master12", "killer12", "zaq12wsx", "1234qwer", "qazwsxedc",
  "pa55word", "changeme", "default1", "secret12", "test1234", "testtest", "internet", "samsung1",
]);

// Returns an i18n error code, or null when the password is acceptable.
export const checkPassword = (password) => {
  if (password.length < MIN_PASSWORD_LENGTH) return "auth.passwordTooShort";
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return "auth.passwordTooCommon";
  return null;
};

export const hashPassword = (password) => bcrypt.hash(password, config.bcryptRounds);

let dummyHash;

// A missing user or a Google-only account (no hash) still costs one bcrypt compare, so the response time doesn't
// tell whether the email is registered.
export const verifyPassword = async (password, hash) => {
  if (!hash) {
    dummyHash ??= await bcrypt.hash("timing-equalizer", config.bcryptRounds);
    await bcrypt.compare(password, dummyHash);
    return false;
  }
  return bcrypt.compare(password, hash);
};
