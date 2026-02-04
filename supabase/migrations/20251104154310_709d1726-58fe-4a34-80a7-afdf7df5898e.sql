-- Create Primary Business client
INSERT INTO public.clients (slug, name, domain, is_active)
VALUES ('widget', 'Primary Business', 'yourwebsite.com', true);

-- Move global documents to Primary Business client
UPDATE public.documents
SET client_id = (SELECT id FROM public.clients WHERE slug = 'widget')
WHERE client_id IS NULL;

-- Create indexes for optimization
CREATE INDEX IF NOT EXISTS idx_user_roles_admin 
ON public.user_roles(user_id) 
WHERE role = 'admin';

CREATE INDEX IF NOT EXISTS idx_documents_client_id 
ON public.documents(client_id) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_chat_sessions_client_id 
ON public.chat_sessions(client_id, created_at DESC);