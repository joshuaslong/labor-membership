-- Admin users table for role-based access control
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS on admin_users
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Only admins can view the admin_users table
CREATE POLICY "Admins can view admin_users" ON admin_users
  FOR SELECT USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- Update members RLS policies
DROP POLICY IF EXISTS "Members can view own record" ON members;

-- Members can view their own profile
CREATE POLICY "Members can view own profile" ON members
  FOR SELECT USING (auth.uid() = user_id);

-- Members can update their own contact info
CREATE POLICY "Members can update own profile" ON members
  FOR UPDATE USING (auth.uid() = user_id);

-- Admins can do anything with members
CREATE POLICY "Admins can manage members" ON members
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- Index for faster admin lookups
CREATE INDEX idx_admin_users_user_id ON admin_users(user_id);
