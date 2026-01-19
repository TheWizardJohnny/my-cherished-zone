-- Add more_info column to products table to store additional product information
ALTER TABLE public.products ADD COLUMN more_info JSONB DEFAULT '{"sections": []}'::jsonb;

-- The structure will be:
-- {
--   "sections": [
--     {
--       "title": "Section Title",
--       "items": ["item 1", "item 2", "item 3"]
--     }
--   ]
-- }
