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

  await sql`CREATE TABLE IF NOT EXISTS message_images (
    message_id UUID PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
    image_data BYTEA NOT NULL,
    mime_type TEXT NOT NULL,
    file_name TEXT,
    file_size BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  const legacyImageColumns = await sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'messages'
        AND column_name = 'attachment_data'
    ) AS present
  `;

  if (legacyImageColumns[0]?.present) {
    await sql`ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_body_check`;
    await sql`ALTER TABLE messages ADD CONSTRAINT messages_body_check CHECK (char_length(body) <= 10000)`;
    await sql`INSERT INTO message_images (message_id, image_data, mime_type, file_name, file_size)
      SELECT id, decode(attachment_data, 'base64'),
        COALESCE(attachment_type, 'application/octet-stream'),
        attachment_name,
        COALESCE(attachment_size, octet_length(decode(attachment_data, 'base64')))
      FROM messages
      WHERE attachment_data IS NOT NULL
      ON CONFLICT (message_id) DO NOTHING`;
    await sql`ALTER TABLE messages
      DROP COLUMN IF EXISTS attachment_data,
      DROP COLUMN IF EXISTS attachment_type,
      DROP COLUMN IF EXISTS attachment_name,
      DROP COLUMN IF EXISTS attachment_size,
      DROP COLUMN IF EXISTS attachment_url`;
  }

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
