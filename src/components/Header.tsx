const dateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
});

interface HeaderProps {
  title?: string;
  eyebrow?: string;
  subtitle?: string;
}

export function Header({ title = "My tasks", eyebrow = "Personal space", subtitle }: HeaderProps) {
  return (
    <header className="header">
      <div className="header__text">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="title">{title}</h1>
        <p className="date">{subtitle ?? dateFormatter.format(new Date())}</p>
      </div>
    </header>
  );
}
