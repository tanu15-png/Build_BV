-- Keep UUIDs, menu ownership, access-code hashes and order history unchanged.
UPDATE canteens SET slug = 'canteen', name = 'Canteen', version = version + 1
WHERE slug = 'shanu';
UPDATE canteens SET accepting_orders = false, operational = false, version = version + 1
WHERE slug <> 'canteen' AND (accepting_orders OR operational);

UPDATE notifications SET message = regexp_replace(message, '^.* (has prepared|rejected|accepted) order ', 'The canteen \1 order ');
UPDATE notifications SET message = replace(message, 'Please choose another canteen or place a new order.', 'Please place a new order.');
