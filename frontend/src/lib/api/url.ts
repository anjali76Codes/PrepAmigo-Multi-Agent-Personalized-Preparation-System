const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

export const API_BASE_URL = (
  configuredApiUrl || (import.meta.env.DEV ? "http://localhost:3000" : "")
).replace(/\/+$/, "");

export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
