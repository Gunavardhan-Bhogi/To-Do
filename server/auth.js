import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "./db.js";

const COOKIE_NAME = "todo_session";
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const secureCookies = process.env.NODE_ENV === "production";

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function hashPassword(password) {
  return bcrypt.hashSync(password, 12);
}

export function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

export function createSession(res, userId) {
  const token = randomBytes(32).toString("hex");

  db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(
    hashToken(token),
    userId,
    Date.now() + SESSION_MS,
  );

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies,
    maxAge: SESSION_MS,
    path: "/",
  });
}

export function clearSession(req, res) {
  const token = req.cookies?.[COOKIE_NAME];
  if (token) {
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
  }

  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies,
    path: "/",
  });
}

export function getCurrentUser(req) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;

  const row = db
    .prepare(
      `SELECT users.id, users.email, users.created_at
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = ? AND sessions.expires_at > ?`,
    )
    .get(hashToken(token), Date.now());

  if (!row) return null;

  return { id: row.id, email: row.email, createdAt: row.created_at };
}

export function requireAuth(req, res, next) {
  const user = getCurrentUser(req);
  if (!user) return res.status(401).json({ error: "Please sign in to continue." });

  req.user = user;
  next();
}
