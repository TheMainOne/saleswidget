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

    const { email, clientId } = await req.json();

    if (!email || !clientId) {
      throw new Error('Email and Client ID are required');
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

    console.log('Adding user:', email, 'to client:', clientId);

    // Find user by email
    const { data: { users }, error: getUserError } = await supabase.auth.admin.listUsers();
    
    if (getUserError) {
      console.error('Error listing users:', getUserError);
      throw new Error('Failed to find user');
    }

    const targetUser = users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
    
    if (!targetUser) {
      throw new Error('User not found. They must register first.');
    }

    // Check if access already exists
    const { data: existingAccess } = await supabase
      .from('client_users')
      .select('id')
      .eq('user_id', targetUser.id)
      .eq('client_id', clientId)
      .maybeSingle();

    if (existingAccess) {
      throw new Error('User already has access to this dashboard');
    }

    // Grant access
    const { error: insertError } = await supabase
      .from('client_users')
      .insert({
        user_id: targetUser.id,
        client_id: clientId,
      });

    if (insertError) {
      console.error('Error granting access:', insertError);
      throw new Error('Failed to add user');
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `${email} has been added to the team`,
      }),
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
