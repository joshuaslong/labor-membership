-- Migration: FEC Compliance
-- Adds employer/occupation and FEC attestation tracking to payments

-- Add FEC compliance columns to payments table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS employer TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS occupation TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS street_address TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS zip_code TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS fec_attested_at TIMESTAMPTZ;

-- Create index for FEC reporting queries
CREATE INDEX IF NOT EXISTS idx_payments_fec_compliance ON payments(employer, occupation) WHERE employer IS NOT NULL;

-- Add comment explaining FEC requirements
COMMENT ON COLUMN payments.employer IS 'FEC-required employer information for political contributions';
COMMENT ON COLUMN payments.occupation IS 'FEC-required occupation information for political contributions';
COMMENT ON COLUMN payments.fec_attested_at IS 'Timestamp when donor confirmed FEC compliance attestations (US citizen, personal funds, own behalf, not contractor)';

-- Add FEC fields to member_subscriptions as well for recurring donations
ALTER TABLE member_subscriptions ADD COLUMN IF NOT EXISTS employer TEXT;
ALTER TABLE member_subscriptions ADD COLUMN IF NOT EXISTS occupation TEXT;
ALTER TABLE member_subscriptions ADD COLUMN IF NOT EXISTS fec_attested_at TIMESTAMPTZ;

COMMENT ON COLUMN member_subscriptions.employer IS 'FEC-required employer information for recurring political contributions';
COMMENT ON COLUMN member_subscriptions.occupation IS 'FEC-required occupation information for recurring political contributions';
COMMENT ON COLUMN member_subscriptions.fec_attested_at IS 'Timestamp when donor confirmed FEC compliance attestations';
