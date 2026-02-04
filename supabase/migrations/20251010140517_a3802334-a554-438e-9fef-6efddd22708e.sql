-- Обновляем RLS политику для UPDATE документов
-- Убираем избыточное условие WITH CHECK, которое блокирует обновление is_active

DROP POLICY IF EXISTS "Admins can update global documents" ON public.documents;

CREATE POLICY "Admins can update global documents" ON public.documents
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) AND session_id IS NULL
);