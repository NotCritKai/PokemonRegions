/**
 * Cloudflare Account & Sync API integration for PokemonRegions.
 */

const API_BASE = "https://backend.braylonringo525.workers.dev";

const TOKEN_KEY = "pokemon-regions-auth-token";
const USER_KEY = "pokemon-regions-auth-user";

export interface User {
  id: string;
  username: string;
}

export interface CloudData {
  regions: any[];
  customPokemon: any[];
  gimmicks: any[];
  updatedAt: number;
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) {
    window.localStorage.setItem(TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(TOKEN_KEY);
  }
}

export function getAuthUser(): User | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(USER_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as User;
  } catch {
    return null;
  }
}

export function setAuthUser(user: User | null): void {
  if (typeof window === "undefined") return;
  if (user) {
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    window.localStorage.removeItem(USER_KEY);
  }
}

export async function registerUser(username: string, password: string): Promise<{ success: boolean; error?: string; user?: User }> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || "Registration failed" };
    }
    setAuthToken(data.token);
    setAuthUser(data.user);
    return { success: true, user: data.user };
  } catch (err: any) {
    return { success: false, error: err?.message || "Network error during registration" };
  }
}

export async function loginUser(username: string, password: string): Promise<{ success: boolean; error?: string; user?: User }> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || "Login failed" };
    }
    setAuthToken(data.token);
    setAuthUser(data.user);
    return { success: true, user: data.user };
  } catch (err: any) {
    return { success: false, error: err?.message || "Network error during login" };
  }
}

export async function loginWithOAuthCode(provider: "google" | "github", code: string, redirectUri?: string): Promise<{ success: boolean; error?: string; user?: User }> {
  try {
    const url = `${API_BASE}/api/auth/${provider}/token`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, redirect_uri: redirectUri }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || `${provider} login failed` };
    }
    setAuthToken(data.token);
    setAuthUser(data.user);
    return { success: true, user: data.user };
  } catch (err: any) {
    return { success: false, error: err?.message || "Network error during OAuth login" };
  }
}

export async function logoutUser(): Promise<void> {
  const token = getAuthToken();
  if (token) {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      // Ignore network errors during logout
    }
  }
  setAuthToken(null);
  setAuthUser(null);
}

export async function checkAuthStatus(): Promise<User | null> {
  const token = getAuthToken();
  if (!token) {
    setAuthUser(null);
    return null;
  }
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (res.ok && data.success && data.user) {
      setAuthUser(data.user);
      return data.user;
    } else {
      setAuthToken(null);
      setAuthUser(null);
      return null;
    }
  } catch {
    // If offline, return cached user
    return getAuthUser();
  }
}

export async function fetchCloudData(): Promise<{ success: boolean; error?: string; data?: CloudData }> {
  const token = getAuthToken();
  if (!token) return { success: false, error: "Not logged in" };

  try {
    const res = await fetch(`${API_BASE}/api/sync`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || "Failed to fetch cloud data" };
    }
    return { success: true, data: data.data };
  } catch (err: any) {
    return { success: false, error: err?.message || "Network error" };
  }
}

export async function pushCloudData(payload: { regions: any[]; customPokemon?: any[]; gimmicks?: any[] }): Promise<{ success: boolean; error?: string; updatedAt?: number }> {
  const token = getAuthToken();
  if (!token) return { success: false, error: "Not logged in" };

  try {
    const res = await fetch(`${API_BASE}/api/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || "Failed to push cloud data" };
    }
    return { success: true, updatedAt: data.updatedAt };
  } catch (err: any) {
    return { success: false, error: err?.message || "Network error" };
  }
}
