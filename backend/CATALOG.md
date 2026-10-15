# Catalog and persistent carts (Phases 5–6)

Staff open /canteen/menu to create categories such as Chinese/Snacks, add items, move items between active categories, edit prices/descriptions/HTTPS image URLs, toggle availability and archive/restore records. Categories are case-insensitively unique within a canteen. A category must have no active items before archival. A composite foreign key keeps each item within a category belonging to the same canteen. Historical order snapshots are preserved.

The category migration backfills legacy strings, copies the existing menu table's server-only role policy, enables RLS and denies browser database roles. The application-role script includes menu_categories. The db:check command expects twenty application tables.

Public reads: GET /catalog and GET /canteens/:id/menu. Staff management read: GET /canteens/:id/menu/manage. Writes: POST /canteens/:id/categories, PATCH /menu-categories/:id, POST /canteens/:id/menu, PATCH /menu-items/:id, PATCH /canteens/:id/availability and PATCH /canteens/:id/settings. Existing records require expectedVersion. Writes lock the canteen and recheck session/membership under that lock. Prices are integer paise up to ₹100,000; zero-price items are allowed.

Student cart APIs: GET /cart, POST /cart/items, PATCH /cart/items/:id, DELETE /cart/items/:id, DELETE /cart and POST /cart/review. All writes require the aggregate cart's expectedVersion; cart-line IDs differ from menu item IDs. POST quantities increment; PATCH quantities are absolute (1–99). At most 100 distinct lines, one canteen per nonempty cart, safe integer totals; reviews reject totals exceeding the order PostgreSQL integer range while keeping reductions/removals available. A student row lock serializes first-cart creation and later writes across devices; canteen locks synchronize availability/menu writes with additions/increases. Unavailable or archived items may still be reduced or removed. Removing the last item releases the canteen binding.

Responses contain current prices, availability, cart/item versions and HMAC-signed fifteen-minute quotes bound to student/cart/content/menu/category/canteen versions and total. POST /cart/review verifies a previously displayed quote against fresh server state. Stale versions/prices and invalid/expired quotes return 409 with the updated cart in error.details.cart. Phase 7 reuses verifyCartQuote inside the order transaction and atomically revalidates/locks ordering inputs. Review does not reserve items or place an order.

Frontend records refresh every thirty seconds, on focus, reconnect and successful writes. Failed writes never fall back to local storage. Legacy local carts/availability are discarded; historical browser orders remain separate. Transactional order placement and accept/prepare/ready are now implemented; see ORDERS.md.

## Verification

Run npm test and npm run typecheck. For database-backed tests, create a fresh isolated local PostgreSQL test database, then run npm run test:catalog with CATALOG_TEST_DATABASE_URL set to its local connection URL. The test refuses nonlocal/test URLs and applies committed migrations. Fixture sessions require no email delivery. Auth/schema suites use separate fresh AUTH_TEST_DATABASE_URL and TEST_DATABASE_URL databases. Never point these at the connected application database.
