-- Convert delivery_address to JSONB to support structured address
ALTER TABLE public.orders
ALTER COLUMN delivery_address TYPE JSONB USING 
  CASE 
    WHEN delivery_address IS NULL THEN NULL
    ELSE jsonb_build_object(
      'street', delivery_address,
      'suburb', '',
      'town', '',
      'postal_code', '',
      'country', ''
    )
  END;

-- Add comment to document the structure
COMMENT ON COLUMN public.orders.delivery_address IS 'Structured address with fields: street, suburb, town, postal_code, country';
