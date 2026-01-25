-- Check if user_qualified_rank exists and show a sample row
SELECT * FROM user_qualified_rank LIMIT 1;

-- List all tables and views
SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = 'public';

-- List all triggers in the public schema
SELECT event_object_table AS table_name, trigger_name, action_timing, event_manipulation, action_statement
FROM information_schema.triggers WHERE trigger_schema = 'public';

-- List all triggers attached to user_qualified_rank (if any)
SELECT tgname AS trigger_name, tgtype, tgenabled
FROM pg_trigger WHERE tgrelid = 'user_qualified_rank'::regclass;