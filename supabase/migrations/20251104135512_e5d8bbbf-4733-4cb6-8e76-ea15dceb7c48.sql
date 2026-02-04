-- Update the check constraint for knowledge_gaps status to include 'ignored'
ALTER TABLE knowledge_gaps 
DROP CONSTRAINT IF EXISTS knowledge_gaps_status_check;

ALTER TABLE knowledge_gaps 
ADD CONSTRAINT knowledge_gaps_status_check 
CHECK (status IN ('pending', 'in_progress', 'resolved', 'ignored'));