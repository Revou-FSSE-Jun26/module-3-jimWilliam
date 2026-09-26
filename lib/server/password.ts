import { pbkdf2, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/**
 * Password hashing in Werkzeug's format, so this app and the Module 2 Flask API can share one
 * `users` table: a hash written here verifies in Flask's `check_password_hash`, and one written
 * by Flask's `generate_password_hash` verifies here.
 *
 *   pbkdf2:sha256:600000$<salt>$<hex>   what we write (Werkzeug's own default)
 *   scrypt:32768:8:1$<salt>$<hex>       also read, for hashes Werkzeug 2.3+ wrote
 *
 * Nothing here is reversible and the comparison is constant-time, so a leaked database does not
 * hand over the passwords.
 *
 * No "server-only" marker: scripts/db-setup.mjs hashes the seeded passwords with this too. It is
 * still server code - nothing imports it from a component.
 */

const ITERATIONS = 600_000;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;

const derivePbkdf2 = (password: string, salt: string, iterations: number, digest: string) =>
  new Promise<Buffer>((resolve, reject) =>
    pbkdf2(password, salt, iterations, KEY_LENGTH, digest, (err, key) => (err ? reject(err) : resolve(key)))
  );

const deriveScrypt = (password: string, salt: string, n: number, r: number, p: number) =>
  new Promise<Buffer>((resolve, reject) =>
    // Werkzeug asks for a 64-byte key; N=32768 needs more than Node's default 32 MB budget
    scrypt(password, salt, 64, { N: n, r, p, maxmem: 256 * 1024 * 1024 }, (err, key) => (err ? reject(err) : resolve(key)))
  );

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH).toString("hex").slice(0, SALT_LENGTH);
  const key = await derivePbkdf2(password, salt, ITERATIONS, "sha256");
  return `pbkdf2:sha256:${ITERATIONS}$${salt}$${key.toString("hex")}`;
}

/** Constant-time comparison; false for any hash shape we do not recognise. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [method, salt, expected] = stored.split("$");
  if (!method || !salt || !expected) return false;

  const parts = method.split(":");
  let key: Buffer;
  try {
    if (parts[0] === "pbkdf2") {
      const [, digest = "sha256", iterations = "260000"] = parts;
      key = await derivePbkdf2(password, salt, Number(iterations), digest);
    } else if (parts[0] === "scrypt") {
      const [, n = "32768", r = "8", p = "1"] = parts;
      key = await deriveScrypt(password, salt, Number(n), Number(r), Number(p));
    } else {
      return false;
    }
  } catch {
    return false;
  }

  const a = Buffer.from(expected, "hex");
  return a.length === key.length && timingSafeEqual(a, key);
}
