-- Create function to update session message count and last_message_at
CREATE OR REPLACE FUNCTION public.update_session_message_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_sessions
  SET 
    message_count = COALESCE(message_count, 0) + 1,
    last_message_at = NOW(),
    updated_at = NOW()
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on chat_messages table
DROP TRIGGER IF EXISTS on_message_insert ON chat_messages;
CREATE TRIGGER on_message_insert
AFTER INSERT ON chat_messages
FOR EACH ROW
EXECUTE FUNCTION update_session_message_count();

-- Fix existing data - update message_count for all existing sessions
UPDATE chat_sessions cs
SET message_count = (
  SELECT COUNT(*) FROM chat_messages cm 
  WHERE cm.session_id = cs.id
);