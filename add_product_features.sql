-- Add features column to products table to store feature list as JSONB array
ALTER TABLE public.products ADD COLUMN features JSONB DEFAULT '[]'::jsonb;

-- Update existing products with sample features
UPDATE public.products SET features = '[
  "Binary placement",
  "Commission eligibility",
  "Training materials"
]'::jsonb WHERE name = 'Starter Package';

UPDATE public.products SET features = '[
  "Binary placement",
  "Commission eligibility",
  "Training materials",
  "Priority support"
]'::jsonb WHERE name = 'Growth Package';

UPDATE public.products SET features = '[
  "Binary placement",
  "Commission eligibility",
  "Training materials",
  "Priority support",
  "VIP webinars"
]'::jsonb WHERE name = 'Elite Package';
