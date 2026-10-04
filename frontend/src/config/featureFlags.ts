// Central feature-flag config.
// Read env vars here; never call import.meta.env directly for flags elsewhere in the app.
export const featureFlags = {
  /** When true, the Google OAuth / JWT auth flow is active. */
  enableAuth: import.meta.env.VITE_ENABLE_AUTH === 'true',
  /** When true, SerpAPI-powered search features are visible in the UI. */
  enableSerpApi: import.meta.env.VITE_ENABLE_SERPAPI === 'true',
} as const;
