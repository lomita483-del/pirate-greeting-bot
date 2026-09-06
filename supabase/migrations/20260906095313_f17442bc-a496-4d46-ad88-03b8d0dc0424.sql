ALTER TABLE public.calendar_sources DROP CONSTRAINT IF EXISTS calendar_sources_source_type_check;
ALTER TABLE public.calendar_sources ADD CONSTRAINT calendar_sources_source_type_check CHECK (source_type = ANY (ARRAY['google'::text, 'ical'::text, 'manual'::text]));
ALTER TABLE public.event_notifiers ALTER COLUMN cleanup_mode SET DEFAULT 'delete_previous';