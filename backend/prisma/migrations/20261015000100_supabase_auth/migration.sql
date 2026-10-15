-- Keep existing application UUIDs, roles and history while binding verified Auth identities.
ALTER TABLE public.users ADD COLUMN supabase_subject UUID;
CREATE UNIQUE INDEX users_supabase_subject_key ON public.users(supabase_subject);
