import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// Crypto imports removed - using built-in crypto.subtle instead

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds
const MAX_REQUESTS_PER_HOUR = 100;
const MAX_REQUESTS_PER_IP = 300; // Per IP limit to prevent multi-session abuse

// Hash a token for secure storage/comparison using Web Crypto API
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// IP-based rate limiting to prevent multi-session abuse
async function checkIPRateLimit(supabase: any, ip: string): Promise<boolean> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - RATE_LIMIT_WINDOW);
  
  // Get count of requests from this IP in the last hour
  const { data: sessions, error } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('ip_address', ip)
    .gte('created_at', windowStart.toISOString());
  
  if (error) {
    console.error('Error checking IP rate limit:', error);
    return true; // Allow on error to prevent blocking legitimate users
  }
  
  if (!sessions || sessions.length === 0) {
    return true; // No sessions from this IP yet
  }
  
  // Count messages from all sessions from this IP
  const { count, error: countError } = await supabase
    .from('chat_messages')
    .select('*', { count: 'exact', head: true })
    .in('session_id', sessions.map((s: any) => s.id))
    .gte('created_at', windowStart.toISOString());
  
  if (countError) {
    console.error('Error counting IP messages:', countError);
    return true;
  }
  
  console.log(`IP ${ip} has made ${count || 0} requests in the last hour`);
  return (count || 0) < MAX_REQUESTS_PER_IP;
}

// Check and update rate limit in database
async function checkRateLimit(supabase: any, sessionId: string): Promise<boolean> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - RATE_LIMIT_WINDOW);

  // Get or create rate limit record
  const { data: existing } = await supabase
    .from('session_rate_limits')
    .select('*')
    .eq('session_id', sessionId)
    .gte('window_start', windowStart.toISOString())
    .single();

  if (!existing) {
    // Create new rate limit record
    await supabase
      .from('session_rate_limits')
      .insert({
        session_id: sessionId,
        request_count: 1,
        window_start: now.toISOString()
      });
    return true;
  }

  if (existing.request_count >= MAX_REQUESTS_PER_HOUR) {
    return false;
  }

  // Increment count
  await supabase
    .from('session_rate_limits')
    .update({
      request_count: existing.request_count + 1,
      updated_at: now.toISOString()
    })
    .eq('id', existing.id);

  return true;
}

