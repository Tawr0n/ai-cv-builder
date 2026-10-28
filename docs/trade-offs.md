# Known trade-offs

Deliberate compromises made to fit the task's scope. Each one names what we gave up, why, and what would remove it. The README links here.

## Sign-up reveals whether an email is registered

**What:** `POST /api/auth/signup` with an email that already has a User returns `409 Email already registered`. Anyone can therefore check whether a given email has an account (account enumeration).

**Why we accept it:** Hiding this requires answering every sign-up identically and telling the real owner by email ("someone tried to register with your address"). Email delivery and verification are explicitly out of scope for this task, so without them there is no channel to report the conflict, and a silent "success" would leave a legitimate user unable to tell why they can't log in.

**What limits the damage:**

- Log-in does _not_ leak it: unknown email and wrong password return the same `401 Invalid email or password`, with a dummy password hash checked for unknown emails so response time doesn't differ either.
- `/api/auth/signup` and `/api/auth/login` are rate-limited per IP, so bulk enumeration is slow.

**What would remove it:** Adding email verification. Sign-up then always responds "check your inbox", and the inbox receives either a confirmation link or an "you already have an account" notice.
