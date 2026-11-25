import { existsSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import express from "express";
import {
  clearSession,
  createSession,
  getCurrentUser,
  hashPassword,
  requireAuth,
  verifyPassword,
} from "./auth.js";
import { acceptInvitesForUser, db } from "./db.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));
app.use(cookieParser());

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isISODate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeNotes(value) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item) => item && typeof item === "object" && typeof item.text === "string" && item.text.trim())
    .slice(-200)
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : randomUUID(),
      text: item.text.trim().slice(0, 300),
      createdAt: Number.isFinite(item.createdAt) ? item.createdAt : Date.now(),
    }));
}

function taskFieldsFromBody(body) {
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) return { error: "Task title is required." };
  if (title.length > 300) return { error: "Task title must be 300 characters or fewer." };

  return {
    value: {
      title,
      completed: Boolean(body.completed) ? 1 : 0,
      dueDate: isISODate(body.dueDate) ? body.dueDate : null,
      progress: Number.isFinite(body.progress)
        ? Math.max(0, Math.min(100, Math.round(body.progress)))
        : 0,
      notes: JSON.stringify(normalizeNotes(body.notes)),
    },
  };
}

function serializeTask(row) {
  let notes = [];
  try {
    notes = JSON.parse(row.notes);
  } catch {
    notes = [];
  }

  return {
    id: row.id,
    title: row.title,
    completed: Boolean(row.completed),
    createdAt: row.created_at,
    dueDate: row.due_date ?? null,
    progress: row.progress,
    notes: Array.isArray(notes) ? notes : [],
    teamId: row.team_id ?? null,
    creatorEmail: row.creator_email ?? null,
    version: row.version ?? 1,
  };
}

const TASK_SELECT = `SELECT tasks.*, users.email AS creator_email
                     FROM tasks JOIN users ON users.id = tasks.user_id`;

/* ---------- Team helpers ---------- */
function getTeam(id) {
  return db.prepare("SELECT * FROM teams WHERE id = ?").get(id) ?? null;
}

function getMembership(teamId, userId) {
  return db
    .prepare("SELECT role FROM team_members WHERE team_id = ? AND user_id = ?")
    .get(teamId, userId) ?? null;
}

function serializeTeam(team, userId) {
  const members = db
    .prepare(
      `SELECT users.id, users.email, team_members.role, team_members.joined_at
       FROM team_members
       JOIN users ON users.id = team_members.user_id
       WHERE team_members.team_id = ?
       ORDER BY CASE team_members.role WHEN 'host' THEN 0 ELSE 1 END, team_members.joined_at ASC`,
    )
    .all(team.id)
    .map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      joinedAt: row.joined_at,
    }));

  const role = getMembership(team.id, userId)?.role ?? "member";
  const invites =
    role === "host"
      ? db
          .prepare("SELECT email, created_at FROM team_invites WHERE team_id = ? ORDER BY created_at ASC")
          .all(team.id)
          .map((row) => ({ email: row.email, createdAt: row.created_at }))
      : [];

  const taskCount = db.prepare("SELECT COUNT(*) AS n FROM tasks WHERE team_id = ?").get(team.id).n;

  return {
    id: team.id,
    name: team.name,
    hostId: team.host_id,
    createdAt: team.created_at,
    role,
    members,
    invites,
    taskCount,
  };
}

/* ---------- Auth ---------- */
app.post("/api/auth/signup", (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;

  if (!EMAIL_RE.test(email) || email.length > 254) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: "Password must be 8–128 characters." });
  }
  if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(email)) {
    return res.status(409).json({ error: "An account with that email already exists." });
  }

  const createdAt = new Date().toISOString();
  const result = db
    .prepare("INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)")
    .run(email, hashPassword(password), createdAt);
  const userId = Number(result.lastInsertRowid);

  acceptInvitesForUser(userId, email);
  createSession(res, userId);

  res.status(201).json({ user: { id: userId, email, createdAt } });
});

