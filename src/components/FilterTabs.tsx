import type { TaskFilter } from "@/types";

interface FilterTabsProps {
  active: TaskFilter;
  counts: Record<TaskFilter, number>;
  onChange: (filter: TaskFilter) => void;
}

const FILTERS: { key: TaskFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "overdue", label: "Overdue" },
  { key: "completed", label: "Completed" },
];

export function FilterTabs({ active, counts, onChange }: FilterTabsProps) {
  return (
    <div className="filters" role="group" aria-label="Filter tasks">
      {FILTERS.map((filter) => (
        <button
          key={filter.key}
          type="button"
          className={active === filter.key ? "filter-btn active" : "filter-btn"}
          aria-pressed={active === filter.key}
          onClick={() => onChange(filter.key)}
        >
          {filter.label}
          <span className="filter__count">{counts[filter.key]}</span>
        </button>
      ))}
    </div>
  );
}
