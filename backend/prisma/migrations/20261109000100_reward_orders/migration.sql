ALTER TABLE orders DROP CONSTRAINT test_payment_policy;
ALTER TABLE orders ADD CONSTRAINT test_payment_policy CHECK (
  payment_status = 'NOT_REQUIRED_TEST' AND
  (execution_mode = 'TEST' OR (execution_mode = 'REWARD' AND total_paise = 0))
);
