export interface TaskNote {
  id: string;
  text: string;
  createdAt: number;
}

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
  /** Local calendar date in YYYY-MM-DD form, or null when no deadline is set. */
  dueDate: string | null;
  /** Manual completion estimate from 0 to 100. */
  progress: number;
  notes: TaskNote[];
  /** null for a private task, otherwise the team that shares this task. */
  teamId: string | null;
  /** Email of the person who created the task (useful on shared team tasks). */
  creatorEmail: string | null;
  /** Incremented on every change; used to detect simultaneous edits. */
  version: number;
}

export type TaskFilter = "all" | "pending" | "overdue" | "completed";

/** Which list is currently shown: the private one or a team's shared one. */
export type TaskScope = { kind: "personal" } | { kind: "team"; teamId: string };

export interface User {
  id: number;
  email: string;
  createdAt: string;
}

export interface TeamMember {
  id: number;
  email: string;
  role: "host" | "member";
  joinedAt: number;
}

export interface TeamInvite {
  email: string;
  createdAt: number;
}

export interface Team {
  id: string;
  name: string;
  hostId: number;
  createdAt: number;
  role: "host" | "member";
  members: TeamMember[];
  /** Pending invitations — only returned to the host. */
  invites: TeamInvite[];
  taskCount: number;
}
