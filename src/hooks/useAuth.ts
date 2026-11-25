import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import type { User } from "@/types";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    fetch("/api/auth/me", { credentials: "same-origin" })
      .then(async (response) => {
        if (response.status === 401) return null;
        const data = (await response.json()) as { user: User };
        return data.user;
      })
      .then((currentUser) => {
        if (active) setUser(currentUser);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const signup = useCallback(async (email: string, password: string) => {
    const data = await apiRequest<{ user: User }>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setUser(data.user);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiRequest<{ user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
    }
  }, []);

  return { user, loading, signup, login, logout };
}
