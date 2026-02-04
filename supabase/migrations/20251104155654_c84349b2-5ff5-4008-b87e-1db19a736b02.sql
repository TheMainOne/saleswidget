-- Add client_settings for Primary Business client
INSERT INTO public.client_settings (
  client_id,
  widget_title,
  welcome_message,
  primary_color,
  background_color,
  text_color,
  border_color
)
VALUES (
  (SELECT id FROM public.clients WHERE slug = 'widget'),
  'AI Assistant',
  'Hi! How can I help you today?',
  '#9b87f5',
  '#1A1F2C',
  '#ffffff',
  '#7E69AB'
);