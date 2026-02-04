-- ===============================================
-- Этап 1: Аутентификация и глобальная база знаний
-- ===============================================

-- 1. Создать enum для ролей пользователей
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- 2. Создать таблицу ролей пользователей
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Включить RLS для user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Создать функцию проверки роли (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

-- 4. RLS политика: только админы могут читать таблицу ролей
CREATE POLICY "Admins can view all roles"
  ON public.user_roles
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- 5. Обновить таблицу documents для глобальных документов
ALTER TABLE public.documents 
  ALTER COLUMN session_id DROP NOT NULL;

ALTER TABLE public.documents
  ADD COLUMN is_active BOOLEAN DEFAULT true,
  ADD COLUMN uploaded_by UUID;

-- Создать индекс для быстрого поиска активных документов
CREATE INDEX idx_documents_active ON public.documents(is_active) 
  WHERE is_active = true;

-- 6. Удалить старые RLS политики для documents
DROP POLICY IF EXISTS "Anonymous users can create their own documents" ON public.documents;
DROP POLICY IF EXISTS "Anonymous users can delete their own documents" ON public.documents;
DROP POLICY IF EXISTS "Anonymous users can view their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can create their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can delete their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can view their own documents" ON public.documents;

-- 7. Создать новые RLS политики для глобальных документов
CREATE POLICY "Anyone can view active global documents"
  ON public.documents
  FOR SELECT
  USING (is_active = true AND session_id IS NULL);

CREATE POLICY "Admins can insert global documents"
  ON public.documents
  FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') 
    AND session_id IS NULL
  );

CREATE POLICY "Admins can update global documents"
  ON public.documents
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin') AND session_id IS NULL)
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND session_id IS NULL);

CREATE POLICY "Admins can delete global documents"
  ON public.documents
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin') AND session_id IS NULL);

-- 8. Удалить старые RLS политики для document_chunks
DROP POLICY IF EXISTS "Anonymous users can create chunks for their documents" ON public.document_chunks;
DROP POLICY IF EXISTS "Anonymous users can delete their own document chunks" ON public.document_chunks;
DROP POLICY IF EXISTS "Anonymous users can view chunks from their documents" ON public.document_chunks;
DROP POLICY IF EXISTS "Users can create chunks for their documents" ON public.document_chunks;
DROP POLICY IF EXISTS "Users can delete chunks from their own documents" ON public.document_chunks;
DROP POLICY IF EXISTS "Users can view chunks from their documents" ON public.document_chunks;

-- 9. Создать новые RLS политики для document_chunks
CREATE POLICY "Anyone can view chunks from active global documents"
  ON public.document_chunks
  FOR SELECT
  USING (
    document_id IN (
      SELECT id FROM public.documents 
      WHERE is_active = true AND session_id IS NULL
    )
  );

CREATE POLICY "Admins can insert chunks for global documents"
  ON public.document_chunks
  FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    AND document_id IN (
      SELECT id FROM public.documents WHERE session_id IS NULL
    )
  );

CREATE POLICY "Admins can delete chunks from global documents"
  ON public.document_chunks
  FOR DELETE
  USING (
    public.has_role(auth.uid(), 'admin')
    AND document_id IN (
      SELECT id FROM public.documents WHERE session_id IS NULL
    )
  );

-- 10. Создать SQL функцию для векторного поиска (RAG)
CREATE OR REPLACE FUNCTION public.search_document_chunks(
  query_embedding vector(1536),
  similarity_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 3
)
RETURNS TABLE (
  content TEXT,
  title TEXT,
  file_name TEXT,
  similarity FLOAT
)
LANGUAGE SQL
STABLE
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
    AND (1 - (dc.embedding <=> query_embedding)) > similarity_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
$$;