-- Add transaction verification status tracking
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS tx_verification_status TEXT DEFAULT 'awaiting',
ADD COLUMN IF NOT EXISTS tx_verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS tx_verification_details JSONB;

-- Update existing orders
UPDATE public.orders
SET tx_verification_status = CASE
  WHEN payment_status = 'completed' THEN 'verified'
  WHEN tx_id IS NOT NULL AND tx_id != '' THEN 'checking'
  ELSE 'awaiting'
END
WHERE tx_verification_status IS NULL OR tx_verification_status = 'awaiting';

-- Add check constraint for valid statuses
ALTER TABLE public.orders
ADD CONSTRAINT tx_verification_status_check 
CHECK (tx_verification_status IN ('awaiting', 'received', 'checking', 'verified', 'failed'));
