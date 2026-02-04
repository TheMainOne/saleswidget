import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
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

    const { clientId, dateFrom, dateTo } = await req.json();

    if (!clientId) {
      return new Response(
        JSON.stringify({ error: 'clientId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user has access to this client
    const { data: clientUser } = await supabase
      .from('client_users')
      .select('*')
      .eq('user_id', user.id)
      .eq('client_id', clientId)
      .single();

    if (!clientUser) {
      return new Response(
        JSON.stringify({ error: 'Access denied to this client' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build date filter
    let dateFilter = '';
    const params: any[] = [clientId];
    let paramIndex = 2;

    if (dateFrom) {
      dateFilter += ` AND created_at >= $${paramIndex}`;
      params.push(dateFrom);
      paramIndex++;
    }
    if (dateTo) {
      dateFilter += ` AND created_at <= $${paramIndex}`;
      params.push(dateTo);
    }

    // Get aggregated stats
    const { data: stats } = await supabase.rpc('get_analytics_stats', {
      p_client_id: clientId,
      p_date_from: dateFrom || null,
      p_date_to: dateTo || null
    });

    // If RPC doesn't exist, calculate manually
    let totalSessions = 0;
    let totalMessages = 0;
    let averageMessagesPerSession = 0;

    let sessionsQuery = supabase
      .from('chat_sessions')
      .select('id, created_at, last_message_at, message_count, ip_address')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(100);

    // Apply date filters
    if (dateFrom) {
      sessionsQuery = sessionsQuery.gte('created_at', dateFrom);
    }
    if (dateTo) {
      sessionsQuery = sessionsQuery.lte('created_at', dateTo);
    }

    const { data: sessions, error: sessionsError } = await sessionsQuery;

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch sessions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    totalSessions = sessions?.length || 0;
    totalMessages = sessions?.reduce((sum, s) => sum + (s.message_count || 0), 0) || 0;
    averageMessagesPerSession = totalSessions > 0 ? totalMessages / totalSessions : 0;

    // Get first user message for each session
    const sessionsWithPreview = await Promise.all(
      (sessions || []).map(async (session) => {
        const { data: firstMessage } = await supabase
          .from('chat_messages')
          .select('content')
          .eq('session_id', session.id)
          .eq('role', 'user')
          .order('created_at', { ascending: true })
          .limit(1)
          .single();

        return {
          ...session,
          first_message: firstMessage?.content?.substring(0, 100) || 'No messages'
        };
      })
    );

    return new Response(
      JSON.stringify({
        stats: {
          totalSessions,
          totalMessages,
          averageMessagesPerSession: Math.round(averageMessagesPerSession * 10) / 10
        },
        sessions: sessionsWithPreview
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-analytics:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
