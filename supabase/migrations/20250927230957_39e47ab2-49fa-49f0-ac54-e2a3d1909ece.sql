-- Update the remaining policies for secure operations

-- Drop the overly permissive INSERT and UPDATE policies
DROP POLICY "Anyone can create chat sessions" ON public.chat_sessions;
DROP POLICY "Anyone can update chat sessions" ON public.chat_sessions;
DROP POLICY "Anyone can create chat messages" ON public.chat_messages;

-- Create secure INSERT policies
CREATE POLICY "Users can create their own chat sessions" 
ON public.chat_sessions 
FOR INSERT 
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Anonymous users can create chat sessions" 
ON public.chat_sessions 
FOR INSERT 
TO anon
WITH CHECK (user_id IS NULL);

CREATE POLICY "Users can create messages in their own sessions" 
ON public.chat_messages 
FOR INSERT 
TO authenticated
WITH CHECK (
  session_id IN (
    SELECT id FROM public.chat_sessions 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Anonymous users can create messages in anonymous sessions" 
ON public.chat_messages 
FOR INSERT 
TO anon
WITH CHECK (
  session_id IN (
    SELECT id FROM public.chat_sessions 
    WHERE user_id IS NULL
  )
);

-- Create secure UPDATE policies
CREATE POLICY "Users can update their own chat sessions" 
ON public.chat_sessions 
FOR UPDATE 
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Anonymous users can update anonymous chat sessions" 
ON public.chat_sessions 
FOR UPDATE 
TO anon
USING (user_id IS NULL)
WITH CHECK (user_id IS NULL);