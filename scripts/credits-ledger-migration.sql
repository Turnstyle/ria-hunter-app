-- RIA-Hunter Credits Ledger Migration
-- Creates a stable, idempotent credits system that follows the ledger pattern

-- Dedicated "account" row to safely lock during balance updates.
CREATE TABLE IF NOT EXISTS credits_account (
  user_id TEXT PRIMARY KEY,
  balance_cache INTEGER NOT NULL DEFAULT 0, -- optional cache; truth is the ledger
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE IF NOT EXISTS credits_source AS ENUM (
  'usage',
  'subscription',
  'coupon',
  'admin_adjust',
  'refund',
  'migration'
);

CREATE TABLE IF NOT EXISTS credits_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  delta INTEGER NOT NULL, -- +N or -N
  source credits_source NOT NULL,
  ref_type TEXT NOT NULL, -- e.g., 'ask','stripe_invoice','stripe_checkout','coupon_code','manual'
  ref_id TEXT NOT NULL,   -- stable reference (e.g., stripe event id, request id, coupon code)
  idempotency_key TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Guarantees idempotency for the same operation
CREATE UNIQUE INDEX IF NOT EXISTS ux_credits_ledger_idem ON credits_ledger(idempotency_key);

-- For debugging
CREATE INDEX IF NOT EXISTS ix_credits_ledger_user ON credits_ledger(user_id);
CREATE INDEX IF NOT EXISTS ix_credits_ledger_created ON credits_ledger(created_at);

-- Record of processed Stripe events (for visibility + dedupe across handlers)
CREATE TABLE IF NOT EXISTS stripe_events (
  event_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_ok BOOLEAN,
  processed_at TIMESTAMPTZ,
  error TEXT
);

-- Create a stored procedure for safely updating credits
-- This ensures atomic updates with proper locking
CREATE OR REPLACE FUNCTION update_credits(
  p_user_id TEXT,
  p_delta INTEGER,
  p_source credits_source,
  p_ref_type TEXT,
  p_ref_id TEXT,
  p_idempotency_key TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS INTEGER AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- Check if this operation has already been processed
  IF EXISTS (SELECT 1 FROM credits_ledger WHERE idempotency_key = p_idempotency_key) THEN
    -- Return current balance without making changes
    SELECT COALESCE(balance_cache, 0) INTO v_current_balance FROM credits_account WHERE user_id = p_user_id;
    IF v_current_balance IS NULL THEN
      RETURN 0; -- Account doesn't exist yet
    END IF;
    RETURN v_current_balance;
  END IF;

  -- Lock the account row for update
  -- This will create the row if it doesn't exist
  INSERT INTO credits_account (user_id, balance_cache)
  VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO UPDATE
  SET updated_at = now()
  RETURNING balance_cache INTO v_current_balance;

  -- If account was just created, set initial balance to 0
  IF v_current_balance IS NULL THEN
    v_current_balance := 0;
  END IF;

  -- Calculate new balance
  v_new_balance := v_current_balance + p_delta;
  
  -- Don't allow negative balances (unless it's an admin adjustment)
  IF v_new_balance < 0 AND p_source != 'admin_adjust' THEN
    RAISE EXCEPTION 'Insufficient credits: current=%, requested=%', v_current_balance, p_delta;
  END IF;

  -- Record the ledger entry
  INSERT INTO credits_ledger (
    user_id, delta, source, ref_type, ref_id, idempotency_key, metadata
  ) VALUES (
    p_user_id, p_delta, p_source, p_ref_type, p_ref_id, p_idempotency_key, p_metadata
  );
  
  -- Update the cached balance
  UPDATE credits_account
  SET balance_cache = v_new_balance,
      updated_at = now()
  WHERE user_id = p_user_id;
  
  -- Return the new balance
  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get current balance
CREATE OR REPLACE FUNCTION get_credits_balance(p_user_id TEXT)
RETURNS INTEGER AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  -- Try to get the cached balance first
  SELECT balance_cache INTO v_balance FROM credits_account WHERE user_id = p_user_id;
  
  -- If no cached balance, calculate from ledger
  IF v_balance IS NULL THEN
    SELECT COALESCE(SUM(delta), 0)
    INTO v_balance
    FROM credits_ledger
    WHERE user_id = p_user_id;
    
    -- Create account with calculated balance
    INSERT INTO credits_account (user_id, balance_cache)
    VALUES (p_user_id, v_balance)
    ON CONFLICT (user_id) DO UPDATE
    SET balance_cache = v_balance,
        updated_at = now();
  END IF;
  
  RETURN v_balance;
END;
$$ LANGUAGE plpgsql;

-- Create a migration function to seed existing users with credits
CREATE OR REPLACE FUNCTION migrate_existing_credits()
RETURNS void AS $$
DECLARE
  r RECORD;
BEGIN
  -- For each user with a subscription
  FOR r IN 
    SELECT DISTINCT user_id FROM subscriptions 
    WHERE status IN ('active', 'trialing')
  LOOP
    -- Check if they already have a credits account
    IF NOT EXISTS (SELECT 1 FROM credits_account WHERE user_id = r.user_id) THEN
      -- Add initial subscription credits (100 credits for subscribers)
      PERFORM update_credits(
        r.user_id, 
        100, 
        'migration'::credits_source, 
        'subscription_migration', 
        r.user_id, 
        'migration_' || r.user_id || '_' || extract(epoch from now())::text,
        jsonb_build_object('migration_note', 'Initial credits for existing subscriber')
      );
    END IF;
  END LOOP;

  -- For each user without a ledger entry, add free credits
  FOR r IN 
    SELECT id as user_id FROM auth.users
    WHERE id NOT IN (SELECT DISTINCT user_id FROM credits_ledger)
  LOOP
    -- Add initial free credits (5 credits for non-subscribers)
    PERFORM update_credits(
      r.user_id, 
      5, 
      'migration'::credits_source, 
      'free_migration', 
      r.user_id, 
      'migration_free_' || r.user_id || '_' || extract(epoch from now())::text,
      jsonb_build_object('migration_note', 'Initial free credits')
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;
