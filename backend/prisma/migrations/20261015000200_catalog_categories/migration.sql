-- Preserve existing menus by promoting their category names to canteen-owned records.
CREATE TABLE menu_categories (
  id UUID PRIMARY KEY,
  canteen_id UUID NOT NULL REFERENCES canteens(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  archived BOOLEAN NOT NULL DEFAULT false,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  CONSTRAINT menu_categories_id_canteen_id_key UNIQUE (id, canteen_id),
  CONSTRAINT menu_categories_canteen_id_name_key UNIQUE (canteen_id, name)
);
CREATE UNIQUE INDEX menu_categories_name_folded_key ON menu_categories(canteen_id, lower(name));
INSERT INTO menu_categories (id, canteen_id, name)
SELECT gen_random_uuid(), canteen_id, min(btrim(category)) FROM menu_items GROUP BY canteen_id, lower(btrim(category));
ALTER TABLE menu_items ADD COLUMN category_id UUID;
UPDATE menu_items m SET category_id = c.id FROM menu_categories c
WHERE c.canteen_id = m.canteen_id AND lower(c.name) = lower(btrim(m.category));
ALTER TABLE menu_items ALTER COLUMN category_id SET NOT NULL;
ALTER TABLE menu_items ADD CONSTRAINT menu_items_category_scope_fkey
FOREIGN KEY (category_id, canteen_id) REFERENCES menu_categories(id, canteen_id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX menu_items_category_id_idx ON menu_items(category_id);
ALTER TABLE menu_items DROP COLUMN category;
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON menu_categories FROM PUBLIC;
-- Copy the existing server-only policy role(s), without hardcoding an operator's login.
DO $$ DECLARE r record; browser text; BEGIN
 FOR browser IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated') LOOP
  EXECUTE format('REVOKE ALL ON menu_categories FROM %I', browser);
 END LOOP;
 FOR r IN SELECT DISTINCT pr.rolname FROM pg_policy p
 JOIN pg_class t ON t.oid = p.polrelid
 JOIN pg_roles pr ON pr.oid = ANY(p.polroles)
 WHERE t.oid = 'public.menu_items'::regclass AND p.polname = 'server_access' LOOP
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON menu_categories TO %I', r.rolname);
  EXECUTE format('CREATE POLICY server_access ON menu_categories TO %I USING (true) WITH CHECK (true)', r.rolname);
 END LOOP;
END $$;
