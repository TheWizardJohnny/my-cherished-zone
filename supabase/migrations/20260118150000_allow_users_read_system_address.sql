-- Allow all authenticated users to read the system_usdt_address setting
-- This is needed so users can see where to send payments when placing orders

CREATE POLICY "Anyone can view system_usdt_address" ON public.settings FOR SELECT
USING (
  key = 'system_usdt_address' AND auth.uid() IS NOT NULL
);
