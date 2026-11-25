import { X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { errorMessage } from "@/lib/api";
import type { Team } from "@/types";

interface TeamPanelProps {
  team: Team;
  currentUserId: number;
  onAddMember: (email: string) => Promise<{ added: boolean }>;
  onRemoveMember: (userId: number) => Promise<void>;
  onDeleteTeam: () => Promise<void>;
}

export function TeamPanel({
  team,
  currentUserId,
  onAddMember,
  onRemoveMember,
  onDeleteTeam,
}: TeamPanelProps) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const isHost = team.role === "host";

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) return;

    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await onAddMember(email);
      setNotice(
        result.added
          ? "That person can now see this team."
          : "Invite saved — they'll join automatically when they sign up.",
      );
      setEmail("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(userId: number, memberEmail: string) {
    if (!window.confirm(`Remove ${memberEmail} from this team?`)) return;

    setError("");
    setNotice("");
    try {
      await onRemoveMember(userId);
      setNotice(`${memberEmail} was removed from the team.`);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${team.name}" and all of its team tasks?`)) return;

    setError("");
    try {
      await onDeleteTeam();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <section className="team-panel" aria-label={`${team.name} details`}>
      <header className="team-panel__head">
        <div>
          <p className="eyebrow">Shared space</p>
          <h2 className="team-panel__title">{team.name}</h2>
        </div>
        {isHost && <span className="role-badge">Host</span>}
      </header>

      <p className="team-panel__intro">
        All {team.members.length} {team.members.length === 1 ? "member can" : "members can"} see and manage
        these tasks. Private tasks stay invisible to the team.
      </p>

      <div className="team-panel__section">
        <h3 className="team-panel__subtitle">
          Members <span>{team.members.length}</span>
        </h3>
        <ul className="member-list">
          {team.members.map((member) => (
            <li key={member.id} className="member">
              <span className="member__avatar" aria-hidden="true">
                {member.email.slice(0, 1).toUpperCase()}
              </span>
              <span className="member__email" title={member.email}>
                {member.email}
                {member.id === currentUserId && <span className="member__you"> you</span>}
              </span>
              {member.role === "host" && <span className="member__role">Host</span>}
              {isHost && member.id !== currentUserId && (
                <button
                  type="button"
                  className="member__remove"
                  aria-label={`Remove ${member.email}`}
                  title="Remove member"
                  onClick={() => void handleRemove(member.id, member.email)}
                >
                  <X size={16} strokeWidth={1.5} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {isHost ? (
        <>
          <div className="team-panel__section">
            <h3 className="team-panel__subtitle">Invite by email</h3>
            <form className="invite-form" onSubmit={handleAdd}>
              <label className="sr-only" htmlFor="invite-email">
                Member email
              </label>
              <input
                id="invite-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="teammate@example.com"
                maxLength={254}
              />
              <button type="submit" disabled={busy || !email.trim()}>
                {busy ? "…" : "Add"}
              </button>
            </form>
            <p className="team-panel__help">
              Existing accounts join instantly; unknown emails become pending invites.
            </p>
          </div>

          {team.invites.length > 0 && (
            <div className="team-panel__section">
              <h3 className="team-panel__subtitle">
                Pending invites <span>{team.invites.length}</span>
              </h3>
              <ul className="invite-list">
                {team.invites.map((invite) => (
                  <li key={invite.email}>
                    <span title={invite.email}>{invite.email}</span>
                    <span className="invite-list__tag">Waiting to sign up</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button type="button" className="team-panel__danger" onClick={() => void handleDelete()}>
            Delete team
          </button>
        </>
      ) : (
        <p className="team-panel__help">Only the host can add or remove members.</p>
      )}

      {notice && <p className="team-panel__notice">{notice}</p>}
      {error && (
        <p className="team-panel__error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
