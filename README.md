# CampusEats --- Campus Food Pre-Ordering Web Application

CampusEats is a campus food pre-ordering platform designed to reduce
long queues and waiting time at college canteens. Students can discover
food, browse menus, place orders, pay through a supported UPI flow, and
collect their food. Canteens can manage menus and orders, set
preparation/pickup estimates, and track payment status. Administrators
can oversee the student and canteen experience, verify accounts, monitor
orders and payments, and manage the platform.

> **Project scope:** This README describes the intended product
> workflows and recommended features. Features such as college-email
> verification, admin approval, live menu updates, verified payment
> status, settlement reconciliation, rejection/refund rules, and
> notifications must be implemented and connected to a backend before
> they can be considered functional.

------------------------------------------------------------------------

## Table of Contents

1.  [Project Overview](#project-overview)
2.  [User Roles](#user-roles)
3.  [Student Workflow](#student-workflow)
4.  [Canteen Workflow](#canteen-workflow)
5.  [Admin Workflow and Features](#admin-workflow-and-features)
6.  [Order Lifecycle and Statuses](#order-lifecycle-and-statuses)
7.  [Payment, Canteen Receipts, and
    Settlement](#payment-canteen-receipts-and-settlement)
8.  [Order Acceptance and Refund Policy](#order-acceptance-and-refund-policy)
9.  [Suggested Screens](#suggested-screens)
10. [Suggested Data Model](#suggested-data-model)
11. [Important Edge Cases](#important-edge-cases)
12. [Security and Reliability](#security-and-reliability)
13. [Acceptance Criteria](#acceptance-criteria)
14. [Future Enhancements](#future-enhancements)

------------------------------------------------------------------------

# 1. Project Overview

CampusEats helps students order food before reaching the canteen,
reducing queues and making pickup more organized.

### Core capabilities

-   Students register/sign in using only a Gmail address ending in `@banasthali.in` and their name. Login is email-based.
-   Canteen members sign in using their registered Gmail and select the canteen they represent. Access requires that canteen’s secret code and admin approval.
-   Students search food items or canteens, browse menus, filter
    results, and manage a cart.
-   Students check out and pay through a supported UPI flow, such as
    Google Pay or Paytm.
-   Canteens manage menu items, view incoming orders, set estimated
    preparation/pickup times, and update order statuses.
-   Canteens can see whether a payment is pending, successful, failed,
    or refunded, and---where the payment provider supports it---whether
    funds have been settled to their account.
-   Students can view order progress, and receive a notification when the order is ready.
-   Admins oversee users, canteens, menus, orders, payments, refunds for rejected orders, and platform performance.

## 2. User Roles

### Student

-   Register/sign in with their name and a Gmail address ending in `@banasthali.in`; login is email-based.
-   Search food and canteens, browse menus, and apply filters.
-   Add/remove items and change quantities.
-   Place and pay for pre-orders.
-   View order status, pickup estimate, and payment status.
-   receive a ready-for-pickup notification.

### Canteen

-   Sign in with registered email, select the canteen they represent, and enter that canteen’s secret access code.
-   Access the dashboard after admin verification.
-   Add, edit, mark unavailable, or remove menu items.
-   View and process orders for its own canteen.
-   Set preparation/pickup estimates.
-   Update order statuses through delivery/collection.
-   View payment status and payment/settlement records for its orders.

### Admin

-   Verify, approve, reject, or suspend canteen accounts.
-   View overall student, canteen, order, and payment activity.
-   Manage accounts, canteens, and platform settings.
-   Monitor order fulfillment, rejected-order refunds, payment issues, and reports.
-   Help resolve disputes and operational problems through controlled
    actions and audit logs.

------------------------------------------------------------------------

# 3. Student Workflow

## 3.1 Student Sign-up and Login

1. Student opens CampusEats and enters their name and Gmail address ending in `@banasthali.in`.
2. The system validates the email domain and verifies email ownership.
3. Login is performed using the registered email-based authentication flow.
4. Successful login opens Student Home. Emails outside `@banasthali.in` are not accepted.

Recommended safeguards: clear login errors, college email verification,
account recovery if password login is used, and no plain-text password
storage.

## 3.2 Student Home Screen

The Home screen should include: - Student greeting/profile name. -
Search bar for food item and canteen names. - Food categories and
filters. - Popular/recommended items, if available. - Browse-canteens
option. - Cart icon with item count. - Current/recent orders shortcut. -
Profile and logout access.

## 3.3 Search and Canteen Menu

### Banasthali Canteen Directory

The app should display the following canteens in a searchable directory:

- Mukteshwari's Canteen
- Shanu's Canteen
- Spicy Bites
- Annapurna Canteen
- Agarwal Canteen
- Fun 'N' Frolic
- Desi Jayka

Each entry should include the canteen name, location, operating status, and menu.

Students can search for: - Food item, e.g. *Masala Dosa*. - Canteen
name, e.g. *Central Café*. - Category, e.g. snacks, meals, beverages, if
supported.

When a student selects a canteen: 1. Open the canteen page. 2. Display
its name, location/pickup point, opening hours, and ordering
availability. 3. Display its available menu. 4. Show item name, price,
image (if available), category, and availability. 5. Allow item details
and add-to-cart actions.

If an item is available at multiple canteens, show the canteen and price
for each result.

## 3.4 Filters and Sorting

Possible filters: - Food category. - Price range. - Availability. -
Dietary labels, if provided.

Optional sorting: - Price low-to-high or high-to-low. - Item name. -
Popularity, if reliable data is available.

Show active filters and a **Clear filters** action. If no result
matches, show a helpful empty state.

## 3.5 Cart and Quantity Management

Students can: - Add an available item. - Increase/decrease quantity. -
Remove an item. - View unit price, quantity, and line total.

Rules: - Do not allow quantity below 1 for an item remaining in the
cart. - Respect item-level quantity limits. - Recalculate totals
immediately. - Prevent unavailable items from being added.

Cart summary: - Item name and canteen. - Unit price, quantity controls,
line total, remove action. - Subtotal, applicable fees/taxes/discounts,
and final payable amount.

Students should be able to continue browsing without losing cart
selections. Re-check price and availability before checkout. If
mixed-canteen carts are not supported, explain the restriction;
otherwise split orders and show separate pickup details.

## 3.6 Checkout

When the student taps **Proceed to Pay**: 1. Validate that the cart is
not empty. 2. Re-check prices, availability, and quantity limits. 3.
Display order summary, canteen, pickup location, and payable amount. 4.
Create a pending order/payment reference on the backend. 5. Start the
configured payment flow.

Allow the student to go back and edit the cart before payment.

## 3.7 UPI Payment

The intended experience is to open a compatible UPI app, such as Google
Pay or Paytm, with payment details and amount prefilled where supported.

**Opening a UPI app does not confirm payment.**

Recommended sequence: 1. Create a unique order/payment reference. 2.
Launch supported UPI intent or payment-provider checkout. 3. Student
completes or cancels payment in the payment app. 4. Verify the result
through a trusted provider/backend mechanism. 5. Confirm the order only
after payment is verified.

Handle successful, failed, cancelled, pending, and unknown payment
states. If a UPI app is unavailable, offer a supported fallback. Never
ask for or store the student's UPI PIN in CampusEats.

## 3.8 Order Confirmation and Pickup

After verified payment: - Generate a unique three-character alphanumeric order ID (for example, `AZ1` or `B7J`) and show order success. -
Display canteen, pickup location, items, quantities, amount paid, and
status. - Show estimated preparation/pickup time. - Make order details
available in **My Orders**. - Show **Ready for Pickup** when the canteen
updates the order. - After handover, the canteen marks the order
**Delivered/Collected**.

------------------------------------------------------------------------

# 4. Canteen Workflow

## 4.1 Canteen Login, Selection, and Secret Code

1. Canteen member opens CampusEats and signs in with their registered email.
2. Member selects the canteen they represent.
3. Member enters that canteen’s secret access code. Each canteen has its own code, shared only with its authorized members.
4. The system verifies the code, account status, and admin approval before opening that canteen’s dashboard.
5. Members can access only the selected canteen’s menu, orders, and payment details.
6. Admins can rotate/revoke codes when needed; codes must be stored securely and never displayed publicly.

Recommended safeguards: - Verify ownership of the registered email or
phone number. - Store verification and permissions on the backend. -
Prevent bypassing admin approval through client-side changes. - Provide
a contact process for pending/rejected verification.

## 4.2 Canteen Dashboard

The dashboard should include an **Accepting Orders / Pause Incoming Orders** control. When paused, no new orders can be placed at that canteen; existing accepted orders remain visible. The dashboard should show: - Canteen name and account status. - **Add
Your Menu / Manage Menu**. - New/incoming orders. - Accepted/in-progress
orders. - Ready-for-pickup orders. - Delivered/completed orders. -
Payment summary and payment/settlement statuses. - Order details and
pickup estimates. - Controls to update order status. - Logout/profile
access.

Counts and lists should come from live backend data, not fixed demo
values.

## 4.3 Add, Edit, and Remove Menu Items

For each item, the canteen may enter: - Name and optional description. -
Price. - Category. - Optional image. - Availability. - Optional
stock/quantity limit. - Optional preparation-time estimate. - Optional
dietary labels/customization choices.

The canteen can: - Add new items. - Edit item details and prices. - Mark items unavailable or available. - Remove items from the active menu. - Temporarily disable ordering for the entire canteen or pause a particular item at its convenience.

Validation and behavior: - Name and valid price are required. - Show
save success/error messages. - Only the owning canteen can manage its
menu. - Confirm permanent deletion. - Preserve historical order item
details if an item is later removed. - If an item becomes unavailable
while in a student's cart, inform the student and prevent checkout until
updated.

## 4.4 View and Process Student Orders

For each order, display prominently: - Three-character order ID (e.g. `AZ1`, `B7J`). - Ordered item names and quantities. - Student details needed for fulfillment. - Order total and payment
status. - Order placement time. - Estimated pickup time/deadline. -
Current order status. - Relevant notes/customizations, if supported.

Canteen staff can open an order, review it, accept it (if acceptance is
used), and update its progress. A canteen can only access its own
orders.

## 4.5 Set Preparation/Pickup Time

1. Student selects an estimated pickup time during checkout.
2. After payment is verified, the order appears on the canteen dashboard.
3. Canteen accepts or rejects the order.
4. If accepted, the canteen prepares it and may update the estimated ready time.
5. When prepared, the canteen marks **Ready for Pickup** and the student is notified.

Clearly distinguish an estimated ready time from a firm pickup deadline.
The student and canteen must see the same timing rule.

## 4.6 Update Order Status

Suggested actions: - **Accept Order** --- canteen confirms it can fulfill the paid order. - **Reject Order** --- canteen cannot fulfill it; trigger a full refund. - **Preparing** --- food preparation has started. -
**Ready for Pickup** --- student can come to collect the order. -
**Delivered/Collected** --- order has been handed to the student.

After handing over the food, staff must verify pickup (for example, by checking the student’s order ID) and change the status on the canteen dashboard to **Delivered/Collected**. The student's order screen should
update accordingly. Record status changes and timestamps where
supported.

## 4.7 Payment Status and Canteen Account Receipts

The canteen dashboard must show payment information for each order so
staff can distinguish an order that is paid from one that is not.

For each order, display: - Payment status: **Pending**,
**Paid/Verified**, **Failed**, **Cancelled**, **Refund Pending**, or
**Refunded**. - Amount paid and currency. - Payment method/provider
(e.g. UPI, where available). - Transaction/payment reference, suitably
masked if needed. - Payment verification time. - Refund status and
amount, if applicable. - Settlement status: **Not Settled**,
**Settlement Pending**, **Settled**, or **Settlement Failed**, when the
payment provider supplies settlement information.

### Important distinction: payment vs. settlement

-   **Payment received/verified** means the payment provider confirms
    that the student's transaction succeeded.
-   **Settlement to canteen account** means the payment provider has
    transferred or credited the funds to the canteen's configured
    bank/account destination.
-   These are not necessarily simultaneous. The dashboard must not claim
    that money has reached the canteen's account unless the
    provider/bank settlement information confirms it.

A canteen payment page should ideally include: - Total paid orders and
total verified amount for a selected period. - 
Settlement pending amount. - Settled amount and settlement
date/reference, if available. - Per-order payment details. - A
date/status filter and downloadable report, if supported.

Do not show sensitive bank details or payment credentials. Use the
payment provider's verified records rather than trusting a client-side
success message.

## 4.8 Order Acceptance and refund

- Payment is mandatory before an order appears on the canteen dashboard.
- The canteen may accept or reject a paid order.
- If the canteen accepts the order, it cannot be cancelled and no refund is provided.
- If the canteen rejects the order, the student receives a full refund through the payment provider.
- Students cannot cancel an order after payment.

------------------------------------------------------------------------

# 5. Admin Workflow and Features

The admin panel is the central management area for the web application.
It should let authorized admins monitor the overall student and canteen
workflows, handle verification, and identify operational or payment
issues. Admins should have visibility into the platform without being
able to silently alter payment records.

## 5.1 Admin Login and Role-Based Access

-   Admin signs in through a separate, secure admin authentication flow.
-   Only authorized admin accounts can access the admin panel.
-   Use role-based permissions for sensitive actions.
-   Require stronger authentication (such as MFA) where feasible.
-   Record sensitive admin actions in an audit log.

## 5.2 Admin Overview Dashboard

The main dashboard should provide a high-level snapshot, with date
filters such as today, this week, and a custom range.

Suggested summary cards: - Total registered students. - Active
students. - Total registered canteens. - Canteens pending
verification. - Canteens currently active/accepting orders. - Orders
placed today. - Orders awaiting canteen acceptance. - Orders being
prepared. - Orders ready for pickup. - Completed/delivered orders. -
Rejected orders. - Payments verified. - Payments
pending/failed. - Refunds pending. - Settlement pending, if provider
data is available.

Dashboard charts/tables may show order volume by time, canteen, order
status, and payment status. All metrics should be based on backend
records and clearly identify the selected date range.

## 5.3 Student Management

Admin should be able to: - View the student directory with appropriate
limited fields. - Search students by name, college email, or student ID,
where permitted. - View account status and registration date. -
Activate, suspend, or restore accounts according to policy. - Review a
student's order history when needed for support, with appropriate access
controls. - Handle account reports or support requests.

Avoid exposing unnecessary personal information. Admin actions affecting
a student account should be logged.

## 5.4 Canteen Verification and Management

Admin should be able to: - View new canteen registration requests. -
Review canteen name, registered email/phone, location, and submitted
verification information. - Approve or reject a request with a reason. -
Suspend or reactivate a canteen account. - View verification status and
account history. - Search/filter canteens by name, status, or
location. - View each canteen's menu, order activity, and payment
summaries for operational support. - Update or correct canteen metadata
through controlled actions.

Only verified and active canteens should appear as orderable options to
students.

## 5.5 Menu Oversight

Admin should be able to: - View menus across registered canteens. -
Search/filter menu items by canteen, category, availability, or item
name. - Identify inactive or unavailable items. - Disable an item or
menu only for a documented operational/safety reason and with an audit
record. - Avoid changing a canteen's price or menu content without
authorization and a recorded reason.

The canteen remains responsible for its own menu updates.

## 5.6 Order Management and Live Monitoring

Admin should be able to: - View all platform orders with filters for
date, student, canteen, order ID, status, and payment status. - Open
order details: items, quantities, amounts, timestamps, pickup estimate,
and status history. - Monitor orders awaiting acceptance, preparing,
ready for pickup, completed, rejected. - Identify orders
that have been waiting unusually long or have exceeded the pickup
estimate. - View the rejection reason and relevant timeline. - Review
an order's payment status and refund status. - Contact/route an issue to
the relevant canteen or support workflow.

**Recommended safeguard:** admins should not casually mark orders as
paid, delivered, or refunded. Exceptional corrections should require
specific permission, a reason, and an audit trail. Payment confirmation
must come from trusted payment records.

## 5.7 Payment and Settlement Monitoring

Admin should have a financial operations section with: - Payment records
linked to order IDs. - Payment status, amount, provider, transaction
reference, and verification time. - Failed, pending, or unknown payment
transactions requiring review. - Refund requests and refund status. -
Canteen-wise verified payment totals. - Settlement status and settlement
references, if provided by the payment provider. - Reconciliation view
comparing order totals, verified payments, refunds, and provider
settlement records. - Date filters and exportable reports for authorized
roles.

### Financial status definitions

-   **Payment Pending:** payment has not been confirmed.
-   **Paid/Verified:** provider confirms payment success.
-   **Refund Pending / Refunded:** refund is awaiting completion /
    completed.
-   **Settlement Pending:** funds are not yet confirmed as transferred
    to the canteen.
-   **Settled:** provider records confirm settlement to the configured
    canteen account.
-   **Settlement Failed/Exception:** settlement needs review.

Do not treat an order's "Paid" status as proof that the canteen's bank
account has already received the money. Settlement visibility depends on
the chosen payment provider and integration.

## 5.8 Rejected Orders and Refunds

Admin should be able to: - View rejected orders by student, canteen,
reason, and status. - Review disputes such as "paid but order not
confirmed," "order not received," or "refund not received." - View
related order/payment events and timestamps. - Track refund requests and
provider refund status. - Escalate issues to the payment provider or
authorized finance staff. - Record resolution notes and communicate the
outcome.

Refunds should be initiated only through the authorized payment-provider
process. The admin panel should not claim a refund is complete until the
provider confirms it.

## 5.9 Reports and Analytics

Suggested reports: - Orders by day/week/month. - Orders by canteen and
order status. - Peak ordering times and average preparation/ready
time. - Average time from order placement to acceptance, ready, and
collection. - Cancellation and rejection rates. - Popular menu items,
based on actual order data. - Payment success/failure/pending counts. -
Refund totals and settlement summaries. - Student usage/active-user
trends. - Canteen activity and menu availability.

Reports should support date filters and CSV export for authorized
admins. Avoid exposing personal data in aggregate reports unless
necessary.

## 5.10 Platform Settings

Admin may configure: - Approved college email domain(s) or student
verification method. - Canteen registration and verification
requirements. - Order acceptance and status-transition rules. - The
30-minute rejection/refund policy and its start point. - Whether
cancellation is allowed before/after preparation begins. -
Refund/rejection/refund policy text. - Pickup-time display rules. -
Notification templates and system announcements. - Platform fee/tax
settings, if applicable and legally/contractually configured. -
Maintenance mode or temporary ordering pause. - Support contact details.

Changes to payment, rejection, or fee settings should be
permission-controlled and logged.

## 5.11 Notifications and Support

Admin tools may include: - Send a platform-wide announcement
(e.g. planned maintenance). - Notify affected students about a canteen
outage or order disruption. - View support tickets or reports. - Assign
issues to an authorized admin/support person. - Track ticket status and
resolution.

Avoid sending unnecessary notifications or exposing one user's
information to another.

## 5.12 Admin Audit Log

Maintain an audit trail for sensitive actions, including: - Canteen
approval/rejection/suspension. - Student account
suspension/restoration. - Order corrections or exceptional status
changes. - Refund initiation/administrative decisions. - Platform
setting changes. - Menu disable actions. - Admin role/permission
changes.

Each record should include the acting account, action, timestamp,
affected record, and reason where applicable. Logs should be protected
against ordinary user modification.

------------------------------------------------------------------------

# 6. Order Lifecycle and Statuses

Suggested lifecycle:

``` text
Pending Payment
      ↓
Payment Verified
      ↓
Order Confirmed / New Order
      ↓
Accepted by Canteen
      ↓
Preparing
      ↓
Ready for Pickup
      ↓
Delivered / Collected
```

Possible alternate outcomes: - Payment Failed - Payment Cancelled -
Payment Pending - Order Rejected - Refund Pending - Refunded

Define allowed status transitions. A completed order should not return
to "Preparing" through an ordinary status button.

------------------------------------------------------------------------

# 7. Payment, Canteen Receipts, and Settlement

## Payment status vs. settlement status

These are separate concepts:

-   **Payment status** indicates whether the student's payment
    transaction succeeded and was verified.
-   **Settlement status** indicates whether the payment provider has
    transferred the funds to the canteen's configured account.

A verified payment may still be awaiting settlement. Show both statuses
separately wherever the integration provides settlement data.

## Recommended payment lifecycle

``` text
Student starts payment
        ↓
Payment Pending
        ↓
Provider confirms payment
        ↓
Payment Verified / Order Confirmed
        ↓
Provider settlement process
        ↓
Settlement Pending → Settled (or Settlement Exception)
```

For failed/cancelled payments, do not confirm the order as paid. For
refunds, track refund initiation and provider-confirmed completion
separately.

## Payment records should include

-   Order ID and payment reference.
-   Amount and currency.
-   Payment provider/method.
-   Transaction reference.
-   Payment status and verification time.
-   Refund status and amount, if applicable.
-   Settlement status, amount, date, and provider reference, if
    available.

Never store UPI PINs or payment credentials. Keep provider secrets on
the backend and use verified provider records.

------------------------------------------------------------------------

# 8. Order Acceptance and Refund Policy

Payment must be verified before an order is shown on the canteen dashboard. If the canteen accepts the order, it is final and cannot be cancelled or refunded. If the canteen rejects the order, a full refund is initiated and its status is shown to the student. Refund completion depends on the payment provider. Students cannot cancel orders.

------------------------------------------------------------------------

# 9. Suggested Screens

## Student

1.  Login / Sign-in.
2.  Student Home.
3.  Search Results.
4.  Canteen Details and Menu.
5.  Food Item Details.
6.  Cart.
7.  Checkout.
8.  Payment Status.
9.  Order Confirmation.
10. My Orders.
11. Order Details and pickup status.
12. Profile / Settings.

## Canteen

1.  Canteen Login.
2.  Verification Pending / Account Status.
3.  Canteen Dashboard.
4.  Add Menu Item.
5.  Edit Menu Item / Manage Menu.
6.  Orders Dashboard.
7.  Order Details.
8.  Set/Edit Preparation or Pickup Time.
9.  Update Order Status.
10. Payment and Settlement Dashboard.
11. Completed Orders / Order History.
12. Account / Logout.

## Admin

1.  Admin Login.
2.  Overview Dashboard.
3.  Student Management.
4.  Canteen Verification Queue.
5.  Canteen Management and Details.
6.  Menu Oversight.
7.  All Orders / Order Details.
8.  Payment and Settlement Monitoring.
9.  Rejected Orders and Refunds.
10. Reports and Analytics.
11. Platform Settings.
12. Notifications / Support.
13. Audit Log.

------------------------------------------------------------------------

# 10. Suggested Data Model

This is a suggested outline, not a claim that these database tables
already exist.

### Student

-   Student ID, name, college email, verification status, account
    status.

### Canteen

-   Canteen ID, name, registered email/phone, verification status,
    active status, location, opening hours, settlement destination
    reference (stored securely with provider; do not expose sensitive
    details).

### Menu Item

-   Item ID, canteen ID, name, description, price, category, image URL,
    availability, optional stock and preparation estimate.

### Order

-   Order ID, student ID, canteen ID, item/quantity snapshots, subtotal,
    fees, total, payment status, order status, timestamps, pickup
    estimate, rejection details.

### Payment

-   Payment reference, order ID, amount, provider/method, transaction
    reference, payment status, verification timestamps, refund details,
    settlement details where available.

### Order Status History

-   Order ID, previous status, new status, timestamp, actor/account ID,
    optional note.

### Canteen Verification

-   Canteen ID, submitted details, verification status, reviewer/admin
    ID, decision timestamp, reason.

### Admin Audit Log

-   Actor/admin ID, action, affected entity, timestamp, reason, relevant
    metadata.

------------------------------------------------------------------------

# 11. Important Edge Cases

  -----------------------------------------------------------------------
  Situation                           Expected behavior
  ----------------------------------- -----------------------------------
  Canteen account not verified        Show pending/rejected status and
                                      block dashboard access.

  Invalid login                       Show a clear error without exposing
                                      sensitive account data.

  Menu item fails to save             Show error/retry and preserve safe
                                      entered data.

  Item becomes unavailable            Prevent checkout and notify
                                      students with the item in cart.

  Search has no match                 Show empty state and allow clearing
                                      query.

  Canteen is closed                   Show status and prevent invalid
                                      ordering.

  Price changes before checkout       Show updated price and ask student
                                      to review.

  Payment fails/cancels               Do not mark paid; allow safe retry
                                      if appropriate.

  Payment is pending/unknown          Verify existing transaction before
                                      another attempt.

  Payment succeeds but app misses     Reconcile with provider/backend and
  callback                            update status after verification.

  Canteen sees paid but funds not     Show Paid/Verified and Settlement
  settled                             Pending separately.

  Settlement fails                    Show exception and make it visible
                                      to authorized admin/finance staff.

  Canteen rejects paid order          Initiate full refund and update order/payment status.

  Canteen accepts paid order          Mark order final; disable cancellation and refund actions.

  Canteen changes ready time          Update student-facing estimate and
                                      notify if enabled.

  Student misses pickup estimate      Show order status and contact/support guidance; do not cancel automatically.

  Canteen marks delivered             Update student and admin views.

  Network fails                       Do not show false success; refresh
                                      status when online.

  Duplicate taps                      Prevent duplicate orders, payment
                                      attempts, and status transitions.
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 12. Security and Reliability

-   Use secure authentication for students, canteens, and admins.
-   Enforce canteen admin verification on the backend.
-   Enforce role-based authorization on every protected endpoint.
-   Canteens can only manage their own menu/orders/payments.
-   Students can only access their own account and orders.
-   Validate prices, quantities, availability, and totals on the
    backend.
-   Verify payments and settlement status through trusted provider
    records.
-   Never store passwords or UPI PINs in plain text.
-   Keep payment secrets out of the client application.
-   Use HTTPS in production.
-   Use unique order/payment references and idempotency protections.
-   Record important order, payment, settlement, and admin actions.
-   Limit access to personal and financial information.
-   Define rejection, refund, data-retention, and support policies.

------------------------------------------------------------------------

# 13. Acceptance Criteria

## Student

-   [ ] Student can sign in through the configured college-approved
    process.
-   [ ] Login opens Student Home.
-   [ ] Search finds food items and canteens.
-   [ ] Selecting a canteen displays its menu and availability.
-   [ ] Filters work and can be cleared.
-   [ ] Student can add/remove items and change quantities.
-   [ ] Cart totals update correctly.
-   [ ] Checkout validates prices and availability.
-   [ ] Proceed to Pay starts the configured UPI/payment flow.
-   [ ] Payment is verified before order confirmation.
-   [ ] Student can view order ID, status, and pickup estimate.
-   [ ] Student cannot cancel a paid order.
-   [ ] Student sees updated canteen status changes.

## Canteen

-   [ ] Canteen can sign in with registered Gmail or phone.
-   [ ] Unverified canteens cannot access the dashboard.
-   [ ] Admin can approve/reject canteen accounts.
-   [ ] Canteen can add/edit/mark unavailable/remove menu items.
-   [ ] Canteen can view its orders and order details.
-   [ ] Canteen can set/update preparation and pickup estimates.
-   [ ] Canteen can update order status through Delivered/Collected.
-   [ ] Canteen can see verified payment status for each order.
-   [ ] Canteen can distinguish payment status from settlement status.
-   [ ] Settlement information is shown only when confirmed by the
    provider.
-   [ ] Canteen cannot access another canteen's records.

## Admin

-   [ ] Admin can securely sign in to the admin panel.
-   [ ] Admin can view overall student, canteen, order, and payment
    activity.
-   [ ] Admin can verify, reject, suspend, and reactivate canteen
    accounts.
-   [ ] Admin can search/filter student and canteen records with
    appropriate access.
-   [ ] Admin can monitor order statuses and delayed orders.
-   [ ] Admin can view payment, refund, and settlement statuses.
-   [ ] Admin can review rejected-order/refund cases.
-   [ ] Admin can access date-filtered reports.
-   [ ] Sensitive admin actions are logged.
-   [ ] Admin cannot falsely mark a payment or settlement as confirmed
    without verified records.

## Platform

-   [ ] Payment failures, pending results, refunds, and settlement
    exceptions are handled safely.
-   [ ] Network and validation errors are clear.
-   [ ] Order status history is consistent across roles.
-   [ ] Accepted orders cannot be cancelled; rejected paid orders trigger a full refund.

------------------------------------------------------------------------

# 14. Future Enhancements

-   Push notifications for order acceptance, preparation,
    ready-for-pickup, rejection, and delivery.
-   QR/pickup code for handover verification.
-   Scheduled pickup slots.
-   Stock/inventory management.
-   Favorites and reorder from history.
-   Ratings and feedback.
-   Offers and student discounts.
-   Menu availability scheduling.
-   Canteen performance insights.
-   Additional payment methods, subject to provider support.
-   Live queue or preparation-time estimates.

------------------------------------------------------------------------

## Summary

CampusEats is a campus pre-ordering platform with three connected
workflows:

-   **Student:** sign in, search/filter food and canteens, manage cart,
    pay through a supported UPI flow, track the order, and collect it.
-   **Canteen:** sign in after admin verification, manage menu items,
    view orders, set preparation/pickup estimates, update delivery
    status, and check verified payment and settlement status.
-   **Admin:** oversee students, canteens, menus, orders, payments,
    settlements, rejected orders, refunds, reports, and platform settings.

The key operational principles are accurate live order status, verified
payment information, a clear distinction between payment and settlement,
and a clear rejection-only refund policy.
