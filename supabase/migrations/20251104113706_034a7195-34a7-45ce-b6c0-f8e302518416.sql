-- Add system_prompt column to client_settings
ALTER TABLE public.client_settings 
ADD COLUMN system_prompt TEXT;

-- Add comment
COMMENT ON COLUMN public.client_settings.system_prompt IS 'Custom system prompt for ChatGPT API. If NULL, default prompt is used.';