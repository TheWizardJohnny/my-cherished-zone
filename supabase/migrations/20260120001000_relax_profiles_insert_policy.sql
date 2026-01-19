-- Relax profiles INSERT policy to allow service_role (auth triggers) and authenticated users
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON profiles;

CREATE POLICY "Enable insert for authenticated users or service role"
  ON profiles FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role' OR auth.uid() = user_id
  );
