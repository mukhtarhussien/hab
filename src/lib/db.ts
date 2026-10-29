
import { neon } from "@neondatabase/serverless";

export function getSql() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured");
  return neon(databaseUrl);
}

let schemaPromise: Promise<void> | undefined;

async function initializeSchema() {
  const sql = getSql();

  await sql`CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS sessions (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await sql`CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id)`;

  await sql`CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_one_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_two_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL DEFAULT '' CHECK (char_length(body) <= 10000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES users(id) ON DELETE CASCADE`;

  await sql`ALTER TABLE messages ALTER COLUMN conversation_id DROP NOT NULL`;

  await sql`ALTER TABLE messages ALTER COLUMN body SET DEFAULT ''`;

  await sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_url TEXT`;

  await sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_type TEXT`;

  await sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_name TEXT`;

  await sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_size BIGINT`;

  await sql`UPDATE messages m SET recipient_id = CASE
      WHEN m.sender_id = c.user_one_id THEN c.user_two_id
      ELSE c.user_one_id
    END
    FROM conversations c
    WHERE m.conversation_id = c.id AND m.recipient_id IS NULL`;

  await sql`CREATE INDEX IF NOT EXISTS messages_conversation_idx
    ON messages(sender_id, recipient_id, created_at)`;
}

export function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = initializeSchema().catch((error) => {
      schemaPromise = undefined;
      throw error;
    });
  }

  return schemaPromise;
}
