-- Match the existing server-only menu access policy for the rewards table.
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rewards FROM PUBLIC;
DO $$ DECLARE role_name text; server_roles text; BEGIN
  FOR role_name IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated') LOOP
    EXECUTE format('REVOKE ALL ON public.rewards FROM %I', role_name);
  END LOOP;
  SELECT string_agg(quote_ident(r.rolname), ', ') INTO server_roles
    FROM pg_policy p
    JOIN pg_roles r ON r.oid = ANY(p.polroles)
    WHERE p.polrelid = 'public.menu_items'::regclass AND p.polname = 'server_access';
  IF server_roles IS NOT NULL THEN
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.rewards TO %s', server_roles);
    EXECUTE format('CREATE POLICY server_access ON public.rewards TO %s USING (true) WITH CHECK (true)', server_roles);
  END IF;
END $$;
