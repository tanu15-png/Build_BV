# Build BV — SpoonAte architecture

The backend implementation roadmap is in [backend/backend.md](backend/backend.md). It describes planned work; this architecture documents the current frontend prototype.

## Implemented system

```mermaid
flowchart TD
    UI[React + Vite frontend] --> Auth[AuthContext]
    UI --> Orders[OrderContext]
    Auth --> Session[sessionStorage: login per tab]
    Auth --> Accounts[localStorage: student accounts]
    Auth --> Codes[Temporary name-based canteen codes]
    Auth --> Members[localStorage: memberships and staff sessions]
    Orders --> Rules[Pure cart and order rules]
    Orders --> Storage[localStorage: carts, orders, availability]
    Storage --> Sync[storage events: update other tabs]
    Members --> Sync
    Orders --> Student[Student pages and notifications]
    Orders --> Canteen[Canteen orders, availability, pickup verification]
    Orders --> Admin[Campus-wide admin overview]
```

This repository currently has no backend API or database. Browser storage provides a same-browser test application. It does not provide production authentication, secure canteen membership, cross-device delivery, transactional updates, or payment processing. Simultaneous writes from multiple tabs use browser storage and can overwrite each other; a backend must provide transactional updates for production.

## Actual source structure

```text
Build_BV/
├── README.md
├── architecture.md
├── todo.md
├── scale.md
├── backend/backend.md
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── README.md
    ├── tests/orderRules.test.js
    └── src/
        ├── App.jsx
        ├── main.jsx
        ├── index.css
        ├── context/
        │   ├── AuthContext.jsx
        │   └── OrderContext.jsx
        ├── hooks/usePersistentState.js
        ├── utils/
        │   ├── authRules.js
        │   └── orderRules.js
        ├── data/
        │   ├── mockData.js
        │   └── canteenAccess.js
        └── pages/
            ├── Login.jsx
            ├── student/
            │   ├── StudentDashboard.jsx
            │   ├── CafePage.jsx
            │   ├── Cart.jsx
            │   ├── Checkout.jsx
            │   ├── OrderSuccess.jsx
            │   ├── MyOrders.jsx
            │   ├── OrderTracking.jsx
            │   ├── Notifications.jsx
            │   └── Profile.jsx
            ├── canteen/
            │   ├── CanteenDashboard.jsx
            │   ├── CanteenOrders.jsx
            │   ├── CanteenOrderDetails.jsx
            │   └── (unused screen stubs)
            └── admin/AdminDashboard.jsx
```

## Routes and ownership

| Route | Role | Behavior |
| --- | --- | --- |
| `/login` | Public | Student signup/email-password login, canteen membership login, admin login |
| `/student` | Student | Search the eight canteens and sample menus; view own active order |
| `/student/cafe/:cafeId` | Student | Browse one canteen's menu and availability |
| `/student/cart` | Student | Own single-canteen cart, quantities, removal, empty cart |
| `/student/checkout` | Student | Estimated pickup selection and test order submission |
| `/student/order-success?id=:id` | Student | Own submitted order UUID, daily pickup code and day |
| `/student/orders` | Student | Own active/completed orders |
| `/student/orders/:orderId` | Student | Own order progress |
| `/student/notifications` | Student | Own acceptance and readiness events |
| `/student/profile` | Student | Registered name and institutional email |
| `/canteen` | Canteen | Selected canteen's queue, acceptance, preparation, ready notification, availability, pickup, member list/removal |
| `/canteen/orders` | Canteen | Selected canteen's order history |
| `/canteen/orders/:orderId` | Canteen | Details and permitted status action for own order |
| `/admin/*` | Admin | Campus-wide overview and searchable orders |

`ProtectedRoute` reads the active auth context. `OrderContext` exposes only the student's orders/cart, the selected canteen's orders, or all orders for admin. Domain transition rules check staff role and canteen ownership again. Client-side checks are prototype behavior; the future API must repeat authorization for each request.

## Authentication

