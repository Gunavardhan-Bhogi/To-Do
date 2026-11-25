import { X } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { Task } from "@/types";
import { formatNoteTime } from "@/utils/dates";

interface TaskDetailsProps {
  task: Task;
  onSetDeadline: (id: string, dueDate: string | null) => void;
  onSetProgress: (id: string, value: number) => void;
  onAddNote: (id: string, text: string) => void;
  onDeleteNote: (id: string, noteId: string) => void;
}

export function TaskDetails({
  task,
  onSetDeadline,
  onSetProgress,
  onAddNote,
  onDeleteNote,
}: TaskDetailsProps) {
  const [draft, setDraft] = useState("");

  function handleNoteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim()) return;

    onAddNote(task.id, draft);
    setDraft("");
  }

  return (
    <div className="details">
      <div className="details__deadline">
        <label htmlFor={`deadline-${task.id}`}>Deadline</label>
        <input
          id={`deadline-${task.id}`}
          type="date"
          value={task.dueDate ?? ""}
          onChange={(event) => onSetDeadline(task.id, event.target.value || null)}
        />
        {task.dueDate && (
          <button
            type="button"
            className="details__clear"
            onClick={() => onSetDeadline(task.id, null)}
          >
            Clear
          </button>
        )}
      </div>

      <div className="details__progress">
        <div className="details__progress-head">
          <label htmlFor={`progress-${task.id}`}>Progress</label>
          <output htmlFor={`progress-${task.id}`}>{task.progress}%</output>
        </div>
        <input
          id={`progress-${task.id}`}
          type="range"
          min={0}
          max={100}
          step={5}
          value={task.progress}
          onChange={(event) => onSetProgress(task.id, Number(event.target.value))}
          aria-label={`Progress for ${task.title}`}
        />
      </div>

      <p className="details__label">Progress notes</p>

      {task.notes.length === 0 ? (
        <p className="details__hint">Log progress, e.g. Part 1 done</p>
      ) : (
        <ol className="notes">
          {task.notes.map((note) => (
            <li className="note" key={note.id}>
              <span className="note__dot" aria-hidden="true" />
              <div className="note__body">
                <p className="note__text">{note.text}</p>
                <time className="note__time" dateTime={new Date(note.createdAt).toISOString()}>
                  {formatNoteTime(note.createdAt)}
                </time>
              </div>
              <button
                type="button"
                className="note__delete"
                aria-label={`Delete note: ${note.text}`}
                title="Delete note"
                onClick={() => onDeleteNote(task.id, note.id)}
              >
                <X size={16} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ol>
      )}

      <form className="note-form" onSubmit={handleNoteSubmit}>
        <label className="sr-only" htmlFor={`new-note-${task.id}`}>
          Add a progress note for {task.title}
        </label>
        <input
          id={`new-note-${task.id}`}
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add a note"
          maxLength={300}
          autoComplete="off"
        />
        <button type="submit" disabled={!draft.trim()}>
          Add note
        </button>
      </form>
    </div>
  );
}
