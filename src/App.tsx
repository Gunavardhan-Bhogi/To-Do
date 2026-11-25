import { useEffect, useState } from "react";
import { AddTaskForm } from "@/components/AddTaskForm";
import { AuthScreen } from "@/components/AuthScreen";
import { FilterTabs } from "@/components/FilterTabs";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { TaskList } from "@/components/TaskList";
import { TeamPanel } from "@/components/TeamPanel";
import { useAuth } from "@/hooks/useAuth";
import { useTasks } from "@/hooks/useTasks";
import { useTeams } from "@/hooks/useTeams";
import { useTheme } from "@/hooks/useTheme";
import type { TaskFilter, TaskScope, Team } from "@/types";
import { isOverdue } from "@/utils/dates";

export default function App() {
  const { user, loading: authLoading, signup, login, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [scope, setScope] = useState<TaskScope>({ kind: "personal" });
  const [filter, setFilter] = useState<TaskFilter>("all");

  const authenticated = Boolean(user);
  const personal = useTasks(authenticated, { kind: "personal" });
  const team = useTasks(authenticated && scope.kind === "team", scope);
  const active = scope.kind === "team" ? team : personal;

  const {
    teams,
    loading: teamsLoading,
    error: teamsError,
    refresh: refreshTeams,
    createTeam,
    addMember,
    removeMember,
    deleteTeam,
  } = useTeams(authenticated);

  const activeTeam = scope.kind === "team" ? teams.find((item) => item.id === scope.teamId) : undefined;
  const scopeKey = scope.kind === "team" ? scope.teamId : "personal";

  useEffect(() => {
    setFilter("all");
  }, [scopeKey]);

  useEffect(() => {
    if (scope.kind === "team" && !teamsLoading && !teams.some((item) => item.id === scope.teamId)) {
      setScope({ kind: "personal" });
    }
  }, [scope, teams, teamsLoading]);

  if (authLoading) {
    return <main className="app loading-state">Loading your tasks…</main>;
  }

  if (!user) {
    return (
      <AuthScreen
        onSignup={signup}
        onLogin={login}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  }

  const {
    tasks,
    loading: tasksLoading,
    error,
    addTask,
    toggleTask,
    deleteTask,
    setDeadline,
    setProgress,
    addNote,
    deleteNote,
  } = active;

  const completed = tasks.filter((task) => task.completed).length;
  const overdue = tasks.filter((task) => isOverdue(task.dueDate, task.completed)).length;
  const remaining = tasks.length - completed;

  const counts: Record<TaskFilter, number> = {
    all: tasks.length,
    pending: remaining,
    overdue,
    completed,
  };

  const visibleTasks = tasks.filter((task) => {
    if (filter === "pending") return !task.completed;
    if (filter === "overdue") return isOverdue(task.dueDate, task.completed);
    if (filter === "completed") return task.completed;
    return true;
  });

  const countLabel =
    tasks.length === 0 ? "No tasks yet" : remaining === 1 ? "1 task left" : `${remaining} tasks left`;

  const showingLabel =
    filter === "all" ? `${tasks.length} total` : `${visibleTasks.length} of ${tasks.length} shown`;

  async function handleLogout() {
    await logout();
    setScope({ kind: "personal" });
    setFilter("all");
  }

  async function handleCreateTeam(name: string): Promise<Team> {
    const created = await createTeam(name);
    setScope({ kind: "team", teamId: created.id });
    return created;
  }

  async function handleDeleteTeam() {
    if (!activeTeam) return;
    await deleteTeam(activeTeam.id);
    setScope({ kind: "personal" });
  }

  async function handleAddTask(title: string, dueDate: string | null) {
    await addTask(title, dueDate);
    void refreshTeams();
  }

  async function handleDeleteTask(id: string) {
    await deleteTask(id);
    void refreshTeams();
  }

  return (
    <div className="shell">
      <Sidebar
        user={user}
        teams={teams}
        scope={scope}
        personalCount={personal.tasks.length}
        loadingTeams={teamsLoading}
        onSelect={setScope}
        onCreateTeam={handleCreateTeam}
        onLogout={() => void handleLogout()}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <main className="app workspace">
        <Header
          title={scope.kind === "team" ? activeTeam?.name ?? "Team" : "My tasks"}
          eyebrow={scope.kind === "team" ? "Team space" : "Personal space"}
          subtitle={scope.kind === "team" ? "Shared with your team" : undefined}
        />

        {(error || teamsError) && (
          <p className="api-error" role="alert">
            {error || teamsError}
          </p>
        )}

        <AddTaskForm onAdd={handleAddTask} />

        <FilterTabs active={filter} counts={counts} onChange={setFilter} />

        <div className="toolbar">
          <span className="count" aria-live="polite">
            {countLabel}
          </span>
          <span className="count count--muted">
            {tasksLoading ? "Loading…" : showingLabel}
          </span>
        </div>

        <TaskList
          tasks={visibleTasks}
          total={tasks.length}
          filter={filter}
          onToggle={toggleTask}
          onDelete={handleDeleteTask}
          onSetDeadline={setDeadline}
          onSetProgress={setProgress}
          onAddNote={addNote}
          onDeleteNote={deleteNote}
        />

        {scope.kind === "team" && activeTeam && (
          <TeamPanel
            key={activeTeam.id}
            team={activeTeam}
            currentUserId={user.id}
            onAddMember={async (email) => addMember(activeTeam.id, email)}
            onRemoveMember={async (userId) => {
              await removeMember(activeTeam.id, userId);
            }}
            onDeleteTeam={handleDeleteTeam}
          />
        )}

        <footer className="footer">
          {scope.kind === "team"
            ? "Team tasks are visible to every member. Your personal tasks stay private."
            : tasks.length > 0 && completed === tasks.length
              ? "Everything is done"
              : "Tasks, deadlines, and notes are saved to your account."}
        </footer>
      </main>
    </div>
  );
}
