-- Add session_id to contact_requests to link leads with chat sessions
ALTER TABLE public.contact_requests 
ADD COLUMN session_id uuid REFERENCES public.chat_sessions(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX idx_contact_requests_session_id ON public.contact_requests(session_id);