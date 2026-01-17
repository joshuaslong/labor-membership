-- Migration: Add stripe_charge_id for reliable duplicate detection
-- Description: The charge ID is the most reliable unique identifier from Stripe

-- Add stripe_charge_id column
ALTER TABLE payments ADD COLUMN IF NOT EXISTS stripe_charge_id TEXT;

-- Create unique index to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_stripe_charge ON payments(stripe_charge_id) WHERE stripe_charge_id IS NOT NULL;

-- Also add unique constraint on payment_intent_id where it exists
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent ON payments(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;
