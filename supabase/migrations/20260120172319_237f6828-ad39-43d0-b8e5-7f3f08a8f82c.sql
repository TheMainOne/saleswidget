-- Create a public view for clients that excludes sensitive api_key column
CREATE VIEW public.clients_public AS
SELECT id, slug, name, domain, is_active, created_at, updated_at
FROM public.clients
WHERE is_active = true;

-- Grant SELECT on the public view to anon and authenticated users
GRANT SELECT ON public.clients_public TO anon, authenticated;

-- Drop the insecure policy that exposes api_key
DROP POLICY IF EXISTS "Anyone can view active clients" ON public.clients;

-- Create restrictive policy: only admins and assigned client users can view client data (including api_key)
CREATE POLICY "Authorized users can view client data"
  ON public.clients FOR SELECT
  USING (
    has_role(auth.uid(), 'admin')
    OR id IN (SELECT client_id FROM public.client_users WHERE user_id = auth.uid())
  );