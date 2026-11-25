import { CalendarDays, Check, MessageSquare, Trash2 } from "lucide-react";
import { useState } from "react";
import { TaskDetails } from "@/components/TaskDetails";
import type { Task } from "@/types";
import { describeDeadline } from "@/utils/dates";

interface TaskItemProps {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onSetDeadline: (id: string, dueDate: string | null) => void;
  onSetProgress: (id: string, value: number) => void;
  onAddNote: (id: string, text: string) => void;
  onDeleteNote: (id: string, noteId: string) => void;
}

export function TaskItem({
  task,
  onToggle,
  onDelete,
  onSetDeadline,
  onSetProgress,
  onAddNote,
  onDeleteNote,
}: TaskItemProps) {
  const [expanded, setExpanded] = useState(false);
  const deadline = task.dueDate ? describeDeadline(task.dueDate, task.completed) : null;
  const detailsId = `task-details-${task.id}`;

  return (
    <li className={task.completed ? "task task--done" : "task"}>
      <div className="task__row">
        <button
          type="button"
          className="task__check"
          role="checkbox"
          aria-checked={task.completed}
          aria-label={`Mark "${task.title}" as ${task.completed ? "not done" : "done"}`}
          onClick={() => onToggle(task.id)}
        >
          <Check size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>

        <div className="task__content">
          <span className="task__title">{task.title}</span>
          {deadline && (
            <span className={`deadline deadline--${deadline.tone}`}>
              <CalendarDays size={16} strokeWidth={1.5} aria-hidden="true" />
              {deadline.label}
            </span>
          )}
          {task.teamId && task.creatorEmail && (
            <span className="task__author" title={`Added by ${task.creatorEmail}`}>
              Added by {task.creatorEmail}
            </span>
          )}
          <div
            className="task__progress"
            role="progressbar"
            aria-label={`Progress for ${task.title}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={task.progress}
          >
            <div className="task__progress-fill" style={{ width: `${task.progress}%` }} />
          </div>
        </div>

        <button
          type="button"
          className={task.notes.length > 0 ? "task__notes has-notes" : "task__notes"}
          aria-label={`Details and progress notes for "${task.title}"`}
          aria-expanded={expanded}
          aria-controls={detailsId}
          title="Details and progress notes"
          onClick={() => setExpanded((open) => !open)}
        >
          <MessageSquare size={16} strokeWidth={1.5} aria-hidden="true" />
          {task.notes.length > 0 && <span className="task__notes-count">{task.notes.length}</span>}
        </button>

        <button
          type="button"
          className="task__delete"
          aria-label={`Delete "${task.title}"`}
          title="Delete task"
          onClick={() => onDelete(task.id)}
        >
          <Trash2 size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>

      {expanded && (
        <div id={detailsId} className="task__details">
          <TaskDetails
            task={task}
            onSetDeadline={onSetDeadline}
            onSetProgress={onSetProgress}
            onAddNote={onAddNote}
            onDeleteNote={onDeleteNote}
          />
        </div>
      )}
    </li>
  );
}
