const DEFAULT_PRODUCTION_API_URL = "https://zani-9lnp.onrender.com";

export const apiBaseURL =
  import.meta.env.VITE_API_URL || (import.meta.env.PROD ? DEFAULT_PRODUCTION_API_URL : "");
