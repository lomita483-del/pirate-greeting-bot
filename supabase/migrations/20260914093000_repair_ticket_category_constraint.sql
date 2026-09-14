-- Repair production databases that still have the legacy ticket category check.
-- Dashboard-created ticket buttons may use arbitrary slug-safe category keys.

BEGIN;

ALTER TABLE public.tickets
  DROP CONSTRAINT IF EXISTS tickets_category_check;

-- Keep the category field safe for identifiers while allowing dashboard-defined
-- ticket types such as general-support, report-a-member, billing, appeals, etc.
ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_category_check
  CHECK (category ~ '^[a-z0-9-]{1,40}$');

COMMIT;