// Get relevant context from knowledge base using RAG
async function getRelevantContext(supabase: any, message: string, openaiApiKey: string, clientId?: string): Promise<{ context: string, hasKnowledgeGap: boolean }> {
  try {
    console.log('🔍 RAG: Getting context for message:', message.substring(0, 50) + '...');
    
    let hasKnowledgeGap = false;
    
    // LEVEL 1: Quick answers for general questions
    const generalQuestions = [
      'что ты знаешь', 'что знаешь', 'расскажи о себе', 
      'что ты умеешь', 'что умеешь', 'кто ты', 'о чем ты'
    ];

    if (generalQuestions.some(q => message.toLowerCase().includes(q))) {
      console.log('🎯 General question detected, loading overview chunks');
      
      const { data: overviewChunks } = await supabase
        .from('document_chunks')
        .select('content, documents!inner(title, is_active, file_name)')
        .eq('documents.is_active', true)
        .is('documents.session_id', null)
        .order('chunk_index', { ascending: true })
        .limit(3);
        
      if (overviewChunks && overviewChunks.length > 0) {
        console.log(`✅ Quick answer: loaded ${overviewChunks.length} overview chunks`);
        const contextParts = overviewChunks.map((chunk: any) => 
          `[Источник: ${chunk.documents.title}]\n${chunk.content}`
        );
        return {
          context: `\n\nКонтекст из базы знаний:\n${contextParts.join('\n\n---\n\n')}`,
          hasKnowledgeGap: false
        };
      }
    }
    
    // LEVEL 2: Vector search with embeddings
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: message,
      }),
    });

    if (!embeddingResponse.ok) {
      console.error('❌ Failed to get embedding for RAG');
      return '';
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    let chunks = null;
    let searchError = null;
    let bestSimilarity = 0;
    
    // Attempt 1: Strict threshold (0.7, 3 chunks)
    ({ data: chunks, error: searchError } = await supabase
      .rpc('search_document_chunks', {
        query_embedding: queryEmbedding,
        client_id_filter: clientId || null,
        similarity_threshold: 0.7,
        match_count: 3,
      }));
    
    console.log(`📊 RAG: Strict search (0.7) found ${chunks?.length || 0} chunks`);
    
    if (chunks && chunks.length > 0) {
      bestSimilarity = Math.max(...chunks.map((c: any) => c.similarity || 0));
    }

    // Attempt 2: Relaxed threshold (0.5, 5 chunks)
    if (!chunks || chunks.length === 0) {
      hasKnowledgeGap = true; // Не нашли с хорошим порогом
      
      ({ data: chunks, error: searchError } = await supabase
        .rpc('search_document_chunks', {
          query_embedding: queryEmbedding,
          client_id_filter: clientId || null,
          similarity_threshold: 0.5,
          match_count: 5,
        }));
      
      console.log(`📊 RAG: Relaxed search (0.5) found ${chunks?.length || 0} chunks`);
      
      if (chunks && chunks.length > 0) {
        bestSimilarity = Math.max(...chunks.map((c: any) => c.similarity || 0));
      }
    }

    // LEVEL 3: Ultra-relaxed threshold (0.3)
    if (!chunks || chunks.length === 0) {
      hasKnowledgeGap = true;
      
      ({ data: chunks, error: searchError } = await supabase
        .rpc('search_document_chunks', {
          query_embedding: queryEmbedding,
          client_id_filter: clientId || null,
          similarity_threshold: 0.3,
          match_count: 5,
        }));
      
      console.log(`📊 RAG: Ultra-relaxed search (0.3) found ${chunks?.length || 0} chunks`);
      
      if (chunks && chunks.length > 0) {
        bestSimilarity = Math.max(...chunks.map((c: any) => c.similarity || 0));
      }
    }

    // LEVEL 4: Fallback to first chunks
    if (!chunks || chunks.length === 0) {
      hasKnowledgeGap = true;
      console.log('🔄 RAG: Fallback to first chunks');
      
      const { data: fallbackChunks } = await supabase
        .from('document_chunks')
        .select('content, documents!inner(title, is_active, file_name)')
        .eq('documents.is_active', true)
        .is('documents.session_id', null)
        .order('chunk_index', { ascending: true })
        .limit(3);
        
      if (fallbackChunks && fallbackChunks.length > 0) {
        console.log(`✅ Fallback: loaded ${fallbackChunks.length} chunks`);
        chunks = fallbackChunks.map((c: any) => ({
          content: c.content,
          title: c.documents.title,
          similarity: 0
        }));
      }
    }

    if (searchError || !chunks || chunks.length === 0) {
      console.log('⚠️ No relevant context found in knowledge base');
      return { context: '', hasKnowledgeGap: true };
    }

    console.log('✅ RAG: Found chunks:', chunks.map((c: any) => ({
      title: c.title,
      similarity: c.similarity?.toFixed(3)
    })));

    // Paraphrase context to prevent systematic knowledge base extraction
    // Remove source attribution and limit verbatim content
    const contextParts = chunks.map((chunk: any) => {
      const lines = chunk.content.split('\n').filter((line: string) => line.trim());
      // Use only first 3 lines, combined to prevent full document reconstruction
      return lines.slice(0, 3).join(' ').substring(0, 300);
    });

    return {
      context: `\n\nБаза знаний предоставляет следующую информацию:\n${contextParts.join('\n\n')}`,
      hasKnowledgeGap
    };
  } catch (error) {
    console.error('❌ Error getting context:', error);
    return { context: '', hasKnowledgeGap: true };
  }
}

