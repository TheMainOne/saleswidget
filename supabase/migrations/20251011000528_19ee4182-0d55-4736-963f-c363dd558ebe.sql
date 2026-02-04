-- Fix function search_path for security
-- This adds explicit search_path settings to functions that are missing them

-- Fix cleanup_expired_sessions function
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  DELETE FROM public.chat_sessions
  WHERE expires_at IS NOT NULL 
  AND expires_at < now();
END;
$function$;

-- Fix validate_session_token function
CREATE OR REPLACE FUNCTION public.validate_session_token(_session_id uuid, _token_hash text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.chat_sessions
    WHERE id = _session_id
    AND token_hash = _token_hash
    AND (expires_at IS NULL OR expires_at > now())
  );
END;
$function$;

-- Add ip_address column to chat_sessions for IP-based rate limiting
ALTER TABLE public.chat_sessions 
ADD COLUMN IF NOT EXISTS ip_address TEXT;