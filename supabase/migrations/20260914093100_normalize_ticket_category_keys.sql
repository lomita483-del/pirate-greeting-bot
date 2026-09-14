-- Normalize dashboard ticket categories before they reach the tickets table.
-- This prevents human-readable labels such as "General Support" from
-- violating the category key constraint.

BEGIN;

CREATE OR REPLACE FUNCTION public.normalize_ticket_category_key()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  normalized text;
BEGIN
  normalized := lower(coalesce(NEW.category, 'support'));
  normalized := regexp_replace(normalized, '[^a-z0-9]+', '-', 'g');
  normalized := regexp_replace(normalized, '(^-+|-+$)', '', 'g');
  normalized := left(normalized, 40);

  IF normalized = '' THEN
    normalized := 'support';
  END IF;

  NEW.category := normalized;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tickets_normalize_category_key
ON public.tickets;

CREATE TRIGGER tickets_normalize_category_key
BEFORE INSERT OR UPDATE OF category
ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.normalize_ticket_category_key();

COMMIT;
