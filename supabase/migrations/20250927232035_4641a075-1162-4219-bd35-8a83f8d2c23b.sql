-- Add missing SELECT policy for anonymous users to view anonymous chat sessions
CREATE POLICY "Anonymous users can view anonymous chat sessions" 
ON public.chat_sessions 
FOR SELECT 
TO anon
USING (user_id IS NULL);