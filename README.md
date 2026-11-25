# To-Do (React + Vite + Express)

A full-stack to-do app. React/TypeScript on the front, Express + SQLite on the back. Users sign up with email and password, every personal task belongs to that user, and teams give members a shared task space.

## Features

- Email/password signup and login, with bcrypt-hashed passwords
- httpOnly session cookies; session tokens are stored hashed in SQLite
- Every personal task is private to the signed-in user — other accounts cannot see or change it
- Teams with a host and members: shared team tasks are visible and editable by all members
- Add teammates by email: existing accounts join instantly, unknown emails become pending invites that activate on signup
- Sidebar navigation between "My Tasks" and each team
- Optional deadlines with due-today / overdue / completed badges
- Progress slider (0–100%) and timestamped progress notes per task
- Filter tabs: All, Pending (all not-done tasks), Overdue, Completed
- Completed tasks remain fully expandable and editable
- Open lists refresh automatically every few seconds (and when you return to the tab), so teammates' changes appear without a manual reload
- Simultaneous edits are conflict-safe: only changed fields are saved, and a stale edit is retried on top of the latest version instead of overwriting someone else's work
- Plain CSS with a light/dark theme toggle in the sidebar (and on the sign-in screen); your choice is saved, and until you choose one the app follows your OS preference

## Getting started

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

This starts both servers together:

- Web: [http://localhost:5173](http://localhost:5173) (opens automatically)
- API: [http://localhost:3001](http://localhost:3001)

Vite proxies `/api` requests to the Express server. The SQLite database is created at `data/todo.db` on first run. New accounts start with an empty task list.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run API + Vite dev server together with hot reload |
| `npm run dev:api` | Run only the Express API on port 3001 |
| `npm run dev:web` | Run only the Vite frontend |
| `npm run build` | Type-check with TypeScript, then build for production |
| `npm start` | Build must be done first; serves `dist` and the API on `PORT` (default 3001) |

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3001` | API / production server port |
| `DB_PATH` | `data/todo.db` | SQLite database file location |

Vite's API proxy target is configured in `vite.config.ts` (defaults to port 3001).

## API

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/auth/signup` | Create account `{ email, password }` |
| `POST` | `/api/auth/login` | Sign in `{ email, password }` |
| `POST` | `/api/auth/logout` | End the session |
| `GET` | `/api/auth/me` | Current user (401 if signed out) |
| `GET` | `/api/teams` | Teams you belong to (members, invites for hosts, task counts) |
| `POST` | `/api/teams` | Create a team `{ name }`; you become the host |
| `POST` | `/api/teams/:id/members` | Host adds a member by email (instant add or pending invite) |
| `DELETE` | `/api/teams/:id/members/:userId` | Host removes a member |
| `DELETE` | `/api/teams/:id` | Host deletes a team and its team tasks |
| `GET` | `/api/tasks?scope=personal` | Current user's private tasks |
| `GET` | `/api/tasks?scope=team&teamId=:id` | Shared tasks for a team you belong to |
| `POST` | `/api/tasks` | Create a task (`teamId` optional; omit/null for personal) |
| `PATCH` | `/api/tasks/:id` | Update only the supplied fields of a task you can access (optional `baseVersion` guards against concurrent edits) |
| `DELETE` | `/api/tasks/:id` | Delete a task you can access |

All `/api/tasks` and `/api/teams` routes require a valid session cookie. Private tasks require ownership; team tasks require membership. Only a host can manage membership or delete the team, but all members can create, edit, and delete team tasks.

## Project structure

```
.
├── index.html
├── vite.config.ts          # React plugin, @ alias, /api proxy
├── tsconfig*.json
├── server
│   ├── db.js               # SQLite schema
│   ├── auth.js             # Password hashing + cookie sessions
│   └── index.js            # Express API + static hosting
├── src
│   ├── main.tsx
│   ├── App.tsx             # Auth gate, sidebar + workspace composition
│   ├── types.ts            # User, Task, TaskScope, Team, TaskNote, TaskFilter
│   ├── hooks
│   │   ├── useAuth.ts      # Session state and auth actions
│   │   ├── useTasks.ts     # API-backed task state for the active scope
│   │   ├── useTeams.ts     # Team list and membership actions
│   │   └── useTheme.ts     # Persisted light/dark choice, OS fallback
│   ├── lib/api.ts          # Fetch helper
│   ├── utils/dates.ts      # Deadline formatting
│   ├── components
│   │   ├── AuthScreen.tsx
│   │   ├── Sidebar.tsx     # My Tasks + team navigation
│   │   ├── TeamPanel.tsx   # Members, invites, host controls
│   │   ├── Header.tsx
│   │   ├── AddTaskForm.tsx
│   │   ├── FilterTabs.tsx
│   │   ├── TaskList.tsx
│   │   ├── TaskItem.tsx
│   │   ├── TaskDetails.tsx
│   │   └── ThemeToggle.tsx # Light/dark button
│   └── styles/global.css
├── .agents/skills/unslop/  # Installed unslop skill (see below)
└── data/                   # SQLite files (gitignored)
```

## Unslop skill

This project includes the [unslop](https://github.com/heydamir/unslop) skill at `.agents/skills/unslop/`. It audits a screen for AI-looking UI, proposes a direction, then redesigns it pass by pass. OpenCode and Codex discover it automatically from that folder:

- OpenCode: ask to "unslop this screen", or mention `@unslop`.
- Codex: use `$unslop`.

The optional screenshot/story-video scripts in `scripts/` need Playwright plus Chromium (`npm install -D playwright && npx playwright install chromium`); story videos also need `ffmpeg`. They are not required for the app itself.

unslop was created by Damir Sokolovsky ([@heydamir](https://x.com/heydamir)) and is licensed under [CC BY 4.0](.agents/skills/unslop/LICENSE). Credit and a link back to [the original repository](https://github.com/heydamir/unslop) are included as required by the license.

## Security notes

- Passwords are hashed with bcrypt (cost 12); plaintext passwords are never stored.
- Sessions use a random token in an httpOnly, SameSite=Lax cookie; only its SHA-256 hash is stored in the database. Cookies are marked `Secure` when `NODE_ENV=production`.
- Personal task queries always filter by the authenticated user's ID. Team task queries first verify team membership; membership changes and team deletion are host-only.
- For a public deployment, add HTTPS, rate limiting on auth routes, and CSRF protection for state-changing requests.
