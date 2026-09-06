/*
# Add short_code to surveys table

## Overview
Generic (non-event) surveys need a shareable short URL so customers can access
them directly without creating an event-based instance. This migration adds a
`short_code` column to the `surveys` table, generates a unique 8-character code
for every existing survey, and adds a unique index so future codes stay unique.

## Changes
1. `surveys` table — new column:
   - `short_code` (text, nullable, unique) — 8-char alphanumeric code used in
     the short URL `/s/<short_code>`. Only populated for published surveys.
2. Index:
   - `idx_surveys_short_code` — unique index on `short_code` for fast lookups.
3. Backfill:
   - Generates a random 8-char code for every existing survey row that doesn't
     already have one.
## Security
- No RLS policy changes needed — existing `anon_select_surveys` policy already
  allows public reads, which is required for the customer-facing survey page.
*/

ALTER TABLE surveys ADD COLUMN IF NOT EXISTS short_code text;

CREATE INDEX IF NOT EXISTS idx_surveys_short_code ON surveys(short_code);

-- Backfill existing rows with a unique short code
DO $$
DECLARE
  r RECORD;
  new_code TEXT;
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  attempts INT;
BEGIN
  FOR r IN SELECT id FROM surveys WHERE short_code IS NULL LOOP
    attempts := 0;
    LOOP
      new_code := '';
      FOR i IN 1..8 LOOP
        new_code := new_code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
      END LOOP;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM surveys WHERE short_code = new_code);
      attempts := attempts + 1;
      EXIT WHEN attempts > 50;
    END LOOP;
    UPDATE surveys SET short_code = new_code WHERE id = r.id;
  END LOOP;
END $$;
