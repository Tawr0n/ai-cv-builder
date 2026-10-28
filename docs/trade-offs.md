# Known trade-offs

Deliberate compromises made to fit the task's scope. Each one names what we gave up, why, and what would remove it. The README links here.

## Sign-up reveals whether an email is registered

**What:** `POST /api/auth/signup` with an email that already has a User returns `409 Email already registered`. Anyone can therefore check whether a given email has an account (account enumeration).

**Why we accept it:** Hiding this requires answering every sign-up identically and telling the real owner by email ("someone tried to register with your address"). Email delivery and verification are explicitly out of scope for this task, so without them there is no channel to report the conflict, and a silent "success" would leave a legitimate user unable to tell why they can't log in.

**What limits the damage:**

- Log-in does _not_ leak it: unknown email and wrong password return the same `401 Invalid email or password`, with a dummy password hash checked for unknown emails so response time doesn't differ either.
- `/api/auth/signup` and `/api/auth/login` are rate-limited per IP, so bulk enumeration is slow.

**What would remove it:** Adding email verification. Sign-up then always responds "check your inbox", and the inbox receives either a confirmation link or an "you already have an account" notice.

## AI never touches an item the user edited by hand

**What:** When an Answer-driven update reaches an item the user has already changed by hand (`edited: true`), the AI leaves it alone. The Answer is still saved as a Fact and the Question is marked answered, but the user has to fold the new information into that item themselves; the UI shows the Answer next to the item with a hint.

**Why we accept it:** The alternative is a **Suggestion**: the AI proposes a replacement for the item, the UI shows "before → after", and the user accepts or rejects it. That needs its own state (pending / accepted / rejected / stale when the item changed again), a before/after view that works on mobile, and conflict handling on accept. It does not fit the time budget, and the simpler rule never overwrites the user's words.

**What would remove it:** Suggestions for every Answer-driven update, not only edited items. The worker would then never write into the CV content at all, which also removes the race between background updates and manual edits.
