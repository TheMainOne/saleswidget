-- Create clients table
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  domain text,
  api_key text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'base64'),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create client_settings table
CREATE TABLE public.client_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL UNIQUE,
  widget_title text DEFAULT 'AI Assistant',
  welcome_message text DEFAULT 'Hi! How can I help you today?',
  primary_color text DEFAULT '#2927ea',
  background_color text DEFAULT '#0f0f0f',
  text_color text DEFAULT '#ffffff',
  logo_url text,
  custom_css text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add client_id to existing tables
ALTER TABLE public.documents 
ADD COLUMN client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE public.chat_sessions 
ADD COLUMN client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX idx_clients_slug ON public.clients(slug);
CREATE INDEX idx_clients_api_key ON public.clients(api_key);
CREATE INDEX idx_documents_client_id ON public.documents(client_id);
CREATE INDEX idx_chat_sessions_client_id ON public.chat_sessions(client_id);

-- Update search_document_chunks function with client_id filter
CREATE OR REPLACE FUNCTION public.search_document_chunks(
  query_embedding vector,
  client_id_filter uuid DEFAULT NULL,
  similarity_threshold double precision DEFAULT 0.7,
  match_count integer DEFAULT 3
)
RETURNS TABLE(content text, title text, file_name text, similarity double precision)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT 
    dc.content,
    d.title,
    d.file_name,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM public.document_chunks dc
  JOIN public.documents d ON d.id = dc.document_id
  WHERE d.is_active = true
    AND d.session_id IS NULL
    AND (d.client_id = client_id_filter OR (client_id_filter IS NULL AND d.client_id IS NULL) OR d.client_id IS NULL)
    AND (1 - (dc.embedding <=> query_embedding)) > similarity_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- RLS policies for clients
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active clients"
  ON public.clients FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage clients"
  ON public.clients FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS policies for client_settings
ALTER TABLE public.client_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view settings for active clients"
  ON public.client_settings FOR SELECT
  USING (
    client_id IN (SELECT id FROM public.clients WHERE is_active = true)
  );

CREATE POLICY "Admins can manage settings"
  ON public.client_settings FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Update documents policy
DROP POLICY IF EXISTS "Anyone can view active global documents" ON public.documents;

CREATE POLICY "Anyone can view active documents"
  ON public.documents FOR SELECT
  USING (
    is_active = true 
    AND session_id IS NULL
    AND (client_id IS NULL OR client_id IN (SELECT id FROM public.clients WHERE is_active = true))
  );

CREATE POLICY "Admins can insert client documents"
  ON public.documents FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin') 
    AND (client_id IN (SELECT id FROM public.clients) OR client_id IS NULL)
  );

-- Triggers for updated_at
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_client_settings_updated_at
  BEFORE UPDATE ON public.client_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();