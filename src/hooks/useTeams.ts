import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest, errorMessage } from "@/lib/api";
import type { Team } from "@/types";

const POLL_MS = 2500;

export function useTeams(enabled: boolean) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const activeRef = useRef(false);
  const inFlightRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!enabled || !activeRef.current || inFlightRef.current > 0) return;

    try {
      const data = await apiRequest<{ teams: Team[] }>("/api/teams");
      if (!activeRef.current) return;
      setTeams(data.teams);
      setError("");
    } catch (err) {
      if (activeRef.current) setError(errorMessage(err));
    }
  }, [enabled]);

  useEffect(() => {
    activeRef.current = enabled;

    if (!enabled) {
      setTeams([]);
      setError("");
      setLoading(false);
      return () => {
        activeRef.current = false;
      };
    }

    let active = true;
    setLoading(true);

    void refresh().finally(() => {
      if (active) setLoading(false);
    });

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      active = false;
      activeRef.current = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, refresh]);

  const createTeam = useCallback(async (name: string) => {
    inFlightRef.current += 1;
    try {
      const data = await apiRequest<{ team: Team }>("/api/teams", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setTeams((current) => [...current, data.team]);
      setError("");
      return data.team;
    } finally {
      inFlightRef.current -= 1;
    }
  }, []);

  const addMember = useCallback(async (teamId: string, email: string) => {
    inFlightRef.current += 1;
    try {
      const data = await apiRequest<{ team: Team; added: boolean }>(
        `/api/teams/${encodeURIComponent(teamId)}/members`,
        { method: "POST", body: JSON.stringify({ email }) },
      );
      setTeams((current) => current.map((team) => (team.id === teamId ? data.team : team)));
      setError("");
      return data;
    } finally {
      inFlightRef.current -= 1;
    }
  }, []);

  const removeMember = useCallback(async (teamId: string, userId: number) => {
    inFlightRef.current += 1;
    try {
      const data = await apiRequest<{ team: Team }>(
        `/api/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(userId)}`,
        { method: "DELETE" },
      );
      setTeams((current) => current.map((team) => (team.id === teamId ? data.team : team)));
      setError("");
      return data.team;
    } finally {
      inFlightRef.current -= 1;
    }
  }, []);

  const deleteTeam = useCallback(async (teamId: string) => {
    inFlightRef.current += 1;
    try {
      await apiRequest(`/api/teams/${encodeURIComponent(teamId)}`, { method: "DELETE" });
      setTeams((current) => current.filter((team) => team.id !== teamId));
      setError("");
    } finally {
      inFlightRef.current -= 1;
    }
  }, []);

  return { teams, loading, error, refresh, createTeam, addMember, removeMember, deleteTeam };
}
