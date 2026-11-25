import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dbPath = process.env.DB_PATH || path.join(rootDir, "data", "todo.db");

mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT COLLATE NOCASE NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    host_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS team_members (
    team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('host', 'member')),
    joined_at INTEGER NOT NULL,
    PRIMARY KEY (team_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS team_invites (
    team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    email TEXT COLLATE NOCASE NOT NULL,
    invited_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (team_id, email)
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    due_date TEXT,
    progress INTEGER NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '[]',
    version INTEGER NOT NULL DEFAULT 1
  );
`);

// Add newer columns to databases created by earlier versions.
const taskColumns = db.prepare("PRAGMA table_info(tasks)").all();
if (!taskColumns.some((column) => column.name === "team_id")) {
  db.exec("ALTER TABLE tasks ADD COLUMN team_id TEXT");
}
if (!taskColumns.some((column) => column.name === "version")) {
  db.exec("ALTER TABLE tasks ADD COLUMN version INTEGER NOT NULL DEFAULT 1");
}

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_team_id ON tasks(team_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
  CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_team_invites_email ON team_invites(email);
`);

/** Turn pending invites into memberships when an invited email signs up. */
export function acceptInvitesForUser(userId, email) {
  const invites = db.prepare("SELECT team_id FROM team_invites WHERE email = ?").all(email);
  const addMember = db.prepare(
    "INSERT OR IGNORE INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)",
  );
  const removeInvite = db.prepare("DELETE FROM team_invites WHERE team_id = ? AND email = ?");

  for (const invite of invites) {
    addMember.run(invite.team_id, userId, Date.now());
    removeInvite.run(invite.team_id, email);
  }
}
