-- Create storage bucket for client logos
insert into storage.buckets (id, name, public)
values ('client-logos', 'client-logos', true);

-- RLS policies for client-logos bucket
CREATE POLICY "Anyone can view client logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'client-logos');

CREATE POLICY "Admins can upload client logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'client-logos' 
  AND (storage.foldername(name))[1] = 'logos'
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update client logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'client-logos'
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete client logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'client-logos'
  AND has_role(auth.uid(), 'admin'::app_role)
);