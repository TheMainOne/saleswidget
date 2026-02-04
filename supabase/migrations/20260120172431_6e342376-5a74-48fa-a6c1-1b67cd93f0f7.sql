-- Fix the view to use security_invoker=on to prevent SECURITY DEFINER issues
DROP VIEW IF EXISTS public.clients_public;

CREATE VIEW public.clients_public
WITH (security_invoker=on) AS
SELECT id, slug, name, domain, is_active, created_at, updated_at
FROM public.clients
WHERE is_active = true;

-- Re-grant SELECT on the public view
GRANT SELECT ON public.clients_public TO anon, authenticated;