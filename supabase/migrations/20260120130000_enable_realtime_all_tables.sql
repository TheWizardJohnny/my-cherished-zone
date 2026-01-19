-- Enable realtime for ALL tables in the database
-- This migration ensures every table can broadcast changes in real-time
-- Only adds tables that actually exist to avoid errors

DO $$
DECLARE
  table_name TEXT;
BEGIN
  -- List of tables to enable realtime for
  FOREACH table_name IN ARRAY ARRAY[
    'profiles', 'products', 'orders', 'commissions', 'withdrawals',
    'announcements', 'user_roles', 'settings', 'placements', 'referrals'
  ]
  LOOP
    -- Only add table if it exists
    IF EXISTS (
      SELECT FROM pg_tables
      WHERE schemaname = 'public' AND tablename = table_name
    ) THEN
      BEGIN
        EXECUTE format('ALTER publication supabase_realtime ADD TABLE %I', table_name);
      EXCEPTION WHEN duplicate_object THEN
        NULL; -- Table already in publication, ignore
      END;
    END IF;
  END LOOP;
END $$;
