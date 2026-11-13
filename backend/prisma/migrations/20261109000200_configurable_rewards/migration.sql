ALTER TABLE orders ADD COLUMN reward_token_cost INTEGER;
UPDATE orders SET reward_token_cost = 100 WHERE execution_mode = 'REWARD';
ALTER TABLE orders ADD CONSTRAINT reward_token_cost_bounds CHECK (
  (execution_mode = 'REWARD' AND reward_token_cost > 0 AND reward_token_cost IS NOT NULL) OR
  (execution_mode <> 'REWARD' AND reward_token_cost IS NULL)
);
CREATE TABLE rewards (
  id UUID PRIMARY KEY,
  canteen_id UUID NOT NULL REFERENCES canteens(id) ON DELETE RESTRICT,
  menu_item_id UUID NOT NULL UNIQUE,
  token_cost INTEGER NOT NULL CHECK (token_cost BETWEEN 1 AND 1000000),
  active BOOLEAN NOT NULL DEFAULT true,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  FOREIGN KEY (menu_item_id, canteen_id) REFERENCES menu_items(id, canteen_id) ON DELETE CASCADE
);
