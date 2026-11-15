# Razorpay test checkout

The payment integration is test-only. Live keys are rejected by configuration validation. Do not use the key pair previously posted in chat; regenerate it in Razorpay and keep its replacement secret private.

## Railway setup

After this release is deployed, add the following **to both `api` and `worker`** using each service's private Variables editor:

```text
RAZORPAY_KEY_ID=<fresh test Key ID starting rzp_test_>
RAZORPAY_KEY_SECRET=<fresh test Key Secret>
RAZORPAY_WEBHOOK_SECRET=<a separate random secret of at least 32 characters>
PAYMENT_WINDOW_MINUTES=15
ORDER_MODE=RAZORPAY_TEST
```

Set all variables together and deploy both services. No payment credentials belong in student/canteen frontend variables, Git, or chat. The API returns only the public Key ID and the current student's checkout reference. The worker needs the same test account so it can reconcile payments after the student closes their browser. Keep automatic payment capture enabled in Razorpay; the backend can also capture a correctly matched authorized payment.

The default window is 15 minutes. If Railway already has `PAYMENT_WINDOW_MINUTES=5`, update it to `15` on both services; environment overrides take priority. Existing orders keep their saved deadline; the new duration applies when staff accept an order after the configuration change.

In the Razorpay **Test Mode** dashboard, configure a webhook:

```text
https://student-production-4edff2d7.up.railway.app/api/payments/razorpay/webhook
```

Use the same `RAZORPAY_WEBHOOK_SECRET` as Railway. Enable `payment.authorized`, `payment.captured`, `payment.failed`, and `order.paid`. The HTTPS frontend forwards `/api/` to the private API; do not expose a new API public domain. The webhook validates the signature over the original request bytes before parsing JSON and verifies the actual payment with Razorpay.

Do not switch accounts while unpaid test orders exist. Finish/expire the old account's test orders first. Existing orders created in the earlier payment-free TEST mode retain their original behaviour; only new orders created with `ORDER_MODE=RAZORPAY_TEST` use payment checkout. With `ORDER_MODE=TEST`, the legacy payment-free qualification mode remains available. Missing payment credentials with `ORDER_MODE=RAZORPAY_TEST` fail startup rather than silently enabling free orders.

## Student and canteen flow

1. Student submits the order with fixed menu/offer snapshots. No gateway order or payment is created yet.
2. Staff accept or reject. Acceptance starts the configured payment window, and an acceptance notification tells the student to open their order and pay.
3. Student selects Pay. The server creates/reuses one Razorpay order for that accepted application order. No amount is accepted from the browser.
4. Browser verification, signed webhooks, and worker reconciliation all use the same confirmation path. Only captured, correctly matched full INR payments unlock preparation. Confirmation is idempotent and triggers a paid notification. Staff hear a chime when a known order becomes paid after their initial queue load.
5. Student cannot cancel/refund after payment, and staff cannot reject a paid order. No refund API or automatic refund request is implemented. Payment provider auto-reversals are outside the application's cancellation policy.
6. Paid order progresses Preparing → Ready → Collected. Tokens accrue after collection. Token-only reward orders bypass Razorpay.

An unpaid student order can be cancelled before payment checkout starts. Once checkout has started, cancellation is disabled because a delayed payment could still complete. Failed/closed checkout may be retried within the deadline using the same Razorpay order. The student can always explicitly check an initiated payment status.

Unpaid accepted orders close after the deadline and leave the active queue, including orders with pending payments or interrupted checkout setup. Background payment checks continue even after closure; a gateway outage cannot keep the food request active indefinitely. If a delayed captured payment arrives after unpaid expiry, the same order is restored to Accepted/Paid for fulfilment. The app does not discard a paid order or automatically refund it. An ambiguous order-creation response is recovered through its stable receipt, without creating an unrelated payment/order.

## Acceptance checks after entering credentials

- Submit: staff see a new unpaid request; student has no Pay button before acceptance.
- Reject before acceptance: no payment is requested.
- Accept: student receives Pay now, deadline, and no-cancellation/no-refund notice.
- Failed payment or modal dismissal: same-order retry; preparation remains blocked.
- Successful simulated payment: student/staff see Paid, then preparation is allowed.
- Close the browser during success: webhook/worker still confirms the order.
- Duplicate callback/webhook: one confirmation, no duplicate food order.
- Let an unpaid accepted order expire; verify a processing payment is checked safely.
- Check collection awards tokens once; reward-only orders still skip payment.
- Check Stats and notifications; no real money is collected in this release.

The automated integration suite uses an isolated local PostgreSQL database and a fake Razorpay server. Real Razorpay sandbox acceptance must be completed after the operator enters fresh test credentials and enables the webhook.

Official references: [Standard Checkout](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps), [webhook validation](https://razorpay.com/docs/webhooks/validate-test), [fetch payments for an order](https://razorpay.com/docs/api/orders/fetch-payments), [receipt lookup](https://razorpay.com/docs/api/orders/fetch-all).