app.post("/api/auth/login", (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;

  if (typeof password !== "string") {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const row = db
    .prepare("SELECT id, email, password_hash, created_at FROM users WHERE email = ?")
    .get(email);

  if (!row || !verifyPassword(password, row.password_hash)) {
    return res.status(401).json({ error: "Incorrect email or password." });
  }

  createSession(res, row.id);
  res.json({
    user: { id: row.id, email: row.email, createdAt: row.created_at },
  });
});

app.post("/api/auth/logout", (req, res) => {
  clearSession(req, res);
  res.json({ ok: true });
});

app.get("/api/auth/me", (req, res) => {
  const user = getCurrentUser(req);
  if (!user) return res.status(401).json({ error: "Not signed in." });
  res.json({ user });
});

/* ---------- Teams ---------- */
app.get("/api/teams", requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT teams.* FROM teams
       JOIN team_members ON team_members.team_id = teams.id
       WHERE team_members.user_id = ?
       ORDER BY teams.created_at ASC`,
    )
    .all(req.user.id);
  res.json({ teams: rows.map((team) => serializeTeam(team, req.user.id)) });
});

app.post("/api/teams", requireAuth, (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name) return res.status(400).json({ error: "Team name is required." });
  if (name.length > 80) return res.status(400).json({ error: "Team name must be 80 characters or fewer." });

  const id = randomUUID();
  const now = Date.now();
  const create = db.transaction(() => {
    db.prepare("INSERT INTO teams (id, name, host_id, created_at) VALUES (?, ?, ?, ?)").run(
      id,
      name,
      req.user.id,
      now,
    );
    db.prepare(
      "INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, 'host', ?)",
    ).run(id, req.user.id, now);
  });
  create();

  const team = getTeam(id);
  res.status(201).json({ team: serializeTeam(team, req.user.id) });
});

app.post("/api/teams/:id/members", requireAuth, (req, res) => {
  const team = getTeam(req.params.id);
  if (!team) return res.status(404).json({ error: "Team not found." });
  if (!getMembership(team.id, req.user.id)) return res.status(404).json({ error: "Team not found." });
  if (team.host_id !== req.user.id) {
    return res.status(403).json({ error: "Only the team host can add members." });
  }

  const email = normalizeEmail(req.body?.email);
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }
  if (email === req.user.email) {
    return res.status(400).json({ error: "You're already the host of this team." });
  }

  const existingUser = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existingUser && getMembership(team.id, existingUser.id)) {
    return res.status(409).json({ error: "That person is already in the team." });
  }
  if (db.prepare("SELECT 1 FROM team_invites WHERE team_id = ? AND email = ?").get(team.id, email)) {
    return res.status(409).json({ error: "An invite is already pending for that email." });
  }

  if (existingUser) {
    db.prepare(
      "INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)",
    ).run(team.id, existingUser.id, Date.now());
  } else {
    db.prepare(
      "INSERT INTO team_invites (team_id, email, invited_by, created_at) VALUES (?, ?, ?, ?)",
    ).run(team.id, email, req.user.id, Date.now());
  }

  res.status(201).json({ team: serializeTeam(team, req.user.id), added: Boolean(existingUser) });
});

app.delete("/api/teams/:id/members/:userId", requireAuth, (req, res) => {
  const team = getTeam(req.params.id);
  if (!team) return res.status(404).json({ error: "Team not found." });
  if (!getMembership(team.id, req.user.id)) return res.status(404).json({ error: "Team not found." });
  if (team.host_id !== req.user.id) {
    return res.status(403).json({ error: "Only the team host can remove members." });
  }

  const targetId = Number(req.params.userId);
  if (!Number.isInteger(targetId)) return res.status(400).json({ error: "Invalid member." });
  if (targetId === team.host_id) return res.status(400).json({ error: "The host cannot be removed." });

  const result = db
    .prepare("DELETE FROM team_members WHERE team_id = ? AND user_id = ?")
    .run(team.id, targetId);
  if (result.changes === 0) return res.status(404).json({ error: "Member not found." });

  res.json({ team: serializeTeam(team, req.user.id) });
});

app.delete("/api/teams/:id", requireAuth, (req, res) => {
  const team = getTeam(req.params.id);
  if (!team) return res.status(404).json({ error: "Team not found." });
  if (team.host_id !== req.user.id) {
    return res.status(403).json({ error: "Only the team host can delete the team." });
  }

  const remove = db.transaction(() => {
    db.prepare("DELETE FROM tasks WHERE team_id = ?").run(team.id);
    db.prepare("DELETE FROM teams WHERE id = ?").run(team.id);
  });
  remove();

  res.json({ ok: true });
});

/* ---------- Tasks (personal tasks are private; team tasks are visible to members) ---------- */
app.get("/api/tasks", requireAuth, (req, res) => {
  const scope = req.query.scope === "team" ? "team" : "personal";

  if (scope === "personal") {
    const rows = db
      .prepare(`${TASK_SELECT} WHERE tasks.user_id = ? AND tasks.team_id IS NULL ORDER BY tasks.created_at ASC`)
      .all(req.user.id);
    return res.json({ tasks: rows.map(serializeTask) });
  }

  const teamId = typeof req.query.teamId === "string" ? req.query.teamId : "";
  if (!teamId) return res.status(400).json({ error: "A team is required." });
  if (!getTeam(teamId) || !getMembership(teamId, req.user.id)) {
    return res.status(404).json({ error: "Team not found." });
  }

  const rows = db
    .prepare(`${TASK_SELECT} WHERE tasks.team_id = ? ORDER BY tasks.created_at ASC`)
    .all(teamId);
  res.json({ tasks: rows.map(serializeTask) });
});

app.post("/api/tasks", requireAuth, (req, res) => {
  const parsed = taskFieldsFromBody(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  const teamId = typeof req.body?.teamId === "string" && req.body.teamId ? req.body.teamId : null;
  if (teamId && (!getTeam(teamId) || !getMembership(teamId, req.user.id))) {
    return res.status(404).json({ error: "Team not found." });
  }

  const id = randomUUID();
  const fields = parsed.value;

  db.prepare(
    `INSERT INTO tasks (id, user_id, team_id, title, completed, created_at, due_date, progress, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    req.user.id,
    teamId,
    fields.title,
    fields.completed,
    Date.now(),
    fields.dueDate,
    fields.progress,
    fields.notes,
  );

  const row = db.prepare(`${TASK_SELECT} WHERE tasks.id = ?`).get(id);
  res.status(201).json({ task: serializeTask(row) });
});

