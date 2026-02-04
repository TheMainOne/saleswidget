-- Fix security issues step by step to avoid deadlocks

-- First, drop the overly permissive SELECT policies
DROP POLICY "Anyone can view chat sessions" ON public.chat_sessions;
DROP POLICY "Anyone can view chat messages" ON public.chat_messages;

-- Create secure SELECT policies for authenticated users only
CREATE POLICY "Users can view their own chat sessions" 
ON public.chat_sessions 
FOR SELECT 
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can view messages from their own sessions" 
ON public.chat_messages 
FOR SELECT 
TO authenticated
USING (
  session_id IN (
    SELECT id FROM public.chat_sessions 
    WHERE user_id = auth.uid()
  )
);