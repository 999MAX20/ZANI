/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_APPLE_CLIENT_ID?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_SENTRY_TRACES_SAMPLE_RATE?: string;
  readonly VITE_POSTHOG_KEY?: string;
  readonly VITE_POSTHOG_HOST?: string;
  readonly VITE_PLAUSIBLE_DOMAIN?: string;
}

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleAccountsId {
  initialize(options: { client_id: string; callback: (response: GoogleCredentialResponse) => void }): void;
  prompt(callback?: (notification: { isNotDisplayed?: () => boolean; isSkippedMoment?: () => boolean }) => void): void;
}

interface AppleSignInResponse {
  authorization?: {
    id_token?: string;
  };
}

interface Window {
  google?: {
    accounts?: {
      id?: GoogleAccountsId;
    };
  };
  AppleID?: {
    auth?: {
      init(options: {
        clientId: string;
        scope: string;
        redirectURI: string;
        usePopup: boolean;
      }): void;
      signIn(): Promise<AppleSignInResponse>;
    };
  };
}
