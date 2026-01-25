-- Migration: Update is_admin_by_email to include your email
-- Date: 2026-01-24

-- Replace 'your-admin@email.com' with your actual admin email
CREATE OR REPLACE FUNCTION public.is_admin_by_email()
RETURNS boolean AS $$
DECLARE
  admin_emails text[] := ARRAY['atomictrust@protonmail.com'];
  user_email text;
BEGIN
  BEGIN
    user_email := current_setting('request.jwt.claim.email', true);
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;
  RETURN user_email = ANY(admin_emails);
END;
$$ LANGUAGE plpgsql STABLE;
