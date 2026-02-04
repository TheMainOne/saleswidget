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

    const { userId, clientId } = await req.json();

    if (!userId || !clientId) {
      throw new Error('User ID and Client ID are required');
    }

    // Verify requesting user has access to this client
    const { data: clientAccess } = await supabase
      .from('client_users')
      .select('id')
      .eq('client_id', clientId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!clientAccess) {
      throw new Error('You do not have access to manage this client');
    }

    // Cannot remove yourself
    if (userId === user.id) {
      throw new Error('You cannot remove yourself from the team');
    }

    console.log('Removing user:', userId, 'from client:', clientId);

    // Remove user from client
    const { error: deleteError } = await supabase
      .from('client_users')
      .delete()
      .eq('client_id', clientId)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Error removing user:', deleteError);
      throw new Error('Failed to remove user');
    }

    return new Response(
      JSON.stringify({ success: true, message: 'User removed from team' }),
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
