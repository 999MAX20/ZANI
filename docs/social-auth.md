# Google / Apple social auth

Zani supports Google and Apple sign-in as an additional auth path next to email/password JWT login.

## Backend flow

Frontend receives an OAuth identity token from Google or Apple and sends it to:

```http
POST /api/auth/social/
```

Payload:

```json
{
  "provider": "google",
  "id_token": "PROVIDER_ID_TOKEN"
}
```

Backend verifies:

- provider is `google` or `apple`;
- token signature through the provider JWKS endpoint;
- `aud` matches configured OAuth client IDs;
- `iss`, `sub`, `exp`, `iat`;
- Google email is verified.

Then it links or creates a local Django user and returns the normal SimpleJWT pair:

```json
{
  "access": "...",
  "refresh": "...",
  "created": true,
  "provider": "google"
}
```

## Environment variables

Backend:

```env
GOOGLE_OAUTH_CLIENT_IDS=google-web-client-id.apps.googleusercontent.com
APPLE_OAUTH_CLIENT_IDS=com.yourcompany.zani.web
SOCIAL_AUTH_AUTO_CREATE_MERCHANT=True
AUTH_SOCIAL_RATE=20/min
```

Frontend:

```env
VITE_GOOGLE_CLIENT_ID=google-web-client-id.apps.googleusercontent.com
VITE_APPLE_CLIENT_ID=com.yourcompany.zani.web
```

If multiple backend client IDs are allowed, use a comma-separated value:

```env
GOOGLE_OAUTH_CLIENT_IDS=web-client-id,ios-client-id
```

## Google setup

1. Open Google Cloud Console.
2. Create OAuth Client ID for a Web application.
3. Add authorized JavaScript origins:
   - local: `http://localhost:5173`
   - staging: frontend Render URL
   - production: frontend domain
4. Put the Web Client ID into backend and frontend env variables.

## Apple setup

1. Apple Developer account is required.
2. Create a Services ID for web sign-in.
3. Configure domains and return URL:
   - local tunneling domain for development if needed;
   - staging frontend URL `/login`;
   - production frontend URL `/login`.
4. Put the Services ID into backend and frontend env variables.

## Notes

- Social auth does not replace tenant filtering, RBAC or `/api/auth/me/`.
- Newly created social users are created as merchant owners by default and receive a trial workspace when `SOCIAL_AUTH_AUTO_CREATE_MERCHANT=True`.
- Platform admins should still be created through admin/management flows, not public social registration.