Student signup validates the exact `@banasthali.in` domain, a nonempty name and password, then saves a local account keyed by normalized email and returns to login. Login checks the registered email/password. Production signup must verify email ownership with an OTP before activating the account, persist only a salted server-side password hash and require a separate email/password login. Password reset requires a bound email OTP. New prototype session records omit the password; local account storage remains an insecure testing mechanism.

Canteen login requires a valid member email, selected canteen, and its matching code. The eight names are Mukteshwari's Canteen, Shanu's Canteen, Spicy Bites, Annapurna Canteen, Agarwal Canteen, Fun 'N' Frolic, Desi Jayka, and Bella Bite. Each current test code is exactly its canteen name. `canteenAccess.js` isolates this temporary mapping. Future manually supplied codes belong in the database, stored as hashes and checked by the backend; they must not be sent to clients.

Admin uses the existing demo email/password. Login is per-tab in `sessionStorage`, allowing separate student, canteen, and admin test tabs. The old demo login key is ignored.

## Storage model

| Key | Store | Contents |
| --- | --- | --- |
| `campusEatsSessionV2` | sessionStorage | Current tab's `{role, email, name, cafeId?, sessionId?}` or null; new sessions omit passwords |
| `campusEatsStudentsV2` | localStorage | Registered student profiles and plaintext test passwords keyed by normalized email |
| `campusEatsMembersV2` | localStorage | Canteen membership IDs/emails/status and revocation metadata |
| `campusEatsStaffSessionsV2` | localStorage | Staff session IDs, memberships, canteen context and 12-hour expiry |
| `campusEatsCartsV2` | localStorage | Cart item arrays keyed by student email |
| `campusEatsOrdersV2` | localStorage | All test orders |
| `campusEatsAvailabilityV2` | localStorage | `{pausedCafes: [...ids], disabledFoods: [...ids]}` |

Versioned keys avoid interpreting legacy unowned demo orders as orders from the new account system. Existing old storage is not deleted. The persistence hook subscribes to browser storage events for other tabs and a custom event for same-tab writes. Mutation callbacks read the current stored value. Checkout reads current availability and cart data before building an order.

An order stores:

- `id`: permanent UUID used for routes, mutations and notification identity. Legacy stored test orders retain their original IDs.
- `orderCode`: three uppercase alphanumeric characters, unique across all canteens within `codeDay`, including collected orders. Legacy records display their original ID as the code.
- `codeDay`: immutable allocation date (`YYYY-MM-DD`) in `Asia/Kolkata`; legacy records derive it from `createdAt`. A new namespace starts at campus midnight; history and late uncollected orders remain valid.
- `studentEmail`, `studentName`: the placing student's account.
- `cafeId`, `cafeName`: the cart's canteen.
- `items`: snapshot of food ID, name, quantity, and current menu price.
- `total`: sum of current unit prices multiplied by quantities.
- `pickupAt`: ISO timestamp chosen relative to submission; `pickupTime`: campus-time compatibility field. Order screens format `pickupAt` as a full campus date/time in IST, including older records.
- `createdAt`, `status`, `history`: creation and status change timestamps.
- `paymentStatus: NOT_REQUIRED_TEST`: no charge or simulated payment success.
- `pickupVerifiedBy`, `collectedAt`: added only after canteen verification.

`mockData.js` contains eight confirmed names and sample menus. Menu IDs are scoped to canteens. Exact locations, hours, menus, and prices await real canteen data.

## Student and canteen flow in testing

```mermaid
sequenceDiagram
    participant S as Student
    participant O as Shared order storage
    participant C as Selected canteen
    S->>O: Submit own single-canteen cart + estimated pickup
    O-->>S: RECEIVED order + UUID plus daily pickup code/day
    O-->>C: UUID, code/day, canteen, items, pickup, total
    C->>O: Accept: ACCEPTED
    O-->>S: Acceptance notification
    C->>O: Start preparation: PREPARING
    C->>O: Mark prepared: READY
    O-->>S: Ready notification and tracking update
    S->>C: Show dated order card at pickup
    C->>O: Select UUID and verify pickup code: COLLECTED
    O-->>S: Pickup confirmed
```

