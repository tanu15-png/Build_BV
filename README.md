# SpoonAte

A single-canteen preordering application with separate student and canteen dashboards.

Students can browse/search/filter the whole menu, order items and combos, track active orders, receive notifications, earn tokens on collected orders and redeem configurable rewards. Promotions show one swipeable poster at a time with a compact matching menu preview. Timed offers apply automatically to items or combos and can be configured independently or through the banner editor.

The canteen can manage menu items/categories, combos, rewards, offers, promotional posters and members, and fulfil orders through Accept → Prepare → Ready → Collected or reject an incoming order. New orders trigger a short sound after normal browser interaction. The admin dashboard and API are retired.

## Local development

Use Node 24 or newer. Install root workspaces and backend dependencies with `npm run setup`. Configure `backend/.env` from its example and student public Supabase build variables from its example. Apply migrations, restricted application-role grants and initialize the canteen as described in [DEPLOYMENT.md](DEPLOYMENT.md).

```bash
npm run dev
```

Student: `http://localhost:5173`; canteen: `http://localhost:5174`; API: port 4000. Separate sessions coexist in one browser. Student authentication uses Supabase; canteen entry uses a name and the agreed access code. No admin site is needed.

## Validation

```bash
npm run lint
npm test
npm run test:dev
npm run build
npm --prefix backend run build
npm --prefix backend test
```

For the full database integration suite, use backend `npm run test:integration:local` with `INTEGRATION_DATABASE_URL` pointing to a dedicated local test database. It creates and removes isolated suite databases. No real menu, orders or discounts are changed. Tests cover auth, menu/cart concurrency, order idempotency, fulfilment, token earning/redemption, offers, banners, notification recovery and historical snapshots.

## Data and behavior

Prices use integer paise. Checkout always validates current database prices and availability; changed or expired offers are reported in the cart before another submission. Orders retain immutable item/price/offer snapshots. Tokens earn at one token per ₹10 on each collected cash-priced order, rounded down per order. Reward orders reserve tokens immediately; rejected rewards restore them and reward collection earns no new tokens.

Menu and reward reads use scoped in-memory caches, live invalidation and scheduled offer/banner expiry refreshes. Financial writes always use database transactions. Pending cart/menu/order actions update independently and preserve safe retry behavior.

This is a **payment-free TEST ordering release**. No payment provider or money collection is implemented. See [OFFERS.md](OFFERS.md), [REWARDS.md](REWARDS.md), [BANNERS.md](BANNERS.md), and [backend/AUTH.md](backend/AUTH.md).

## Deployment

Use [DEPLOYMENT.md](DEPLOYMENT.md) and [Railway setup](deploy/RAILWAY.md). Deploy student, canteen, API and notification worker. Use one API replica, verified database TLS, a restricted application role, real SMTP, HTTPS origins, and backups. Production account/DNS/SMTP setup and actual HTTPS smoke tests remain operator release steps. Capacity for tens of thousands of simultaneous users has not been benchmarked.

For the prepared release and your remaining account steps, start with [deploy/START-HERE.md](deploy/START-HERE.md). Private per-service variables are generated under the ignored deploy/.production directory; never share or commit that directory.
