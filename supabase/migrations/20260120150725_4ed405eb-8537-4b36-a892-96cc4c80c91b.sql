-- Fix session_rate_limits exposure by restricting SELECT access
-- Drop the overly permissive policy and create a service-role-only policy
DROP POLICY IF EXISTS "Service role can manage rate limits" ON public.session_rate_limits;

-- Create separate policies for service role operations
-- Note: Service role bypasses RLS anyway, but we need to ensure anon users can't read
CREATE POLICY "Service role only - manage rate limits"
ON public.session_rate_limits
FOR ALL
USING (
  (current_setting('request.jwt.claims', true)::json ->> 'role') = 'service_role'
);

-- If the above doesn't work (service role bypasses RLS), we ensure no public access
-- by having no permissive policies for anon users