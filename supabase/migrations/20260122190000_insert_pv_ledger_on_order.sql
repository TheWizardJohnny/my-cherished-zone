-- Migration: Insert PV ledger entry after new order
-- Date: 2026-01-22

CREATE OR REPLACE FUNCTION public.insert_pv_ledger_for_order()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.pv_earned > 0 THEN
    INSERT INTO public.pv_ledger (
      user_id,
      order_id,
      amount,
      leg_side,
      event_type,
      note
    ) VALUES (
      NEW.user_id,
      NEW.id,
      NEW.pv_earned,
      'personal',
      'order',
      'PV from product purchase'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS insert_pv_ledger_on_order ON public.orders;
CREATE TRIGGER insert_pv_ledger_on_order
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.insert_pv_ledger_for_order();
