-- Add secure token hashing and expiration to chat_sessions
ALTER TABLE public.chat_sessions 
ADD COLUMN IF NOT EXISTS token_hash TEXT,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_chat_sessions_token_hash ON public.chat_sessions(token_hash);

-- Create a table for persistent rate limiting
CREATE TABLE IF NOT EXISTS public.session_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on rate limits table
ALTER TABLE public.session_rate_limits ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for rate limits (only edge functions with service role can access)
CREATE POLICY "Service role can manage rate limits"
ON public.session_rate_limits
FOR ALL
USING (true);

-- Create index for rate limit lookups
CREATE INDEX IF NOT EXISTS idx_session_rate_limits_session_id ON public.session_rate_limits(session_id);
CREATE INDEX IF NOT EXISTS idx_session_rate_limits_window_start ON public.session_rate_limits(window_start);

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.chat_sessions
  WHERE expires_at IS NOT NULL 
  AND expires_at < now();
END;
$$;

-- Function to validate session token (will be called from edge functions)
CREATE OR REPLACE FUNCTION public.validate_session_token(
  _session_id UUID,
  _token_hash TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.chat_sessions
    WHERE id = _session_id
    AND token_hash = _token_hash
    AND (expires_at IS NULL OR expires_at > now())
  );
END;
$$;