function getAccessibleTask(taskId, userId) {
  const row = db.prepare(`${TASK_SELECT} WHERE tasks.id = ?`).get(taskId);
  if (!row) return null;
  if (!row.team_id) return row.user_id === userId ? row : null;
  return getMembership(row.team_id, userId) ? row : null;
}

// Partial updates: only the fields actually supplied are changed, so one person's
// edit cannot overwrite another person's unrelated changes to the same task.
app.patch("/api/tasks/:id", requireAuth, (req, res) => {
  const existing = getAccessibleTask(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: "Task not found." });

  const body = req.body ?? {};
  const sets = [];
  const values = [];

  if ("title" in body) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return res.status(400).json({ error: "Task title is required." });
    if (title.length > 300) {
      return res.status(400).json({ error: "Task title must be 300 characters or fewer." });
    }
    sets.push("title = ?");
    values.push(title);
  }
  if ("completed" in body) {
    sets.push("completed = ?");
    values.push(Boolean(body.completed) ? 1 : 0);
  }
  if ("dueDate" in body) {
    if (body.dueDate !== null && !isISODate(body.dueDate)) {
      return res.status(400).json({ error: "Enter a valid deadline." });
    }
    sets.push("due_date = ?");
    values.push(body.dueDate ?? null);
  }
  if ("progress" in body) {
    if (!Number.isFinite(body.progress)) {
      return res.status(400).json({ error: "Progress must be a number." });
    }
    sets.push("progress = ?");
    values.push(Math.max(0, Math.min(100, Math.round(body.progress))));
  }
  if ("notes" in body) {
    sets.push("notes = ?");
    values.push(JSON.stringify(normalizeNotes(body.notes)));
  }

  if (sets.length === 0) return res.status(400).json({ error: "No changes supplied." });

  if ("baseVersion" in body) {
    if (!Number.isInteger(body.baseVersion)) {
      return res.status(400).json({ error: "Invalid task version." });
    }
    if (body.baseVersion !== existing.version) {
      return res.status(409).json({
        error: "This task was just updated by someone else.",
        task: serializeTask(existing),
      });
    }
  }

  sets.push("version = version + 1");
  values.push(req.params.id);
  db.prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`).run(...values);

  const row = db.prepare(`${TASK_SELECT} WHERE tasks.id = ?`).get(req.params.id);
  res.json({ task: serializeTask(row) });
});

app.delete("/api/tasks/:id", requireAuth, (req, res) => {
  const existing = getAccessibleTask(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: "Task not found." });

  db.prepare("DELETE FROM tasks WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

/* ---------- Frontend + errors ---------- */
const distDir = path.join(rootDir, "dist");
if (existsSync(distDir)) {
  app.use(express.static(distDir));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(distDir, "index.html"));
  });
}

app.use("/api", (req, res) => {
  res.status(404).json({ error: "Endpoint not found." });
});

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ error: "Invalid JSON body." });
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => {
  console.log(`To-Do API listening on http://localhost:${port}`);
});
