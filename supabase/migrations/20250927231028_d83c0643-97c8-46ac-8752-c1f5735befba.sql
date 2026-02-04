-- Add missing SELECT policy for anonymous users to view messages from anonymous sessions
CREATE POLICY "Anonymous users can view messages from anonymous sessions" 
ON public.chat_messages 
FOR SELECT 
TO anon
USING (
  session_id IN (
    SELECT id FROM public.chat_sessions 
    WHERE user_id IS NULL
  )
);