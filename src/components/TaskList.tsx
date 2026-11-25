import { ListChecks } from "lucide-react";
import { TaskItem } from "@/components/TaskItem";
import type { Task, TaskFilter } from "@/types";

interface TaskListProps {
  tasks: Task[];
  total: number;
  filter: TaskFilter;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onSetDeadline: (id: string, dueDate: string | null) => void;
  onSetProgress: (id: string, value: number) => void;
  onAddNote: (id: string, text: string) => void;
  onDeleteNote: (id: string, noteId: string) => void;
}

export function TaskList({
  tasks,
  total,
  filter,
  onToggle,
  onDelete,
  onSetDeadline,
  onSetProgress,
  onAddNote,
  onDeleteNote,
}: TaskListProps) {
  if (tasks.length === 0) {
    return <EmptyState filter={filter} total={total} />;
  }

  return (
    <ul className="task-list" aria-label="Tasks">
      {tasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          onToggle={onToggle}
          onDelete={onDelete}
          onSetDeadline={onSetDeadline}
          onSetProgress={onSetProgress}
          onAddNote={onAddNote}
          onDeleteNote={onDeleteNote}
        />
      ))}
    </ul>
  );
}

interface EmptyStateProps {
  filter: TaskFilter;
  total: number;
}

function EmptyState({ filter, total }: EmptyStateProps) {
  let title = "Nothing here yet";
  let hint = "Add a task above to get started";

  if (total > 0) {
    if (filter === "pending") {
      title = "Nothing pending";
      hint = "Every task is done";
    } else if (filter === "overdue") {
      title = "Nothing overdue";
      hint = "All deadlines are on track";
    } else if (filter === "completed") {
      title = "No completed tasks";
      hint = "Finished tasks appear here";
    }
  }

  return (
    <div className="empty">
      <div className="empty__icon" aria-hidden="true">
        <ListChecks size={16} strokeWidth={1.5} />
      </div>
      <p className="empty__title">{title}</p>
      <p className="empty__hint">{hint}</p>
    </div>
  );
}
