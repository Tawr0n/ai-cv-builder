# Server-side sessions in Postgres, not JWT

Users stay logged in through an opaque random token in an `HttpOnly; SameSite=Lax` cookie `sid`; Postgres holds only its SHA-256 hash in a `Session` row with `userId` and a sliding 30-day `expiresAt`. The browser talks to a single origin (Next.js rewrites `/api/*` to NestJS) and every request already reads the database, so JWT's one advantage, verifying identity without a database lookup across services, buys nothing here, while a session can be revoked instantly by deleting its row.

## Considered options

- **Short-lived JWT access token + rotating refresh token**: the standard way to make JWT logout meaningful, but it adds refresh endpoints, rotation with reuse detection and silent refresh on the frontend, a few hours of work that only approximates what a session row gives for free. The tokens would still have to live in an `HttpOnly` cookie (localStorage is readable by any XSS), so CSRF handling is identical.
- **One long-lived JWT in a cookie**: simplest to write, but logout cannot invalidate it until it expires.
- **express-session / Passport**: a small hand-written `AuthService` + global `AuthGuard` (~100 lines) is easier to read and test than configuring either.

## Consequences

- Every authenticated request does one indexed lookup on `Session.tokenHash`; renewal writes at most once per ~15 days per session (only when less than half of the 30 days is left), re-sending the same cookie with a new expiry.
- JWT would be worth revisiting only with a non-browser client (mobile app, third-party API consumers) or several backends on different origins.