// Get custom system prompt for client
async function getCustomSystemPrompt(supabase: any, clientId?: string): Promise<string | null> {
  if (!clientId) return null;
  
  try {
    const { data, error } = await supabase
      .from('client_settings')
      .select('system_prompt')
      .eq('client_id', clientId)
      .single();
    
    if (error || !data || !data.system_prompt) {
      return null;
    }
    
    return data.system_prompt;
  } catch (error) {
    console.error('Error fetching custom prompt:', error);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, sessionId, sessionToken, clientId } = await req.json();
    
    // Validate sessionId format if provided
    if (sessionId) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(sessionId)) {
        return new Response(
          JSON.stringify({ error: 'Invalid session ID format' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }
    
    // Validate message input
    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Message is required and must be a string' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      return new Response(
        JSON.stringify({ error: 'Message cannot be empty' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    if (trimmedMessage.length > 1000) {
      return new Response(
        JSON.stringify({ error: 'Message must be 1000 characters or less' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!openAIApiKey) {
      console.error('OpenAI API key not found');
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client with service role for validation
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

    // Get client IP for rate limiting
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    
    // Check IP-based rate limit
    const ipAllowed = await checkIPRateLimit(supabase, clientIP);
    if (!ipAllowed) {
      console.warn(`IP rate limit exceeded for: ${clientIP}`);
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded. Too many requests from your IP address. Please try again later.',
          code: 'IP_RATE_LIMIT_EXCEEDED'
        }),
        { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create or validate session
    let currentSessionId = sessionId;
    let currentSessionToken = sessionToken;
    
    if (!currentSessionId) {
      // Generate cryptographically secure token
      const tokenBytes = new Uint8Array(32);
      crypto.getRandomValues(tokenBytes);
      currentSessionToken = Array.from(tokenBytes, b => b.toString(16).padStart(2, '0')).join('');
      
      const tokenHash = await hashToken(currentSessionToken);
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      const { data: session, error: sessionError } = await supabase
        .from('chat_sessions')
        .insert({
          title: 'New Chat',
          token_hash: tokenHash,
          expires_at: expiresAt.toISOString(),
          ip_address: clientIP,
          client_id: clientId || null,
        })
        .select()
        .single();

      if (sessionError) {
        console.error('Error creating session:', sessionError);
        return new Response(JSON.stringify({ error: 'Failed to create chat session' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      currentSessionId = session.id;
    } else if (sessionToken) {
      // Validate existing session token
      const tokenHash = await hashToken(sessionToken);
      
      const { data: session } = await supabase
        .from('chat_sessions')
        .select('id')
        .eq('id', currentSessionId)
        .eq('token_hash', tokenHash)
        .single();

      if (!session) {
        return new Response(
          JSON.stringify({ error: 'Invalid session credentials' }),
          { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'Session token required' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Rate limiting check
    if (!await checkRateLimit(supabase, currentSessionId)) {
      console.warn('Rate limit exceeded for session:', currentSessionId);
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded. Please wait before sending more messages.' 
        }),
        { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Save user message
    const { error: userMessageError } = await supabase
      .from('chat_messages')
      .insert({
        session_id: currentSessionId,
        role: 'user',
        content: trimmedMessage
      });

    if (userMessageError) {
      console.error('Error saving user message:', userMessageError);
    }

    // Get chat history for context
    const { data: chatHistory } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('session_id', currentSessionId)
      .order('created_at', { ascending: true });

    // Get relevant context from knowledge base using RAG
    const { context, hasKnowledgeGap } = await getRelevantContext(supabase, trimmedMessage, openAIApiKey, clientId);

    // Get custom system prompt if available
    const customPrompt = await getCustomSystemPrompt(supabase, clientId);

    // Prepare system prompt
    let systemPrompt: string;

    if (customPrompt) {
      // Use custom prompt with context injection
      console.log('🎨 Using custom system prompt for client:', clientId);
      systemPrompt = context 
        ? `🌍 LANGUAGE RULE #1 (MANDATORY - READ THIS FIRST):
YOU MUST respond in the EXACT SAME LANGUAGE as the user's LAST message.
- User writes in Russian → You respond in Russian
- User writes in English → You respond in English
IGNORE the language of ALL previous messages. ONLY match the CURRENT message language.

${customPrompt}

${context}

🌍 REMINDER - LANGUAGE RULE (CRITICAL):
Match your response language to the user's CURRENT message language ONLY. This is mandatory.`
        : `🌍 LANGUAGE RULE #1 (MANDATORY - READ THIS FIRST):
YOU MUST respond in the EXACT SAME LANGUAGE as the user's LAST message.
- User writes in Russian → You respond in Russian
- User writes in English → You respond in English
IGNORE the language of ALL previous messages. ONLY match the CURRENT message language.

${customPrompt}

🌍 REMINDER - LANGUAGE RULE (CRITICAL):
Match your response language to the user's CURRENT message language ONLY. This is mandatory.`;
    } else {
      // Use default prompt
      console.log('📋 Using default system prompt');
      systemPrompt = context 
        ? `🌍 LANGUAGE RULE #1 (MANDATORY - READ THIS FIRST):
YOU MUST respond in the EXACT SAME LANGUAGE as the user's LAST message.
- User writes in Russian → You respond in Russian
- User writes in English → You respond in English
IGNORE the language of ALL previous messages. ONLY match the CURRENT message language.

You are a helpful AI assistant.

CONTENT RULES:
1. ALWAYS answer ONLY based on the knowledge base provided
2. For general questions - give a BRIEF overview (2-3 sentences) using ONLY information from the knowledge base
3. If specific information exists in the knowledge base - use it with exact details
4. If information is not in the knowledge base - honestly say so and suggest contacting support
5. DO NOT use general knowledge - ONLY the knowledge base provided

${context}

THE KNOWLEDGE BASE ABOVE IS THE ONLY SOURCE OF INFORMATION!

🌍 REMINDER - LANGUAGE RULE (CRITICAL):
Match your response language to the user's CURRENT message language ONLY. This is mandatory.`
        : `🌍 LANGUAGE RULE #1 (MANDATORY - READ THIS FIRST):
YOU MUST respond in the EXACT SAME LANGUAGE as the user's LAST message.
- User writes in Russian → You respond in Russian
- User writes in English → You respond in English
IGNORE the language of ALL previous messages. ONLY match the CURRENT message language.

You are a helpful AI assistant.

Unfortunately, there is no information in the knowledge base for your specific question.

Please contact support for more information.

🌍 REMINDER - LANGUAGE RULE (CRITICAL):
Match your response language to the user's CURRENT message language ONLY. This is mandatory.`;
    }

    const messages = [
      { 
        role: 'system', 
        content: systemPrompt 
      },
      ...(chatHistory || []).map(msg => ({
        role: msg.role,
        content: msg.content
      }))
    ];

    console.log('📝 System prompt preview:', systemPrompt.substring(0, 200) + '...');
    console.log('💬 Sending request to OpenAI with messages:', messages.length);
    console.log('🎯 Context included:', context ? 'YES' : 'NO');

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      return new Response(JSON.stringify({ error: 'Failed to get AI response' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const assistantMessage = data.choices[0].message.content;

    // Save assistant message
    const { error: assistantMessageError } = await supabase
      .from('chat_messages')
      .insert({
        session_id: currentSessionId,
        role: 'assistant',
        content: assistantMessage
      });

    if (assistantMessageError) {
      console.error('Error saving assistant message:', assistantMessageError);
    }

    // Track knowledge gap if detected
    if (hasKnowledgeGap && clientId) {
      console.log('⚠️ Knowledge gap detected, creating record');
      
      const { error: gapError } = await supabase
        .from('knowledge_gaps')
        .insert({
          client_id: clientId,
          session_id: currentSessionId,
          user_question: trimmedMessage,
          status: 'pending'
        });
      
      if (gapError) {
        console.error('Error creating knowledge gap:', gapError);
      } else {
        // Update session to mark it has knowledge gaps
        await supabase
          .from('chat_sessions')
          .update({ had_knowledge_gaps: true })
          .eq('id', currentSessionId);
      }
    }

    console.log('Chat completion successful for session:', currentSessionId);

    return new Response(JSON.stringify({ 
      message: assistantMessage,
      sessionId: currentSessionId,
      sessionToken: currentSessionToken
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in chat-completion function:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
