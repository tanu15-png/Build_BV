ALTER TABLE orders ADD COLUMN rating INTEGER, ADD COLUMN rated_at TIMESTAMPTZ;
ALTER TABLE orders ADD CONSTRAINT orders_rating_valid CHECK (
  (rating IS NULL AND rated_at IS NULL) OR
  (rating IS NOT NULL AND rating BETWEEN 1 AND 5 AND rated_at IS NOT NULL AND status = 'COLLECTED')
);
