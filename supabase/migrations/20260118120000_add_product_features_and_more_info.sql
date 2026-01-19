-- Add features and more_info columns to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS more_info JSONB DEFAULT NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(active);
