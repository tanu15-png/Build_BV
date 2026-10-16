-- Menu deletion detaches the optional link without altering historical snapshots.
ALTER TABLE order_items DROP CONSTRAINT order_items_menu_item_id_fkey;
ALTER TABLE order_items ADD CONSTRAINT order_items_menu_item_id_fkey
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE FUNCTION preserve_order_item_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF pg_trigger_depth() > 1
       AND OLD.menu_item_id IS NOT NULL AND NEW.menu_item_id IS NULL
       AND (to_jsonb(NEW) - 'menu_item_id') = (to_jsonb(OLD) - 'menu_item_id')
       AND NOT EXISTS (SELECT 1 FROM menu_items WHERE id = OLD.menu_item_id) THEN
      RETURN NEW;
    END IF;
  END IF;
  RAISE EXCEPTION 'Historical records are immutable' USING ERRCODE = '23514';
END;
$$;
DROP TRIGGER immutable_order_items ON order_items;
CREATE TRIGGER immutable_order_items BEFORE UPDATE OR DELETE ON order_items
  FOR EACH ROW EXECUTE FUNCTION preserve_order_item_snapshot();
