-- Enable realtime for commissions, profiles, and settings tables
-- Note: orders table already has realtime enabled
DO $$
BEGIN
  -- Try to add each table, ignore if already added
  BEGIN
    ALTER publication supabase_realtime ADD TABLE commissions;
  EXCEPTION WHEN duplicate_object THEN
    NULL; -- Table already in publication
  END;
  
  BEGIN
    ALTER publication supabase_realtime ADD TABLE profiles;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  
  BEGIN
    ALTER publication supabase_realtime ADD TABLE settings;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;
