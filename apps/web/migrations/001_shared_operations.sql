CREATE TABLE IF NOT EXISTS alpha_demo_operations (
  lot_id text PRIMARY KEY,
  cooperative text NOT NULL,
  access_hashes jsonb NOT NULL CHECK (jsonb_typeof(access_hashes) = 'object'),
  state jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(state) = 'object'),
  revision integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
