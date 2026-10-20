# habeeb chat

Arabic RTL chat interface with Neon Postgres-backed accounts and sessions.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Set `DATABASE_URL` to a newly rotated Neon connection string. Keep `.env.local` private; it is ignored by Git.
4. Start the app with `npm run dev`.
5. Open `/api/db-test` to check the Neon connection and create the required tables.
6. Create an account from the sign-in screen.

The app creates the `users`, `sessions`, and `messages` tables with idempotent queries in `src/lib/db.ts`; `database/schema.sql` is also provided for manual setup. Passwords are hashed on the server with scrypt. Session tokens are random, stored as hashes in Postgres, and sent in HttpOnly cookies.

## Deployment

Set `DATABASE_URL` in the hosting provider's server-side environment variables. Never commit `.env.local` or paste database credentials into source files. Use HTTPS in production.
