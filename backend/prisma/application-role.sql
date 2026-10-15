-- Run with psql as schema owner, after migrations. app_role must already exist.
-- Usage: psql "$MIGRATION_DATABASE_URL" -v app_role=spoonate_app -f prisma/application-role.sql
\set ON_ERROR_STOP on
SELECT set_config('spoonate.app_role', :'app_role', false);
DO $$ DECLARE app_name text := current_setting('spoonate.app_role'); tab text; BEGIN
 IF app_name IN ('anon','authenticated','service_role','postgres') OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_name AND NOT rolsuper AND NOT rolbypassrls) THEN
  RAISE EXCEPTION 'Expected dedicated non-superuser application role without BYPASSRLS';
 END IF;
 EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', app_name);
 FOR tab IN SELECT unnest(ARRAY['users','user_roles','canteens','canteen_access_codes','canteen_memberships','auth_challenges','sessions','carts','cart_items','menu_items','orders','order_items','order_events','order_code_allocations','notifications','outbox_events','idempotency_keys','audit_logs','rate_limits']) LOOP
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO %I', tab, app_name);
  EXECUTE format('DROP POLICY IF EXISTS server_access ON public.%I', tab);
  EXECUTE format('CREATE POLICY server_access ON public.%I TO %I USING (true) WITH CHECK (true)', tab, app_name);
 END LOOP;
END $$;
