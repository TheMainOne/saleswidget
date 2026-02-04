import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Get request body
    const { clientId } = await req.json();

    if (!clientId) {
      throw new Error('Client ID is required');
    }

    // Check if user has access to this client
    const { data: clientAccess } = await supabase
      .from('client_users')
      .select('id')
      .eq('client_id', clientId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!clientAccess) {
      throw new Error('Access denied to this client');
    }

    // Get client users
    const { data: clientUsers, error: clientUsersError } = await supabase
      .from('client_users')
      .select('id, user_id, created_at')
      .eq('client_id', clientId);

    if (clientUsersError) throw clientUsersError;

    if (!clientUsers || clientUsers.length === 0) {
      return new Response(
        JSON.stringify({ users: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user emails using admin API
    const usersWithEmails = await Promise.all(
      clientUsers.map(async (cu) => {
        const { data: { user: authUser } } = await supabase.auth.admin.getUserById(cu.user_id);
        return {
          id: cu.id,
          user_id: cu.user_id,
          created_at: cu.created_at,
          email: authUser?.email || 'Unknown',
          is_current_user: cu.user_id === user.id
        };
      })
    );

    return new Response(
      JSON.stringify({ users: usersWithEmails }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
