import { Check, ListTodo, UsersRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { Theme } from "@/hooks/useTheme";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { TaskScope, Team, User } from "@/types";

interface SidebarProps {
  user: User;
  teams: Team[];
  scope: TaskScope;
  personalCount: number;
  loadingTeams: boolean;
  onSelect: (scope: TaskScope) => void;
  onCreateTeam: (name: string) => Promise<Team>;
  onLogout: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}

export function Sidebar({
  user,
  teams,
  scope,
  personalCount,
  loadingTeams,
  onSelect,
  onCreateTeam,
  onLogout,
  theme,
  onToggleTheme,
}: SidebarProps) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;

    setBusy(true);
    setError("");
    try {
      await onCreateTeam(name);
      setName("");
      setCreating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the team.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__logo" aria-hidden="true">
          <Check size={16} strokeWidth={1.5} />
        </div>
        <div className="sidebar__brand-text">
          <strong>Huddle</strong>
          <span>Personal &amp; team tasks</span>
        </div>
      </div>

      <nav className="sidebar__nav" aria-label="Task spaces">
        <p className="sidebar__heading">Your spaces</p>

        <button
          type="button"
          className={scope.kind === "personal" ? "nav-item active" : "nav-item"}
          aria-current={scope.kind === "personal" ? "page" : undefined}
          onClick={() => onSelect({ kind: "personal" })}
        >
          <ListTodo size={16} strokeWidth={1.5} aria-hidden="true" />
          <span className="nav-item__label">My tasks</span>
          <span className="nav-item__count">{personalCount}</span>
        </button>

        <div className="sidebar__heading-row">
          <p className="sidebar__heading">Teams</p>
          <button
            type="button"
            className="sidebar__new"
            aria-expanded={creating}
            onClick={() => {
              setCreating((open) => !open);
              setError("");
            }}
          >
            {creating ? "Cancel" : "New team"}
          </button>
        </div>

        {creating && (
          <form className="team-create" onSubmit={handleCreate}>
            <label className="sr-only" htmlFor="new-team-name">
              Team name
            </label>
            <input
              id="new-team-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Team name"
              maxLength={80}
              autoFocus
            />
            <button type="submit" disabled={busy || !name.trim()}>
              {busy ? "Please wait…" : "Create"}
            </button>
            {error && <p className="team-create__error">{error}</p>}
          </form>
        )}

        {teams.map((team) => (
          <button
            key={team.id}
            type="button"
            className={scope.kind === "team" && scope.teamId === team.id ? "nav-item active" : "nav-item"}
            aria-current={scope.kind === "team" && scope.teamId === team.id ? "page" : undefined}
            onClick={() => onSelect({ kind: "team", teamId: team.id })}
            title={team.name}
          >
            <UsersRound size={16} strokeWidth={1.5} aria-hidden="true" />
            <span className="nav-item__label">{team.name}</span>
            <span className="nav-item__count">{team.taskCount}</span>
          </button>
        ))}

        {!loadingTeams && teams.length === 0 && (
          <p className="sidebar__hint">No teams yet. Create one to share tasks.</p>
        )}
      </nav>

      <div className="sidebar__account">
        <span title={user.email}>{user.email}</span>
        <div className="sidebar__account-actions">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <button type="button" className="sidebar__logout" onClick={onLogout}>
            Log out
          </button>
        </div>
      </div>
    </aside>
  );
}
