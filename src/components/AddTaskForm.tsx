import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";

interface AddTaskFormProps {
  onAdd: (title: string, dueDate: string | null) => void;
}

export function AddTaskForm({ onAdd }: AddTaskFormProps) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;

    onAdd(title, dueDate || null);
    setTitle("");
    setDueDate("");
  }

  return (
    <form className="add-form" onSubmit={handleSubmit}>
      <div className="add-form__main">
        <label className="sr-only" htmlFor="new-task">
          New task
        </label>
        <input
          id="new-task"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Add a task"
          maxLength={300}
          autoComplete="off"
        />
        <button className="add-btn" type="submit">
          <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
          Add
        </button>
      </div>

      <div className="deadline-field">
        <label htmlFor="new-deadline">
          Deadline <span>(optional)</span>
        </label>
        <input
          id="new-deadline"
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
        />
      </div>
    </form>
  );
}
