CREATE TABLE app.workspaces (
 owner_id text PRIMARY KEY,
 state jsonb NOT NULL,
 version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);