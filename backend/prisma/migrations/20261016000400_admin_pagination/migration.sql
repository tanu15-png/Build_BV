CREATE INDEX orders_created_at_id_idx ON orders(created_at, id);
CREATE INDEX users_created_at_id_idx ON users(created_at, id);
CREATE INDEX canteen_memberships_joined_at_id_idx ON canteen_memberships(joined_at, id);
