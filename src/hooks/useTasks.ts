import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, apiRequest, errorMessage } from "@/lib/api";
import type { Task, TaskScope } from "@/types";

/** Keep shared lists fresh without asking people to reload the page. */
const POLL_MS = 2500;

type TaskChanges = Partial<Pick<Task, "title" | "completed" | "dueDate" | "progress" | "notes">>;

function localId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function scopeKeyOf(scope: TaskScope): string {
  return scope.kind === "team" ? `team:${scope.teamId}` : "personal";
}

function tasksUrl(scopeKey: string): string {
  if (!scopeKey.startsWith("team:")) return "/api/tasks?scope=personal";
  return `/api/tasks?scope=team&teamId=${encodeURIComponent(scopeKey.slice(5))}`;
}

function changesBetween(previous: Task, updated: Task): TaskChanges {
  const changes: TaskChanges = {};
  if (updated.title !== previous.title) changes.title = updated.title;
  if (updated.completed !== previous.completed) changes.completed = updated.completed;
  if (updated.dueDate !== previous.dueDate) changes.dueDate = updated.dueDate;
  if (updated.progress !== previous.progress) changes.progress = updated.progress;
  if (updated.notes !== previous.notes) changes.notes = updated.notes;
  return changes;
}

function taskFromPayload(payload: unknown): Task | null {
  if (!payload || typeof payload !== "object" || !("task" in payload)) return null;
  const task = (payload as { task: unknown }).task;
  return task && typeof task === "object" && "id" in task ? (task as Task) : null;
}

export function useTasks(enabled: boolean, scope: TaskScope = { kind: "personal" }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const tasksRef = useRef<Task[]>([]);
  const scopeRef = useRef(scope);
  const activeRef = useRef(false);
  const inFlightRef = useRef(0);
  scopeRef.current = scope;

  const scopeKey = scopeKeyOf(scope);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const fetchTasks = useCallback(async () => {
    if (!enabled || !activeRef.current || inFlightRef.current > 0) return;

    try {
      const data = await apiRequest<{ tasks: Task[] }>(tasksUrl(scopeKey));
      if (!activeRef.current) return;
      setTasks(data.tasks);
      setError("");
    } catch (err) {
      if (activeRef.current) setError(errorMessage(err));
    }
  }, [enabled, scopeKey]);

  useEffect(() => {
    activeRef.current = enabled;

    if (!enabled) {
      setTasks([]);
      tasksRef.current = [];
      setError("");
      setLoading(false);
      return () => {
        activeRef.current = false;
      };
    }

    let active = true;
    setTasks([]);
    tasksRef.current = [];
    setError("");
    setLoading(true);

    void fetchTasks().finally(() => {
      if (active) setLoading(false);
    });

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void fetchTasks();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void fetchTasks();
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      active = false;
      activeRef.current = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, fetchTasks]);

  const patchTask = useCallback(async (updated: Task, previous: Task) => {
    const changes = changesBetween(previous, updated);
    if (Object.keys(changes).length === 0) return;

    const url = `/api/tasks/${encodeURIComponent(updated.id)}`;
    inFlightRef.current += 1;

    try {
      const data = await apiRequest<{ task: Task }>(url, {
        method: "PATCH",
        body: JSON.stringify({ ...changes, baseVersion: previous.version }),
      });
      if (activeRef.current) {
        setTasks((current) => current.map((task) => (task.id === updated.id ? data.task : task)));
      }
      setError("");
    } catch (err) {
      // Someone else changed this task first: re-apply only our intended changes
      // on top of the latest version instead of overwriting their work.
      const latest = err instanceof ApiError && err.status === 409 ? taskFromPayload(err.payload) : null;
      if (latest) {
        try {
          const retry = await apiRequest<{ task: Task }>(url, {
            method: "PATCH",
            body: JSON.stringify({ ...changes, baseVersion: latest.version }),
          });
          if (activeRef.current) {
            setTasks((current) => current.map((task) => (task.id === updated.id ? retry.task : task)));
          }
          setError("");
          return;
        } catch (retryErr) {
          setError(errorMessage(retryErr));
        }
      } else {
        setError(errorMessage(err));
      }

      if (activeRef.current) {
        setTasks((current) => current.map((task) => (task.id === previous.id ? previous : task)));
      }
    } finally {
      inFlightRef.current -= 1;
    }
  }, []);

  const addTask = useCallback(async (title: string, dueDate: string | null) => {
    const currentScope = scopeRef.current;
    inFlightRef.current += 1;

    try {
      const data = await apiRequest<{ task: Task }>("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title,
          dueDate,
          progress: 0,
          notes: [],
          teamId: currentScope.kind === "team" ? currentScope.teamId : null,
        }),
      });
      if (activeRef.current) setTasks((current) => [...current, data.task]);
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      inFlightRef.current -= 1;
    }
  }, []);

  const toggleTask = useCallback(
    async (id: string) => {
      const previous = tasksRef.current.find((task) => task.id === id);
      if (!previous) return;

      const updated: Task = {
        ...previous,
        completed: !previous.completed,
        progress: previous.completed ? 0 : 100,
      };
      setTasks((current) => current.map((task) => (task.id === id ? updated : task)));
      await patchTask(updated, previous);
    },
    [patchTask],
  );

  const deleteTask = useCallback(async (id: string) => {
    const previous = tasksRef.current;
    setTasks((current) => current.filter((task) => task.id !== id));
    inFlightRef.current += 1;

    try {
      await apiRequest(`/api/tasks/${encodeURIComponent(id)}`, { method: "DELETE" });
      setError("");
    } catch (err) {
      if (activeRef.current) setTasks(previous);
      setError(errorMessage(err));
    } finally {
      inFlightRef.current -= 1;
    }
  }, []);

  const setDeadline = useCallback(
    async (id: string, dueDate: string | null) => {
      const previous = tasksRef.current.find((task) => task.id === id);
      if (!previous) return;

      const updated: Task = { ...previous, dueDate };
      setTasks((current) => current.map((task) => (task.id === id ? updated : task)));
      await patchTask(updated, previous);
    },
    [patchTask],
  );

  const setProgress = useCallback(
    async (id: string, value: number) => {
      const previous = tasksRef.current.find((task) => task.id === id);
      if (!previous) return;

      const updated: Task = { ...previous, progress: value };
      setTasks((current) => current.map((task) => (task.id === id ? updated : task)));
      await patchTask(updated, previous);
    },
    [patchTask],
  );

  const addNote = useCallback(
    async (id: string, text: string) => {
      const previous = tasksRef.current.find((task) => task.id === id);
      if (!previous || !text.trim()) return;

      const updated: Task = {
        ...previous,
        notes: [
          ...previous.notes,
          {
            id: localId(),
            text: text.trim(),
            createdAt: Date.now(),
          },
        ],
      };
      setTasks((current) => current.map((task) => (task.id === id ? updated : task)));
      await patchTask(updated, previous);
    },
    [patchTask],
  );

  const deleteNote = useCallback(
    async (id: string, noteId: string) => {
      const previous = tasksRef.current.find((task) => task.id === id);
      if (!previous) return;

      const updated: Task = {
        ...previous,
        notes: previous.notes.filter((note) => note.id !== noteId),
      };
      setTasks((current) => current.map((task) => (task.id === id ? updated : task)));
      await patchTask(updated, previous);
    },
    [patchTask],
  );

  return {
    tasks,
    loading,
    error,
    addTask,
    toggleTask,
    deleteTask,
    setDeadline,
    setProgress,
    addNote,
    deleteNote,
  };
}