Allowed state progression is `RECEIVED → ACCEPTED → PREPARING → READY → COLLECTED`. Staff cannot skip states, reverse collection, or act for another canteen. Collection targets the permanent UUID and requires a matching pickup code on a ready order. Staff compare the allocation day, canteen and items on the dated student card with the selected order; code-only lookup is ambiguous across days. No cancellation, rejection/refund, or automatic expiry state is implemented. A student's estimate does not invalidate an uncollected order.

Notifications are derived from persisted `ACCEPTED` and `READY` history events. They appear in-app and update other same-origin tabs. There is no email, push, or background notification service yet.

Availability is independent of order state. A canteen may pause all incoming orders or disable an individual menu item. These changes block new additions, quantity increases, and checkout; existing orders retain item snapshots and continue fulfillment. Cross-canteen cart additions are blocked without silently clearing the student's cart.

## Future backend and payment design

The future Supabase-managed PostgreSQL database, accessed by Express/Prisma, should store users, canteens, member access code hashes, menu items and availability, orders, order items, and timestamped status events. Authorized operators will manually provision canteen codes in that database. The frontend will submit canteen selection and entered code to an authenticated membership endpoint instead of importing the mapping.

Backend order creation must validate ownership, one-canteen carts, availability, quantities, prices, and pickup time in a transaction. It must atomically allocate daily codes with `UNIQUE(code_day, code)` using server time and enforce state transitions and pickup verification. Browser persistence can then be replaced with API calls and a server event or polling subscription.

```mermaid
flowchart TD
    A[Submit order with internal reference] --> B[Canteen accepts]
    B --> C[Offer payment]
    C --> D[Backend verifies successful payment]
    D --> E[Assign public daily 3-character pickup code]
    E --> F[Prepare food]
    F --> G[Ready / notify student]
    G --> H[Canteen verifies pickup]
```

Payment occurs only after acceptance. Preparation in the paid release is gated on verified payment, and the public code is assigned/exposed only after payment succeeds within an immutable reserved campus day. Preserve the reservation day across midnight/payment retries. The internal UUID remains separate from the short pickup code. No cancellation or refund flow is part of the specified product. This is a future design; the current frontend skips payment and assigns the daily code at test submission. Browser code allocation uses device time and localStorage, so cross-device/concurrent uniqueness remains a backend requirement.

## Verification

`npm run test` runs Node tests for domain validation, signup/email-password login, membership codes, all eight canteens, single-canteen carts, availability checks, current-price totals, future pickup times, daily codes/collisions/exhaustion, midnight reuse, UUID identity, campus-time display, ownership, valid transitions, pickup verification and scoped member/session revocation. `npm run lint` checks frontend sources, and `npm run build` checks the complete module graph and production bundle.

### Canteen member management

`AuthContext` persists prototype memberships in `campusEatsMembersV2` and staff sessions in `campusEatsStaffSessionsV2`. Each session has a member ID and a 12-hour expiry. The dashboard shows own-canteen member emails, access status and valid session counts. Counts represent signed-in sessions rather than live presence; a closed tab can remain counted until expiry.

Confirmed removal marks a membership revoked, records actor/time, invalidates its sessions and blocks new login even with the shared code. Same-origin tabs react to browser storage events and their route guards drop revoked sessions. Member operations check the actor's canteen scope. The backend must implement real email OTP verification before staff session creation, shared session counts, atomic revocation and audited admin-only restoration. Browser records can be edited and are not production authorization.

## Plan alignment and current gaps

The chosen database host is Supabase PostgreSQL; application authentication remains in Express with Prisma persistence and opaque cookie sessions. Supabase Auth is not implemented or required by the current plan. Frontend/API/worker hosting is still an implementation decision. Follow [todo.md](todo.md) for pending integration and [scale.md](scale.md) for the unbenchmarked 30,000-account deployment.

Student signup/reset OTP and canteen login OTP screens/delivery, server password hashes, API contracts, database transactions, cross-device member revocation, admin restoration, notification read state and the unused menu/settings/analytics screens remain planned. The deployed backend cookie-session policy may use both absolute and idle expiry; the prototype has only a 12-hour staff expiry, refreshed in the UI every minute. Existing `campusEats*` keys and demo admin email remain compatibility identifiers for SpoonAte.
