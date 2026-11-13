# Canteen rewards and combos

Only the student (5173) and canteen (5174) apps are launched. The admin frontend is removed and `/api/v1/admin` returns 404. Historical accounts, orders and other canteen records are retained; the catalogue, cart eligibility and staff sessions restrict operation to Canteen.

Run `npm --prefix backend run provision:member-codes` once against the configured database to provision the configured canteen password (`CANTEEN_ACCESS_PASSWORD`, or the existing default). Changed credentials revoke previous staff sessions. This command now provisions Canteen only.

## Token rules

- Earn one token per ₹10, rounded down on each collected Canteen order. Historical collected orders count. Current payment-free test orders earn test rewards.
- Balance is derived on the server from persistent orders, independent of pagination or browser storage.
- The canteen configures menu items and whole token prices at `/canteen/rewards`. Students redeem an available item into a separate zero-value reward order. Tokens reserve immediately; staff rejection restores the original token cost. Rewards never earn tokens.
- Redemption locks the student and canteen, rechecks the session and balance, and uses an idempotency key so retries cannot double-spend.
- No expiry. The earning rate is fixed at one token per ₹10. Reward definitions are persisted, can be paused, and follow menu availability. The student milestone maximum is the minimum token price among currently available rewards. Price changes at checkout require the student to refresh and review. Original prices are saved on reward orders.

## Combos

Staff create named fixed bundles with explicit portions and one bundle price at `/canteen/combos`. These are normal persistent menu items in the Combos category, so existing cart validation, quotes, ordering, preparation, price editing and availability controls apply. Edit/archive/pause/delete them through Manage combos. Bundle contents are preparation descriptions rather than linked inventory: staff must pause the bundle when a component is unavailable.

## Banners

Managed promotional posters and themed menus are described in [BANNERS.md](BANNERS.md). The carousel uses one shared image on all devices, one slide at a time with swipe/dots and no auto-sliding. The owner controls posters, destinations, menus and publication from `/canteen/banners`.

## Manual acceptance

1. Provision member codes, sign into canteen with your name and the existing canteen password. Other canteen codes and the admin portal must be rejected.
2. Create a combo, check its price/contents on the student home and menu, then order it. Confirm the combined line appears in the staff queue. Pause it in Manage menu and verify new cart additions are blocked.
3. Collect orders totalling at least ₹1,000 of per-order qualifying spending. Refresh the student dashboard and check 100 tokens. Redeem a coffee and verify exactly one zero-value order appears, including when retrying an uncertain request.
4. Reject a reward and verify the 100 tokens return. Collect another reward and verify it earns no tokens.
5. Swipe all three banners on mobile; check arrow/dot controls with keyboard and newest-first ordering.

Apply the `20261109000100_reward_orders` migration before redeeming rewards; it permits zero-value reward orders while preserving the test payment constraint. Production payment integration remains separate.

## Configurable rewards update

Apply `20261109000200_configurable_rewards` to add persisted reward definitions and original token-price snapshots. Existing reward orders are backfilled at their original 100-token cost. New reward definitions start empty for the canteen to configure. All authenticated Canteen members share the existing management permissions.

The student homepage contains the complete menu with category filters and add-to-cart controls. Combo management is a separate route and no longer appears on the canteen dashboard.

## Rewards access permissions

The `20261113000100_rewards_server_access` migration grants the existing server-only menu policy roles access to rewards and enables row-level security. Run the normal migration deployment before serving this version. The application-role setup script also includes rewards for new environments. `backend/src/cli/check-rewards.ts` provides a read-only rewards and token-query check without printing student data.

## Single-canteen cleanup and caching

The active canteen now uses the generic `canteen` slug and display name. The migration retains its UUID, login hash, menu, rewards and order history. Retired posters and menu source files are removed; generic foreign fixtures are used only for authorization tests. The compatibility migration retains the former slug solely to identify the existing row. The original default login password remains in the server-only credential configuration.

Menus are cached in memory for 60 seconds in each frontend and 30 seconds in the API. Private reward/token reads are cached per signed-in account for 15 seconds in the frontend and 10 seconds in the API. Requests are deduplicated. Menu/reward events, successful writes, manual refresh and account changes invalidate or bypass caches; price and balance checks during submission always read the database. Neither token balances nor sessions are persisted in a shared browser cache. Cache state cannot be restored by an old in-flight request after invalidation.

The cart directly submits orders with inline checking/submitting status. The former checkout route redirects to the cart. Loaded notifications are marked read automatically in batches when the notifications page is opened. Active orders sit immediately above combos. Profiles omit account type.

## Incoming order sound

The canteen portal plays a short local Web Audio chime when a confirmed refresh discovers a new `RECEIVED` order. Normal login, pointer or keyboard interaction unlocks browser audio; no sound controls or indicators are displayed. Initial loads, repeat reads, old pages and status updates are silent. Order IDs are deduplicated in session storage per staff/canteen, with one chime per incoming batch. Live `orders-change` events refresh the scoped order list; visible polling remains the fallback. Suspended or blocked audio does not interrupt ordering or queue updates and does not queue old sounds for later playback.
