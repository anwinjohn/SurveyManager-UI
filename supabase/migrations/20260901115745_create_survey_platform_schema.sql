/*
# Survey Platform Schema

## Overview
Creates the complete database schema for the Pulse survey management platform. This is a single-tenant app (no sign-in screen), so all policies allow both anon and authenticated roles.

## New Tables

1. `surveys` — Survey templates with full JSON payload (pages, questions, branding, quotas, languages, completion message)
   - `id` (uuid PK)
   - `title` (text)
   - `description` (text)
   - `status` (text: draft/active/paused/closed/archived, default draft)
   - `mode` (text: generic/event)
   - `organization` (text)
   - `owner` (text)
   - `pages` (jsonb — full survey structure)
   - `branding` (jsonb)
   - `quotas` (jsonb)
   - `languages` (jsonb — array of language codes)
   - `default_language` (text, default 'en')
   - `completion_message` (jsonb — multilingual completion messages)
   - `event_type_id` (text, nullable)
   - `response_count` (int, default 0)
   - `completion_rate` (numeric, default 0)
   - `avg_time_sec` (int, default 0)
   - `created_at`, `updated_at` (timestamptz)

2. `survey_versions` — Version history for each survey
   - `id` (uuid PK)
   - `survey_id` (uuid FK → surveys)
   - `version` (int)
   - `changelog` (text)
   - `published_by` (text)
   - `published_at` (timestamptz)
   - `snapshot` (jsonb — full survey payload at publish time)

3. `survey_translations` — Multilingual content for all survey elements
   - `id` (uuid PK)
   - `survey_id` (uuid FK → surveys)
   - `language_code` (text, e.g. 'en', 'es', 'fr')
   - `translations` (jsonb — nested object with translated titles, descriptions, questions, options, buttons, messages)

4. `survey_instances` — Personalized survey instances generated from templates
   - `id` (uuid PK)
   - `survey_id` (uuid FK → surveys)
   - `short_code` (text, unique — for short URL)
   - `event_type_id` (text, nullable)
   - `reference_id` (text, nullable — e.g. order ID, ticket ID)
   - `payload` (jsonb — contextual data for personalization: customer name, transaction ID, etc.)
   - `language` (text, default 'en' — requested language)
   - `status` (text: pending/responded/expired/opted-out, default pending)
   - `survey_url` (text, nullable)
   - `created_at`, `responded_at` (timestamptz)

5. `survey_responses` — Actual survey response data
   - `id` (uuid PK)
   - `instance_id` (uuid FK → survey_instances)
   - `answers` (jsonb — question ID → answer)
   - `language` (text)
   - `completed` (boolean, default false)
   - `created_at`, `completed_at` (timestamptz)

6. `captcha_sessions` — CAPTCHA challenge sessions
   - `id` (uuid PK)
   - `captcha_id` (text, unique — challenge ID)
   - `answer` (text — the expected answer)
   - `image_base64` (text — base64-encoded CAPTCHA image)
   - `verified` (boolean, default false)
   - `created_at` (timestamptz)
   - `expires_at` (timestamptz)

7. `master_settings` — Central configuration (base URL for short links, etc.)
   - `id` (uuid PK)
   - `key` (text, unique)
   - `value` (text)
   - `updated_at` (timestamptz)

8. `audit_log` — Audit history for all survey operations
   - `id` (uuid PK)
   - `actor` (text)
   - `action` (text)
   - `target` (text)
   - `timestamp` (timestamptz)
   - `ip` (text)

## Security
- RLS enabled on all tables.
- All policies allow `anon, authenticated` since this is a single-tenant app with no sign-in.
- Survey instances are publicly accessible via short code (for customer-facing survey page).
- CAPTCHA sessions are publicly readable (needed for customer survey page).
*/

-- =================== SURVEYS ===================
CREATE TABLE IF NOT EXISTS surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'Untitled Survey',
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  mode text NOT NULL DEFAULT 'generic',
  organization text NOT NULL DEFAULT 'Acme Retail',
  owner text NOT NULL DEFAULT 'Sarah Chen',
  pages jsonb NOT NULL DEFAULT '[]'::jsonb,
  branding jsonb NOT NULL DEFAULT '{}'::jsonb,
  quotas jsonb NOT NULL DEFAULT '[]'::jsonb,
  languages jsonb NOT NULL DEFAULT '["en"]'::jsonb,
  default_language text NOT NULL DEFAULT 'en',
  completion_message jsonb NOT NULL DEFAULT '{}'::jsonb,
  event_type_id text,
  response_count integer NOT NULL DEFAULT 0,
  completion_rate numeric NOT NULL DEFAULT 0,
  avg_time_sec integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_surveys" ON surveys;
CREATE POLICY "anon_select_surveys" ON surveys FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_surveys" ON surveys;
CREATE POLICY "anon_insert_surveys" ON surveys FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_surveys" ON surveys;
CREATE POLICY "anon_update_surveys" ON surveys FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_surveys" ON surveys;
CREATE POLICY "anon_delete_surveys" ON surveys FOR DELETE
  TO anon, authenticated USING (true);

