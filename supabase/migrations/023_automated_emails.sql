-- Migration: Automated Email System
-- Creates tables for email templates and logging

-- Email templates table (admin-customizable)
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  description TEXT,
  variables JSONB DEFAULT '[]',
  enabled BOOLEAN DEFAULT true,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email log for tracking sent automated emails
CREATE TABLE IF NOT EXISTS automated_email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_type TEXT,
  recipient_id UUID,
  related_id UUID,
  subject TEXT NOT NULL,
  status TEXT DEFAULT 'sent',
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_email_templates_key ON email_templates(template_key);
CREATE INDEX IF NOT EXISTS idx_automated_email_logs_template ON automated_email_logs(template_key);
CREATE INDEX IF NOT EXISTS idx_automated_email_logs_recipient ON automated_email_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_automated_email_logs_related ON automated_email_logs(related_id);
CREATE INDEX IF NOT EXISTS idx_automated_email_logs_sent_at ON automated_email_logs(sent_at);

-- RLS Policies for email_templates
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- Super admins and national admins can view and edit templates
CREATE POLICY "Admins can view email templates"
  ON email_templates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.role IN ('super_admin', 'national_admin')
    )
  );

CREATE POLICY "Super admins can update email templates"
  ON email_templates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.role = 'super_admin'
    )
  );

-- RLS Policies for automated_email_logs
ALTER TABLE automated_email_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view email logs
CREATE POLICY "Admins can view automated email logs"
  ON automated_email_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.role IN ('super_admin', 'national_admin')
    )
  );

-- Service role can insert logs (for automated emails)
CREATE POLICY "Service can insert automated email logs"
  ON automated_email_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Seed default email templates
INSERT INTO email_templates (template_key, name, subject, html_content, description, variables) VALUES
(
  'welcome',
  'Welcome Email',
  'Welcome to the Labor Party, {name}!',
  '<p>Dear {name},</p>
<p>Welcome to the Labor Party! We''re excited to have you join our movement for working people.</p>
<p>Your membership is now active. Here''s what you can do:</p>
<ul>
  <li>View your dashboard and update your profile</li>
  <li>Find and RSVP to local events</li>
  <li>Connect with other members in your chapter</li>
</ul>
<p>If you have any questions, feel free to reach out to us.</p>
<p>In solidarity,<br>Labor Party</p>',
  'Sent to new members when they complete signup',
  '["name", "email"]'
),
(
  'rsvp_confirmation',
  'RSVP Confirmation',
  'You''re confirmed for: {event_name}',
  '<p>Dear {name},</p>
<p>Your RSVP has been confirmed!</p>
<p><strong>Event:</strong> {event_name}<br>
<strong>Date:</strong> {event_date}<br>
<strong>Time:</strong> {event_time}<br>
<strong>Location:</strong> {event_location}</p>
<p>We look forward to seeing you there!</p>
<p>In solidarity,<br>Labor Party</p>',
  'Sent when a member or guest RSVPs to an event',
  '["name", "event_name", "event_date", "event_time", "event_location", "rsvp_status"]'
),
(
  'event_reminder_24h',
  'Event Reminder (24 Hours)',
  'Reminder: {event_name} is tomorrow!',
  '<p>Dear {name},</p>
<p>Just a reminder that <strong>{event_name}</strong> is happening tomorrow!</p>
<p><strong>Date:</strong> {event_date}<br>
<strong>Time:</strong> {event_time}<br>
<strong>Location:</strong> {event_location}</p>
<p>We look forward to seeing you there!</p>
<p>In solidarity,<br>Labor Party</p>',
  'Sent 24 hours before an event to confirmed attendees',
  '["name", "event_name", "event_date", "event_time", "event_location"]'
),
(
  'event_reminder_1h',
  'Event Reminder (1 Hour)',
  'Starting soon: {event_name}',
  '<p>Dear {name},</p>
<p><strong>{event_name}</strong> is starting in about an hour!</p>
<p><strong>Time:</strong> {event_time}<br>
<strong>Location:</strong> {event_location}</p>
<p>See you soon!</p>
<p>In solidarity,<br>Labor Party</p>',
  'Sent 1 hour before an event to confirmed attendees',
  '["name", "event_name", "event_date", "event_time", "event_location"]'
),
(
  'payment_receipt',
  'Payment Receipt',
  'Thank you for your {payment_type}!',
  '<p>Dear {name},</p>
<p>Thank you for your support of the Labor Party!</p>
<p><strong>Amount:</strong> ${amount}<br>
<strong>Date:</strong> {date}<br>
<strong>Type:</strong> {payment_type}</p>
<p>Your contribution helps us continue our work building power for working people.</p>
<p>In solidarity,<br>Labor Party</p>',
  'Sent after a successful payment or donation',
  '["name", "amount", "date", "payment_type"]'
),
(
  'payment_failed',
  'Payment Failed',
  'Action needed: Your payment could not be processed',
  '<p>Dear {name},</p>
<p>We were unable to process your recent payment of <strong>${amount}</strong>.</p>
<p>This may be due to:</p>
<ul>
  <li>Insufficient funds</li>
  <li>Expired card</li>
  <li>Card declined by your bank</li>
</ul>
<p>Please update your payment method to continue your membership:</p>
<p><a href="{update_payment_url}" style="display: inline-block; background-color: #E25555; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">Update Payment Method</a></p>
<p>If you have any questions, please contact us.</p>
<p>In solidarity,<br>Labor Party</p>',
  'Sent when a recurring payment fails',
  '["name", "amount", "update_payment_url"]'
)
ON CONFLICT (template_key) DO NOTHING;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_email_template_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS email_templates_updated_at ON email_templates;
CREATE TRIGGER email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_email_template_timestamp();
