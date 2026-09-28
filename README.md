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
> status, settlement reconciliation, cancellation/refund rules, and
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
8.  [Cancellation and 30-Minute Rule](#cancellation-and-30-minute-rule)
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

-   Students sign in using their college-registered Gmail account.
-   Canteens sign in using a registered Gmail address or phone number
    after admin verification.
-   Students search food items or canteens, browse menus, filter
    results, and manage a cart.
-   Students check out and pay through a supported UPI flow, such as
    Google Pay or Paytm.
-   Canteens manage menu items, view incoming orders, set estimated
    preparation/pickup times, and update order statuses.
-   Canteens can see whether a payment is pending, successful, failed,
    or refunded, and---where the payment provider supports it---whether
    funds have been settled to their account.
-   Students can view order progress and pickup information.
-   Admins oversee users, canteens, menus, orders, payments,
    cancellations, and platform performance.

## 2. User Roles

### Student

-   Sign in with a college-approved account.
-   Search food and canteens, browse menus, and apply filters.
-   Add/remove items and change quantities.
-   Place and pay for pre-orders.
-   View order status, pickup estimate, and payment status.
-   Cancel an order when the configured policy allows it.

### Canteen

-   Sign in using a registered Gmail address or phone number.
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
-   Monitor order fulfillment, cancellations, payment issues, and
    reports.
-   Help resolve disputes and operational problems through controlled
    actions and audit logs.

------------------------------------------------------------------------

# 3. Student Workflow

## 3.1 Student Login

1.  Student opens CampusEats.
2.  Student signs in using their college-registered Gmail account
    through the configured authentication process.
3.  The system verifies that the account is authorized for student
    access.
4.  Successful login opens the Student Home screen.
5.  The session may remain active securely until logout or expiration.

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

After verified payment: - Show order success and a unique order ID. -
Display canteen, pickup location, items, quantities, amount paid, and
status. - Show estimated preparation/pickup time. - Make order details
available in **My Orders**. - Show **Ready for Pickup** when the canteen
updates the order. - After handover, the canteen marks the order
**Delivered/Collected**.

------------------------------------------------------------------------

# 4. Canteen Workflow

## 4.1 Canteen Login and Admin Verification

1.  Canteen opens CampusEats.
2.  Canteen signs in using its registered Gmail address or phone number.
3.  The account must be registered and verified by an admin.
4.  The system checks verification and active status.
5.  Only an approved canteen can access its dashboard.
6.  Unverified accounts see a pending/rejected message and cannot manage
    orders or menus.
7.  Canteen can log out.

Recommended safeguards: - Verify ownership of the registered email or
phone number. - Store verification and permissions on the backend. -
Prevent bypassing admin approval through client-side changes. - Provide
a contact process for pending/rejected verification.

## 4.2 Canteen Dashboard

The dashboard should show: - Canteen name and account status. - **Add
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

The canteen can: - Add new items. - Edit item details and prices. - Mark
items unavailable or available. - Remove items from the active menu.

Validation and behavior: - Name and valid price are required. - Show
save success/error messages. - Only the owning canteen can manage its
menu. - Confirm permanent deletion. - Preserve historical order item
details if an item is later removed. - If an item becomes unavailable
while in a student's cart, inform the student and prevent checkout until
updated.

## 4.4 View and Process Student Orders

For each order, display: - Order ID/reference. - Student details needed
for fulfillment. - Items and quantities. - Order total and payment
status. - Order placement time. - Estimated pickup time/deadline. -
Current order status. - Relevant notes/customizations, if supported.

Canteen staff can open an order, review it, accept it (if acceptance is
used), and update its progress. A canteen can only access its own
orders.

## 4.5 Set Preparation/Pickup Time

1.  Open a new order and review items/quantities.
2.  Accept the order, if required.
3.  Set an estimated preparation/pickup time, e.g. "Ready in 15 minutes"
    or a specific pickup time.
4.  Save the estimate.
5.  Show the estimate to the student.
6.  Update the estimate and notify the student if timing changes.

Clearly distinguish an estimated ready time from a firm pickup deadline.
The student and canteen must see the same timing rule.

## 4.6 Update Order Status

Suggested actions: - **Accept Order** --- canteen confirms it can
fulfill the order. - **Preparing** --- food preparation has started. -
**Ready for Pickup** --- student can come to collect the order. -
**Delivered/Collected** --- order has been handed to the student.

After handing over the food, staff must change the status on the canteen
dashboard to **Delivered/Collected**. The student's order screen should
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
total verified amount for a selected period. - Amount refunded. -
Settlement pending amount. - Settled amount and settlement
date/reference, if available. - Per-order payment details. - A
date/status filter and downloadable report, if supported.

Do not show sensitive bank details or payment credentials. Use the
payment provider's verified records rather than trusting a client-side
success message.

## 4.8 Cancellation and 30-Minute Rule

The stated requirement is: **if a student cannot reach the canteen
within 30 minutes, they can cancel the order.**

The app must define when the 30-minute window starts---for example, from
the canteen's stated ready/pickup time or another agreed reference.
Student and canteen should see the same deadline.

Recommended flow: 1. Student opens the active order. 2. System checks
whether cancellation is allowed under the configured rule and order
status. 3. Student selects **Cancel Order** and confirms. 4. Backend
records cancellation and updates both dashboards. 5. If payment was
completed, show refund status and follow the configured refund policy.

Policy decisions to finalize: - Does the 30-minute timer start when the
order is accepted, marked ready, or at the pickup time? - Is
cancellation allowed before the order is ready? - Can the canteen
reject/cancel an order, and how is the student notified? - Are paid
orders automatically refunded? What is the refund process/timeline? -
Does the order expire automatically after the deadline, or must the
student initiate cancellation?

Do not assume automatic cancellation unless it is explicitly implemented
and communicated.

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
Cancelled/rejected orders. - Payments verified. - Payments
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
ready for pickup, completed, cancelled, or rejected. - Identify orders
that have been waiting unusually long or have exceeded the pickup
estimate. - View the cancellation reason and relevant timeline. - Review
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

## 5.8 Cancellations, Refunds, and Disputes

Admin should be able to: - View cancellations by student, canteen,
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
30-minute cancellation policy and its start point. - Whether
cancellation is allowed before/after preparation begins. -
Refund/cancellation policy text. - Pickup-time display rules. -
Notification templates and system announcements. - Platform fee/tax
settings, if applicable and legally/contractually configured. -
Maintenance mode or temporary ordering pause. - Support contact details.

Changes to payment, cancellation, or fee settings should be
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
Payment Pending - Order Rejected - Order Cancelled by Student - Order
Cancelled by Canteen - Refund Pending - Refunded

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

# 8. Cancellation and 30-Minute Rule

The requirement is: **if a student cannot reach the canteen within 30
minutes, they can cancel the order.**

The app must define when the 30-minute window starts---for example, from
the stated ready/pickup time or another agreed reference. Both student
and canteen should see the same deadline.

Suggested flow: 1. Student opens the active order. 2. Backend checks
whether cancellation is allowed under the configured rule and current
order status. 3. Student selects **Cancel Order** and confirms. 4.
Backend records cancellation and updates student, canteen, and admin
views. 5. If payment was completed, show refund status and follow the
configured policy.

Finalize: - Timer start point. - Whether cancellation is allowed before
readiness. - Canteen rejection/cancellation rules. - Refund eligibility
and process. - Whether an order expires automatically or requires
student cancellation.

Do not assume automatic cancellation unless explicitly implemented and
communicated.

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
9.  Cancellations, Refunds, and Disputes.
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
    estimate, cancellation details.

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

  Student cancels within allowed      Update all relevant dashboards and
  window                              follow refund policy.

  Cancellation not allowed            Explain the policy and available
                                      next steps.

  Canteen changes ready time          Update student-facing estimate and
                                      notify if enabled.

  Student misses pickup window        Apply the explicitly configured
                                      cancellation/expiry policy.

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
-   Define cancellation, refund, data-retention, and support policies.

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
-   [ ] Cancellation follows the configured 30-minute policy.
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
-   [ ] Admin can review cancellation/dispute cases.
-   [ ] Admin can access date-filtered reports.
-   [ ] Sensitive admin actions are logged.
-   [ ] Admin cannot falsely mark a payment or settlement as confirmed
    without verified records.

## Platform

-   [ ] Payment failures, pending results, refunds, and settlement
    exceptions are handled safely.
-   [ ] Network and validation errors are clear.
-   [ ] Order status history is consistent across roles.
-   [ ] The 30-minute cancellation rule has a defined start point and
    behavior.

------------------------------------------------------------------------

# 14. Future Enhancements

-   Push notifications for order acceptance, preparation,
    ready-for-pickup, cancellation, and delivery.
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
    settlements, cancellations, refunds, reports, and platform settings.

The key operational principles are accurate live order status, verified
payment information, a clear distinction between payment and settlement,
and a clearly defined 30-minute cancellation policy.
