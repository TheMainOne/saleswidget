-- Обновляем RLS политику для INSERT документов
-- Разрешаем вставку через service role (edge function) если uploaded_by - админ

DROP POLICY IF EXISTS "Admins can insert global documents" ON public.documents;

CREATE POLICY "Admins can insert global documents" ON public.documents
FOR INSERT 
WITH CHECK (
  session_id IS NULL AND (
    -- Разрешить service role (edge functions)
    auth.jwt() ->> 'role' = 'service_role' 
    OR 
    -- Или если пользователь - админ
    has_role(auth.uid(), 'admin')
  )
);