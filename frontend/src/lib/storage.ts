const ACCESS_TOKEN_KEY = "ai_smb_access_token";
const REFRESH_TOKEN_KEY = "ai_smb_refresh_token";
const USER_EMAIL_KEY = "ai_smb_user_email";

export const tokenStorage = {
  getAccess: () => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  setTokens: (access: string, refresh: string) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, access);
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_EMAIL_KEY);
  },
  getEmail: () => localStorage.getItem(USER_EMAIL_KEY),
  setEmail: (email: string) => localStorage.setItem(USER_EMAIL_KEY, email),
};
