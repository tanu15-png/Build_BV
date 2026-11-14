ALTER TABLE orders
  ADD COLUMN razorpay_order_id TEXT,
  ADD COLUMN razorpay_payment_id TEXT,
  ADD COLUMN payment_key_id TEXT,
  ADD COLUMN payment_deadline TIMESTAMPTZ,
  ADD COLUMN payment_paid_at TIMESTAMPTZ,
  ADD COLUMN payment_lease_until TIMESTAMPTZ,
  ADD COLUMN payment_next_check_at TIMESTAMPTZ,
  ADD COLUMN closed_reason TEXT;
CREATE UNIQUE INDEX orders_razorpay_order_id_key ON orders(razorpay_order_id);
CREATE UNIQUE INDEX orders_razorpay_payment_id_key ON orders(razorpay_payment_id);
CREATE INDEX orders_execution_mode_payment_status_payment_next_check_at_idx ON orders(execution_mode,payment_status,payment_next_check_at);
ALTER TABLE orders DROP CONSTRAINT test_payment_policy;
ALTER TABLE orders ADD CONSTRAINT test_payment_policy CHECK (
  (execution_mode = 'TEST' AND payment_status = 'NOT_REQUIRED_TEST') OR
  (execution_mode = 'REWARD' AND total_paise = 0 AND payment_status = 'NOT_REQUIRED_TEST') OR
  (execution_mode = 'RAZORPAY_TEST' AND total_paise >= 100 AND payment_status IN
    ('AWAITING_ACCEPTANCE','AWAITING_PAYMENT','PROCESSING','FAILED','PAID','PAYMENT_EXPIRED','CANCELLED','REVIEW_REQUIRED'))
);
ALTER TABLE orders ADD CONSTRAINT paid_gateway_reference CHECK (
  payment_status <> 'PAID' OR (razorpay_order_id IS NOT NULL AND razorpay_payment_id IS NOT NULL AND payment_paid_at IS NOT NULL)
);
ALTER TABLE orders ADD CONSTRAINT payment_before_preparation CHECK (
  execution_mode <> 'RAZORPAY_TEST' OR status NOT IN ('PREPARING','READY','COLLECTED') OR payment_status = 'PAID'
);
