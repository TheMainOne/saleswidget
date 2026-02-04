import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, title, fileName, clientId } = await req.json();
    
    if (!content || !title || !fileName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: content, title, fileName' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing document:', { title, fileName, userId: user.id, clientId });

    // Split into chunks (simple by paragraphs, ~500 chars each)
    const paragraphs = content.split(/\n\n+/).filter((p: string) => p.trim().length > 0);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const para of paragraphs) {
      if (currentChunk.length + para.length > 500 && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = para;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + para;
      }
    }
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    console.log(`Created ${chunks.length} chunks`);

    // Insert document
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .insert({
        title,
        file_name: fileName,
        content,
        file_size: content.length,
        uploaded_by: user.id,
        client_id: clientId || null,
        is_active: true,
      })
      .select()
      .single();

    if (docError) {
      console.error('Error inserting document:', docError);
      return new Response(
        JSON.stringify({ error: 'Failed to insert document', details: docError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Document inserted:', doc.id);

    // Generate embeddings and insert chunks
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Get embedding from OpenAI
      const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: chunk,
        }),
      });

      if (!embeddingResponse.ok) {
        const errorText = await embeddingResponse.text();
        console.error('OpenAI embedding error:', errorText);
        throw new Error(`OpenAI API error: ${embeddingResponse.status}`);
      }

      const embeddingData = await embeddingResponse.json();
      const embedding = embeddingData.data[0].embedding;

      // Insert chunk with embedding
      const { error: chunkError } = await supabase
        .from('document_chunks')
        .insert({
          document_id: doc.id,
          chunk_index: i,
          content: chunk,
          embedding,
        });

      if (chunkError) {
        console.error('Error inserting chunk:', chunkError);
        throw chunkError;
      }

      console.log(`Chunk ${i + 1}/${chunks.length} processed`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        documentId: doc.id,
        chunksProcessed: chunks.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in process-document:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
