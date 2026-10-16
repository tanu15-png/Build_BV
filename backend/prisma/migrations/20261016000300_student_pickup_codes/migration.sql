-- The private handover code is separate from the public daily order reference.
CREATE TABLE pickup_credentials (
  order_id UUID PRIMARY KEY REFERENCES orders(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  encrypted_code TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  window_ends_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE pickup_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON pickup_credentials FROM PUBLIC;
DO $$ DECLARE r record; browser text; BEGIN
 FOR browser IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated') LOOP
  EXECUTE format('REVOKE ALL ON pickup_credentials FROM %I', browser);
 END LOOP;
 FOR r IN SELECT DISTINCT pr.rolname FROM pg_policy p
 JOIN pg_class t ON t.oid = p.polrelid JOIN pg_roles pr ON pr.oid = ANY(p.polroles)
 WHERE t.oid = 'public.orders'::regclass AND p.polname = 'server_access' LOOP
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON pickup_credentials TO %I', r.rolname);
  EXECUTE format('CREATE POLICY server_access ON pickup_credentials TO %I USING (true) WITH CHECK (true)', r.rolname);
 END LOOP;
END $$;
