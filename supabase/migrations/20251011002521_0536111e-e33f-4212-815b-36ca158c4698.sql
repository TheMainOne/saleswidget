-- Add search_path to search_document_chunks function for security
CREATE OR REPLACE FUNCTION public.search_document_chunks(
  query_embedding vector, 
  similarity_threshold double precision DEFAULT 0.7, 
  match_count integer DEFAULT 3
)
RETURNS TABLE(content text, title text, file_name text, similarity double precision)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
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
$function$;