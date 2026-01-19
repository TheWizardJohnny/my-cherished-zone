-- Verify that realtime is enabled for all tables
-- This query shows which tables are included in the supabase_realtime publication

SELECT 
  schemaname,
  tablename,
  (SELECT COUNT(*) FROM pg_publication_tables 
   WHERE pubname = 'supabase_realtime' 
   AND schemaname = 'public') as total_tables_in_publication
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
