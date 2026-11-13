CREATE TABLE banners (
 id UUID PRIMARY KEY, canteen_id UUID NOT NULL REFERENCES canteens(id) ON DELETE RESTRICT,
 theme TEXT, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', image_ref TEXT NOT NULL,
 active BOOLEAN NOT NULL DEFAULT true, target_type TEXT NOT NULL DEFAULT 'theme', target_id UUID,
 published_at TIMESTAMPTZ NOT NULL DEFAULT now(), starts_at TIMESTAMPTZ, ends_at TIMESTAMPTZ,
 version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
 UNIQUE(id,canteen_id), UNIQUE(canteen_id,theme),
 CHECK(theme IS NULL OR theme IN ('exam-season','sunday-funday','birthday')),
 CHECK(target_type IN ('theme','item','category','menu')),
 CHECK(ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);
CREATE TABLE banner_items (
 banner_id UUID NOT NULL, canteen_id UUID NOT NULL, menu_item_id UUID NOT NULL,
 PRIMARY KEY(banner_id,menu_item_id),
 FOREIGN KEY(banner_id,canteen_id) REFERENCES banners(id,canteen_id) ON DELETE CASCADE,
 FOREIGN KEY(menu_item_id,canteen_id) REFERENCES menu_items(id,canteen_id) ON DELETE CASCADE
);
CREATE TABLE banner_images (
 id UUID PRIMARY KEY, mime TEXT NOT NULL CHECK(mime IN ('image/jpeg','image/png','image/webp')),
 data BYTEA NOT NULL CHECK(octet_length(data) BETWEEN 1 AND 4194304),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX banners_published ON banners(canteen_id, active, published_at DESC);
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE banner_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE banner_images ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE tab TEXT; browser TEXT; server_roles TEXT; BEGIN
 SELECT string_agg(quote_ident(r.rolname), ', ') INTO server_roles FROM pg_policy p JOIN pg_roles r ON r.oid=ANY(p.polroles)
 WHERE p.polrelid='public.menu_items'::regclass AND p.polname='server_access';
 FOREACH tab IN ARRAY ARRAY['banners','banner_items','banner_images'] LOOP
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC',tab);
  FOR browser IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated') LOOP
   EXECUTE format('REVOKE ALL ON public.%I FROM %I',tab,browser);
  END LOOP;
  IF server_roles IS NOT NULL THEN
   EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO %s',tab,server_roles);
   EXECUTE format('CREATE POLICY server_access ON public.%I TO %s USING (true) WITH CHECK (true)',tab,server_roles);
  END IF;
 END LOOP;
END $$;
