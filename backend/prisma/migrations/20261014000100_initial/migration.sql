-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'CANTEEN', 'ADMIN');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('RECEIVED', 'ACCEPTED', 'PREPARING', 'READY', 'COLLECTED');

-- CreateEnum
CREATE TYPE "ChallengePurpose" AS ENUM ('SIGNUP', 'PASSWORD_RESET', 'CANTEEN_LOGIN');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT,
    "email_verified_at" TIMESTAMPTZ,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role" "Role" NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role")
);

-- CreateTable
CREATE TABLE "canteens" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "hours" TEXT,
    "accepting_orders" BOOLEAN NOT NULL DEFAULT true,
    "operational" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "canteens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canteen_access_codes" (
    "id" UUID NOT NULL,
    "canteen_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "rotated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotated_by" UUID,

    CONSTRAINT "canteen_access_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canteen_memberships" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "canteen_id" UUID NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "code_version" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "joined_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ,
    "revoked_by" UUID,
    "restored_at" TIMESTAMPTZ,
    "restored_by" UUID,

    CONSTRAINT "canteen_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_challenges" (
    "id" UUID NOT NULL,
    "purpose" "ChallengePurpose" NOT NULL,
    "email" TEXT NOT NULL,
    "canteen_id" UUID,
    "otp_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumed_at" TIMESTAMPTZ,
    "version" INTEGER NOT NULL DEFAULT 1,
    "access_code_version" INTEGER,
    "signup_name" TEXT,
    "pending_password_hash" TEXT,
    "reset_context" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "canteen_id" UUID,
    "membership_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_items" (
    "id" UUID NOT NULL,
    "canteen_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "price_paise" INTEGER NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "image_ref" TEXT,

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carts" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "canteen_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" UUID NOT NULL,
    "cart_id" UUID NOT NULL,
    "menu_item_id" UUID NOT NULL,
    "canteen_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "canteen_id" UUID NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'RECEIVED',
    "execution_mode" TEXT NOT NULL DEFAULT 'TEST',
    "payment_status" TEXT NOT NULL DEFAULT 'NOT_REQUIRED_TEST',
    "total_paise" INTEGER NOT NULL,
    "pickup_at" TIMESTAMPTZ NOT NULL,
    "code_day" DATE NOT NULL,
    "order_code" VARCHAR(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "collected_at" TIMESTAMPTZ,
    "pickup_verified_by" UUID,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "menu_item_id" UUID,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price_paise" INTEGER NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_events" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "previous_status" "OrderStatus",
    "new_status" "OrderStatus" NOT NULL,
    "actor_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_code_allocations" (
    "order_id" UUID NOT NULL,
    "code_day" DATE NOT NULL,
    "code" VARCHAR(3) NOT NULL,
    "allocated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_code_allocations_pkey" PRIMARY KEY ("order_id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "source_event_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMPTZ,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lease_until" TIMESTAMPTZ,
    "lease_owner" TEXT,
    "last_error" TEXT,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "response" JSONB,
    "response_status" INTEGER,
    "order_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "metadata" JSONB,
    "request_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limits" (
    "key" TEXT NOT NULL,
    "window_ends_at" TIMESTAMPTZ NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "canteens_slug_key" ON "canteens"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "canteen_access_codes_canteen_id_version_key" ON "canteen_access_codes"("canteen_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "canteen_memberships_user_id_canteen_id_key" ON "canteen_memberships"("user_id", "canteen_id");

-- CreateIndex
CREATE UNIQUE INDEX "canteen_memberships_id_user_id_canteen_id_key" ON "canteen_memberships"("id", "user_id", "canteen_id");

-- CreateIndex
CREATE INDEX "auth_challenges_email_purpose_expires_at_idx" ON "auth_challenges"("email", "purpose", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_membership_id_revoked_at_expires_at_idx" ON "sessions"("membership_id", "revoked_at", "expires_at");

-- CreateIndex
CREATE INDEX "sessions_user_id_revoked_at_expires_at_idx" ON "sessions"("user_id", "revoked_at", "expires_at");

-- CreateIndex
CREATE INDEX "menu_items_canteen_id_archived_available_idx" ON "menu_items"("canteen_id", "archived", "available");

-- CreateIndex
CREATE UNIQUE INDEX "menu_items_id_canteen_id_key" ON "menu_items"("id", "canteen_id");

-- CreateIndex
CREATE UNIQUE INDEX "carts_student_id_key" ON "carts"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "carts_id_canteen_id_key" ON "carts"("id", "canteen_id");

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_cart_id_menu_item_id_key" ON "cart_items"("cart_id", "menu_item_id");

-- CreateIndex
CREATE INDEX "orders_student_id_created_at_idx" ON "orders"("student_id", "created_at");

-- CreateIndex
CREATE INDEX "orders_canteen_id_status_pickup_at_idx" ON "orders"("canteen_id", "status", "pickup_at");

-- CreateIndex
CREATE UNIQUE INDEX "orders_id_code_day_order_code_key" ON "orders"("id", "code_day", "order_code");

-- CreateIndex
CREATE UNIQUE INDEX "orders_code_day_order_code_key" ON "orders"("code_day", "order_code");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_events_order_id_created_at_idx" ON "order_events"("order_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "order_code_allocations_order_id_code_day_code_key" ON "order_code_allocations"("order_id", "code_day", "code");

-- CreateIndex
CREATE UNIQUE INDEX "order_code_allocations_code_day_code_key" ON "order_code_allocations"("code_day", "code");

-- CreateIndex
CREATE INDEX "notifications_recipient_id_read_at_created_at_idx" ON "notifications"("recipient_id", "read_at", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_recipient_id_source_event_id_type_key" ON "notifications"("recipient_id", "source_event_id", "type");

-- CreateIndex
CREATE INDEX "outbox_events_state_available_at_lease_until_idx" ON "outbox_events"("state", "available_at", "lease_until");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_actor_id_action_key_key" ON "idempotency_keys"("actor_id", "action", "key");

-- CreateIndex
CREATE INDEX "audit_logs_target_created_at_idx" ON "audit_logs"("target", "created_at");

-- CreateIndex
CREATE INDEX "rate_limits_window_ends_at_idx" ON "rate_limits"("window_ends_at");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canteen_access_codes" ADD CONSTRAINT "canteen_access_codes_canteen_id_fkey" FOREIGN KEY ("canteen_id") REFERENCES "canteens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canteen_memberships" ADD CONSTRAINT "canteen_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canteen_memberships" ADD CONSTRAINT "canteen_memberships_canteen_id_fkey" FOREIGN KEY ("canteen_id") REFERENCES "canteens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_challenges" ADD CONSTRAINT "auth_challenges_canteen_id_fkey" FOREIGN KEY ("canteen_id") REFERENCES "canteens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_canteen_id_fkey" FOREIGN KEY ("canteen_id") REFERENCES "canteens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_membership_id_user_id_canteen_id_fkey" FOREIGN KEY ("membership_id", "user_id", "canteen_id") REFERENCES "canteen_memberships"("id", "user_id", "canteen_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_canteen_id_fkey" FOREIGN KEY ("canteen_id") REFERENCES "canteens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_canteen_id_fkey" FOREIGN KEY ("canteen_id") REFERENCES "canteens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_canteen_id_fkey" FOREIGN KEY ("cart_id", "canteen_id") REFERENCES "carts"("id", "canteen_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_menu_item_id_canteen_id_fkey" FOREIGN KEY ("menu_item_id", "canteen_id") REFERENCES "menu_items"("id", "canteen_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_canteen_id_fkey" FOREIGN KEY ("canteen_id") REFERENCES "canteens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_canteen_id_fkey" FOREIGN KEY ("canteen_id") REFERENCES "canteens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_code_allocations" ADD CONSTRAINT "order_code_allocations_order_id_code_day_code_fkey" FOREIGN KEY ("order_id", "code_day", "code") REFERENCES "orders"("id", "code_day", "order_code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_source_event_id_fkey" FOREIGN KEY ("source_event_id") REFERENCES "order_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "order_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Rules Prisma cannot express; quantities and versions are bounded at the database boundary.
ALTER TABLE users ADD CONSTRAINT normalized_email CHECK (email = lower(btrim(email)) AND email ~ '^[^@[:space:]]+@[^@[:space:]]+$');
ALTER TABLE canteens ADD CONSTRAINT canteen_version CHECK (version > 0);
ALTER TABLE canteen_access_codes ADD CONSTRAINT code_hash_format CHECK (code_hash ~ '^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$'), ADD CONSTRAINT code_version CHECK (version > 0);
CREATE UNIQUE INDEX one_active_access_code ON canteen_access_codes(canteen_id) WHERE active;
ALTER TABLE canteen_memberships ADD CONSTRAINT membership_versions CHECK (version > 0 AND code_version > 0);
ALTER TABLE auth_challenges ADD CONSTRAINT challenge_bounds CHECK (attempts >= 0 AND version > 0), ADD CONSTRAINT staff_challenge_binding CHECK ((purpose = 'CANTEEN_LOGIN' AND canteen_id IS NOT NULL AND access_code_version IS NOT NULL) OR (purpose <> 'CANTEEN_LOGIN' AND canteen_id IS NULL));
ALTER TABLE sessions ADD CONSTRAINT staff_session_scope CHECK ((role = 'CANTEEN' AND membership_id IS NOT NULL AND canteen_id IS NOT NULL) OR (role <> 'CANTEEN' AND membership_id IS NULL AND canteen_id IS NULL)), ADD CONSTRAINT session_expiry CHECK (expires_at > created_at);
ALTER TABLE menu_items ADD CONSTRAINT menu_bounds CHECK (price_paise >= 0 AND version > 0);
ALTER TABLE carts ADD CONSTRAINT cart_version CHECK (version > 0);
ALTER TABLE cart_items ADD CONSTRAINT cart_quantity CHECK (quantity BETWEEN 1 AND 99);
ALTER TABLE orders ADD CONSTRAINT order_bounds CHECK (total_paise >= 0 AND version > 0), ADD CONSTRAINT pickup_code_format CHECK (order_code IS NULL OR order_code ~ '^[A-Z0-9]{3}$'), ADD CONSTRAINT test_payment_policy CHECK (execution_mode = 'TEST' AND payment_status = 'NOT_REQUIRED_TEST'), ADD CONSTRAINT collection_verification CHECK ((status = 'COLLECTED' AND collected_at IS NOT NULL AND pickup_verified_by IS NOT NULL) OR (status <> 'COLLECTED' AND collected_at IS NULL AND pickup_verified_by IS NULL));
ALTER TABLE order_items ADD CONSTRAINT order_item_bounds CHECK (quantity BETWEEN 1 AND 99 AND unit_price_paise >= 0);
ALTER TABLE order_code_allocations ADD CONSTRAINT allocated_code_format CHECK (code ~ '^[A-Z0-9]{3}$');
ALTER TABLE outbox_events ADD CONSTRAINT outbox_bounds CHECK (attempts >= 0 AND state IN ('PENDING','PROCESSING','COMPLETED','FAILED'));
ALTER TABLE idempotency_keys ADD CONSTRAINT idempotency_state CHECK (state IN ('PENDING','COMPLETED'));
ALTER TABLE rate_limits ADD CONSTRAINT rate_count CHECK (count >= 0);
-- Permanent code allocations and historical snapshots cannot be rewritten or deleted.
CREATE FUNCTION reject_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Historical records are immutable' USING ERRCODE = '23514'; END;
$$;
CREATE TRIGGER immutable_allocations BEFORE UPDATE OR DELETE ON order_code_allocations FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER immutable_order_items BEFORE UPDATE OR DELETE ON order_items FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER immutable_order_events BEFORE UPDATE OR DELETE ON order_events FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE FUNCTION preserve_order_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.code_day IS DISTINCT FROM OLD.code_day OR (OLD.order_code IS NOT NULL AND NEW.order_code IS DISTINCT FROM OLD.order_code) OR NEW.student_id <> OLD.student_id OR NEW.canteen_id <> OLD.canteen_id OR NEW.total_paise <> OLD.total_paise THEN
  RAISE EXCEPTION 'Order identity and snapshots are immutable' USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER immutable_order_identity BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION preserve_order_identity();
-- Supabase browser roles have no access; Express uses a separately provisioned server role.
DO $$ DECLARE tab text; BEGIN
 FOR tab IN SELECT unnest(ARRAY['users','user_roles','canteens','canteen_access_codes','canteen_memberships','auth_challenges','sessions','carts','cart_items','menu_items','orders','order_items','order_events','order_code_allocations','notifications','outbox_events','idempotency_keys','audit_logs','rate_limits']) LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tab);
  EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC', tab);
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN EXECUTE format('REVOKE ALL ON TABLE %I FROM anon', tab); END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN EXECUTE format('REVOKE ALL ON TABLE %I FROM authenticated', tab); END IF;
 END LOOP;
END $$;
