-- Dashboard Activity and Command Audit history are no longer used.
-- Remove the tables so old rows cannot continue consuming Supabase database space.
DROP TABLE IF EXISTS public.activity_logs CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
