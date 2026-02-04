-- Add DELETE policies for chat_sessions
-- Authenticated users can delete their own sessions
CREATE POLICY "Users can delete their own chat sessions"
ON public.chat_sessions
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Anonymous users can delete their own sessions
CREATE POLICY "Anonymous users can delete their own chat sessions"
ON public.chat_sessions
FOR DELETE
TO anon
USING (
  user_id IS NULL 
  AND session_token IS NOT NULL 
  AND session_token = (current_setting('request.jwt.claims', true)::json ->> 'session_token')
);

-- Add DELETE policies for chat_messages
-- Authenticated users can delete messages from their sessions
CREATE POLICY "Users can delete messages from their own sessions"
ON public.chat_messages
FOR DELETE
TO authenticated
USING (
  session_id IN (
    SELECT id FROM chat_sessions WHERE user_id = auth.uid()
  )
);

-- Anonymous users can delete their own messages
CREATE POLICY "Anonymous users can delete their own messages"
ON public.chat_messages
FOR DELETE
TO anon
USING (
  session_id IN (
    SELECT id FROM chat_sessions 
    WHERE user_id IS NULL 
    AND session_token IS NOT NULL 
    AND session_token = (current_setting('request.jwt.claims', true)::json ->> 'session_token')
  )
);

-- Add DELETE policies for documents
-- Authenticated users can delete their own documents
CREATE POLICY "Users can delete their own documents"
ON public.documents
FOR DELETE
TO authenticated
USING (
  session_id IN (
    SELECT id FROM chat_sessions WHERE user_id = auth.uid()
  )
);

-- Anonymous users can delete their own documents
CREATE POLICY "Anonymous users can delete their own documents"
ON public.documents
FOR DELETE
TO anon
USING (
  session_id IN (
    SELECT id FROM chat_sessions 
    WHERE user_id IS NULL 
    AND session_token IS NOT NULL 
    AND session_token = (current_setting('request.jwt.claims', true)::json ->> 'session_token')
  )
);

-- Add DELETE policies for document_chunks
-- Authenticated users can delete chunks from their documents
CREATE POLICY "Users can delete chunks from their own documents"
ON public.document_chunks
FOR DELETE
TO authenticated
USING (
  document_id IN (
    SELECT id FROM documents 
    WHERE session_id IN (
      SELECT id FROM chat_sessions WHERE user_id = auth.uid()
    )
  )
);

-- Anonymous users can delete their own document chunks
CREATE POLICY "Anonymous users can delete their own document chunks"
ON public.document_chunks
FOR DELETE
TO anon
USING (
  document_id IN (
    SELECT id FROM documents 
    WHERE session_id IN (
      SELECT id FROM chat_sessions 
      WHERE user_id IS NULL 
      AND session_token IS NOT NULL 
      AND session_token = (current_setting('request.jwt.claims', true)::json ->> 'session_token')
    )
  )
);