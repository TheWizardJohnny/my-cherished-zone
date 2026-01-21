-- Commission System - Baseline Implementation
-- Rule: Products $100+ generate 10% direct referral commission to referrer

-- First, ensure commissions table has all needed columns
ALTER TABLE public.commissions 
ADD COLUMN IF NOT EXISTS commission_type TEXT DEFAULT 'direct_referral',
ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS percentage DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_commissions_order_id ON public.commissions(order_id);
CREATE INDEX IF NOT EXISTS idx_commissions_user_id ON public.commissions(user_id);
CREATE INDEX IF NOT EXISTS idx_commissions_type ON public.commissions(commission_type);

-- Function to calculate and create direct referral commission
CREATE OR REPLACE FUNCTION calculate_direct_referral_commission(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
    v_referrer_id UUID;
    v_commission_amount DECIMAL(10,2);
    v_commission_percentage DECIMAL(5,2) := 10.00;
BEGIN
    -- Get order details
    SELECT o.*, p.id as buyer_profile_id
    INTO v_order
    FROM orders o
    JOIN profiles p ON o.user_id = p.id
    WHERE o.id = p_order_id;
    
    -- Check if order exists and total_amount is $100 or more
    IF NOT FOUND OR v_order.total_amount < 100 THEN
        RETURN;
    END IF;
    
    -- Get the referrer (person who referred this buyer)
    SELECT referrer_id INTO v_referrer_id
    FROM referrals
    WHERE referred_user_id = v_order.buyer_profile_id;
    
    -- If no referrer found, no commission
    IF v_referrer_id IS NULL THEN
        RETURN;
    END IF;
    
    -- Calculate commission amount (10% of order total_amount)
    v_commission_amount := v_order.total_amount * (v_commission_percentage / 100);
    
    -- Create commission record
    INSERT INTO commissions (
        user_id,
        amount,
        type,
        status,
        order_id,
        commission_type,
        percentage,
        notes,
        created_at
    ) VALUES (
        v_referrer_id,
        v_commission_amount,
        'direct_referral',
        'pending',
        p_order_id,
        'direct_referral',
        v_commission_percentage,
        'Direct referral commission for order #' || p_order_id,
        NOW()
    );
    
    RAISE NOTICE 'Created direct referral commission: $ % for user %', v_commission_amount, v_referrer_id;
END;
$$;

-- Trigger function to automatically calculate commissions when order status changes
CREATE OR REPLACE FUNCTION trigger_calculate_commissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only calculate commissions when payment_status changes to 'completed'
    IF NEW.payment_status = 'completed' AND (OLD.payment_status IS NULL OR OLD.payment_status != 'completed') THEN
        -- Calculate direct referral commission
        PERFORM calculate_direct_referral_commission(NEW.id);
    END IF;
    
    RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS orders_commission_trigger ON public.orders;

-- Create trigger on orders table
CREATE TRIGGER orders_commission_trigger
AFTER INSERT OR UPDATE OF payment_status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION trigger_calculate_commissions();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION calculate_direct_referral_commission(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION trigger_calculate_commissions() TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION calculate_direct_referral_commission IS 
'Calculates 10% direct referral commission for orders $100 and above. Commission goes to the referrer.';
