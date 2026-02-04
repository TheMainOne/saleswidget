-- Fix function search_path mutable security warning
-- Add search_path to functions that don't have it set

-- Update cleanup_expired_sessions function
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.chat_sessions
  WHERE expires_at IS NOT NULL 
  AND expires_at < now();
END;
$function$;

-- Update validate_session_token function
CREATE OR REPLACE FUNCTION public.validate_session_token(_session_id uuid, _token_hash text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

-- Note: update_updated_at_column already has search_path set
-- Note: has_role already has search_path set
-- Note: search_document_chunks doesn't need it (STABLE function, no modifications)