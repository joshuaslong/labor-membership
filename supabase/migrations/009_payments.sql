-- Migration: Add Stripe payment tracking
-- Description: Creates tables for tracking payments and subscriptions

-- Add Stripe customer ID to members table
ALTER TABLE members ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Create index for Stripe customer lookup
CREATE INDEX IF NOT EXISTS idx_members_stripe_customer ON members(stripe_customer_id);

-- Payments table for all transactions
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT,
  stripe_checkout_session_id TEXT,
  stripe_subscription_id TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  payment_type TEXT NOT NULL CHECK (payment_type IN ('one_time', 'recurring')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions table for recurring dues
CREATE TABLE IF NOT EXISTS member_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  stripe_price_id TEXT,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due', 'incomplete')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for lookups
CREATE INDEX IF NOT EXISTS idx_payments_member ON payments(member_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_session ON payments(stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_member ON member_subscriptions(member_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe ON member_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON member_subscriptions(status);

-- Enable RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_subscriptions ENABLE ROW LEVEL SECURITY;

-- Members can view their own payments
CREATE POLICY "Members can view own payments" ON payments
  FOR SELECT USING (
    member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  );

-- Admins can view all payments
CREATE POLICY "Admins can view all payments" ON payments
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM admin_users)
  );

-- Service role can manage all payments (for webhooks)
-- Note: Service role bypasses RLS, but we add this for documentation
CREATE POLICY "Service role manages payments" ON payments
  FOR ALL USING (auth.role() = 'service_role');

-- Members can view their own subscriptions
CREATE POLICY "Members can view own subscriptions" ON member_subscriptions
  FOR SELECT USING (
    member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  );

-- Admins can view all subscriptions
CREATE POLICY "Admins can view all subscriptions" ON member_subscriptions
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM admin_users)
  );

-- Service role can manage all subscriptions (for webhooks)
CREATE POLICY "Service role manages subscriptions" ON member_subscriptions
  FOR ALL USING (auth.role() = 'service_role');

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_payment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-update timestamps
DROP TRIGGER IF EXISTS payments_updated_at ON payments;
CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_timestamp();

DROP TRIGGER IF EXISTS subscriptions_updated_at ON member_subscriptions;
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON member_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_timestamp();
