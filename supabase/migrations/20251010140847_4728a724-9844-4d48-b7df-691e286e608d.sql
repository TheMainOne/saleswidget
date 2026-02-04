-- Добавить SELECT политику для администраторов
-- Это позволит админам видеть ВСЕ глобальные документы (активные и неактивные)

CREATE POLICY "Admins can view all global documents" ON public.documents
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) AND session_id IS NULL
);