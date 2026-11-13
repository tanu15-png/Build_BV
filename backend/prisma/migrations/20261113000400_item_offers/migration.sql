CREATE TABLE offers (
 id UUID PRIMARY KEY, canteen_id UUID NOT NULL REFERENCES canteens(id) ON DELETE RESTRICT,
 menu_item_id UUID NOT NULL, name TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('PERCENT','AMOUNT','FIXED')),
 value INTEGER NOT NULL CHECK(value>=0), active BOOLEAN NOT NULL DEFAULT true,
 starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ NOT NULL, version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 UNIQUE(id,canteen_id), FOREIGN KEY(menu_item_id,canteen_id) REFERENCES menu_items(id,canteen_id) ON DELETE CASCADE,
 CHECK(ends_at>starts_at), CHECK((kind='PERCENT' AND value BETWEEN 1 AND 10000) OR (kind='AMOUNT' AND value>0) OR kind='FIXED')
);
CREATE INDEX offers_window ON offers(menu_item_id,active,starts_at,ends_at);
CREATE TABLE banner_offers (
 banner_id UUID NOT NULL, offer_id UUID NOT NULL, canteen_id UUID NOT NULL,
 PRIMARY KEY(banner_id,offer_id),
 FOREIGN KEY(banner_id,canteen_id) REFERENCES banners(id,canteen_id) ON DELETE CASCADE,
 FOREIGN KEY(offer_id,canteen_id) REFERENCES offers(id,canteen_id) ON DELETE CASCADE
);
ALTER TABLE order_items ADD COLUMN original_unit_price_paise INTEGER CHECK(original_unit_price_paise>=0);
ALTER TABLE order_items ADD COLUMN offer_id UUID;
ALTER TABLE order_items ADD COLUMN offer_name TEXT;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE banner_offers ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE tab TEXT; browser TEXT; server_roles TEXT; BEGIN
 SELECT string_agg(quote_ident(r.rolname),', ') INTO server_roles FROM pg_policy p JOIN pg_roles r ON r.oid=ANY(p.polroles)
 WHERE p.polrelid='public.menu_items'::regclass AND p.polname='server_access';
 FOREACH tab IN ARRAY ARRAY['offers','banner_offers'] LOOP
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC',tab);
  FOR browser IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated') LOOP EXECUTE format('REVOKE ALL ON public.%I FROM %I',tab,browser); END LOOP;
  IF server_roles IS NOT NULL THEN
   EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO %s',tab,server_roles);
   EXECUTE format('CREATE POLICY server_access ON public.%I TO %s USING(true) WITH CHECK(true)',tab,server_roles);
  END IF;
 END LOOP;
END $$;