-- =================== SURVEY VERSIONS ===================
CREATE TABLE IF NOT EXISTS survey_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  version integer NOT NULL,
  changelog text NOT NULL DEFAULT '',
  published_by text NOT NULL DEFAULT 'System',
  published_at timestamptz NOT NULL DEFAULT now(),
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE survey_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_versions" ON survey_versions;
CREATE POLICY "anon_select_versions" ON survey_versions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_versions" ON survey_versions;
CREATE POLICY "anon_insert_versions" ON survey_versions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_versions" ON survey_versions;
CREATE POLICY "anon_delete_versions" ON survey_versions FOR DELETE
  TO anon, authenticated USING (true);

-- =================== SURVEY TRANSLATIONS ===================
CREATE TABLE IF NOT EXISTS survey_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  language_code text NOT NULL,
  translations jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(survey_id, language_code)
);

ALTER TABLE survey_translations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_translations" ON survey_translations;
CREATE POLICY "anon_select_translations" ON survey_translations FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_translations" ON survey_translations;
CREATE POLICY "anon_insert_translations" ON survey_translations FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_translations" ON survey_translations;
CREATE POLICY "anon_update_translations" ON survey_translations FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_translations" ON survey_translations;
CREATE POLICY "anon_delete_translations" ON survey_translations FOR DELETE
  TO anon, authenticated USING (true);

-- =================== SURVEY INSTANCES ===================
CREATE TABLE IF NOT EXISTS survey_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  short_code text NOT NULL UNIQUE,
  event_type_id text,
  reference_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  language text NOT NULL DEFAULT 'en',
  status text NOT NULL DEFAULT 'pending',
  survey_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);

ALTER TABLE survey_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_instances" ON survey_instances;
CREATE POLICY "anon_select_instances" ON survey_instances FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_instances" ON survey_instances;
CREATE POLICY "anon_insert_instances" ON survey_instances FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_instances" ON survey_instances;
CREATE POLICY "anon_update_instances" ON survey_instances FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_instances" ON survey_instances;
CREATE POLICY "anon_delete_instances" ON survey_instances FOR DELETE
  TO anon, authenticated USING (true);

-- =================== SURVEY RESPONSES ===================
CREATE TABLE IF NOT EXISTS survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES survey_instances(id) ON DELETE CASCADE,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  language text NOT NULL DEFAULT 'en',
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_responses" ON survey_responses;
CREATE POLICY "anon_select_responses" ON survey_responses FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_responses" ON survey_responses;
CREATE POLICY "anon_insert_responses" ON survey_responses FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_responses" ON survey_responses;
CREATE POLICY "anon_update_responses" ON survey_responses FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- =================== CAPTCHA SESSIONS ===================
CREATE TABLE IF NOT EXISTS captcha_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  captcha_id text NOT NULL UNIQUE,
  answer text NOT NULL,
  image_base64 text NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes'
);

ALTER TABLE captcha_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_captcha" ON captcha_sessions;
CREATE POLICY "anon_select_captcha" ON captcha_sessions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_captcha" ON captcha_sessions;
CREATE POLICY "anon_insert_captcha" ON captcha_sessions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_captcha" ON captcha_sessions;
CREATE POLICY "anon_update_captcha" ON captcha_sessions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_captcha" ON captcha_sessions;
CREATE POLICY "anon_delete_captcha" ON captcha_sessions FOR DELETE
  TO anon, authenticated USING (true);

-- =================== MASTER SETTINGS ===================
CREATE TABLE IF NOT EXISTS master_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE master_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_settings" ON master_settings;
CREATE POLICY "anon_select_settings" ON master_settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_settings" ON master_settings;
CREATE POLICY "anon_insert_settings" ON master_settings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_settings" ON master_settings;
CREATE POLICY "anon_update_settings" ON master_settings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- =================== AUDIT LOG ===================
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor text NOT NULL DEFAULT 'System',
  action text NOT NULL,
  target text NOT NULL DEFAULT '',
  timestamp timestamptz NOT NULL DEFAULT now(),
  ip text NOT NULL DEFAULT 'internal'
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_audit" ON audit_log;
CREATE POLICY "anon_select_audit" ON audit_log FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_audit" ON audit_log;
CREATE POLICY "anon_insert_audit" ON audit_log FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- =================== INDEXES ===================
CREATE INDEX IF NOT EXISTS idx_survey_versions_survey_id ON survey_versions(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_translations_survey_id ON survey_translations(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_instances_survey_id ON survey_instances(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_instances_short_code ON survey_instances(short_code);
CREATE INDEX IF NOT EXISTS idx_survey_responses_instance_id ON survey_responses(instance_id);
CREATE INDEX IF NOT EXISTS idx_captcha_sessions_captcha_id ON captcha_sessions(captcha_id);

-- =================== SEED MASTER SETTINGS ===================
INSERT INTO master_settings (key, value)
VALUES ('base_url', 'https://survey.pulse.app')
ON CONFLICT (key) DO NOTHING;
