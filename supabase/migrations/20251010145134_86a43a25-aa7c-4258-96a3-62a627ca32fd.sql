-- Create contact_requests table
CREATE TABLE public.contact_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  message TEXT NOT NULL,
  request_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can submit contact requests
CREATE POLICY "Anyone can submit contact requests"
  ON public.contact_requests
  FOR INSERT
  WITH CHECK (true);

-- Policy: Admins can view all contact requests
CREATE POLICY "Admins can view all contact requests"
  ON public.contact_requests
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Add index on created_at for sorting
CREATE INDEX idx_contact_requests_created_at ON public.contact_requests(created_at DESC);