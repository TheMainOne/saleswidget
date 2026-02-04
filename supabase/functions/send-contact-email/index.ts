import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContactEmailRequest {
  name: string;
  email: string;
  company?: string;
  message: string;
  request_type: string;
  website?: string; // Honeypot field - should always be empty
}

// Input validation
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const MAX_NAME_LENGTH = 100;
const MAX_COMPANY_LENGTH = 100;
const MAX_MESSAGE_LENGTH = 2000;

function validateInput(data: ContactEmailRequest): { valid: boolean; error?: string } {
  if (!data.name || data.name.trim().length === 0) {
    return { valid: false, error: "Name is required" };
  }
  if (data.name.length > MAX_NAME_LENGTH) {
    return { valid: false, error: `Name must be less than ${MAX_NAME_LENGTH} characters` };
  }
  
  if (!data.email || !EMAIL_REGEX.test(data.email)) {
    return { valid: false, error: "Valid email is required" };
  }
  
  if (data.company && data.company.length > MAX_COMPANY_LENGTH) {
    return { valid: false, error: `Company name must be less than ${MAX_COMPANY_LENGTH} characters` };
  }
  
  if (!data.message || data.message.trim().length === 0) {
    return { valid: false, error: "Message is required" };
  }
  if (data.message.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, error: `Message must be less than ${MAX_MESSAGE_LENGTH} characters` };
  }
  
  const validRequestTypes = ['demo_request', 'general_inquiry', 'sales_question', 'signup'];
  if (!validRequestTypes.includes(data.request_type)) {
    return { valid: false, error: "Invalid request type" };
  }
  
  return { valid: true };
}

// Rate limiting per IP
const RATE_LIMIT_WINDOW = 3600000; // 1 hour
const MAX_REQUESTS_PER_IP = 5;
const ipRateLimits = new Map<string, { count: number; resetTime: number }>();

function checkIPRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = ipRateLimits.get(ip);
  
  if (!record || now > record.resetTime) {
    ipRateLimits.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (record.count >= MAX_REQUESTS_PER_IP) {
    return false;
  }
  
  record.count++;
  return true;
}

function sanitizeHTML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // IP-based rate limiting
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 
               req.headers.get('x-real-ip') || 
               'unknown';
    
    if (!checkIPRateLimit(ip)) {
      console.warn(`Rate limit exceeded for IP: ${ip}`);
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        {
          status: 429,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const data: ContactEmailRequest = await req.json();

    // Honeypot check - if website field is filled, silently reject (it's a bot)
    if (data.website && data.website.trim().length > 0) {
      console.warn(`Bot detected (honeypot triggered) from IP: ${ip}`);
      // Return fake success to not alert the bot
      return new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }
    
    // Validate input
    const validation = validateInput(data);
    if (!validation.valid) {
      console.warn(`Validation failed: ${validation.error}`);
      return new Response(
        JSON.stringify({ error: validation.error }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const { name, email, company, message, request_type } = data;

    console.log("Sending contact email:", { name, email, request_type, ip });

    const requestTypeLabels: Record<string, string> = {
      demo_request: "Demo Request",
      general_inquiry: "General Inquiry",
      sales_question: "Sales Question",
      signup: "Sign Up Request",
    };

    const emailResponse = await resend.emails.send({
      from: "AI Sales Advisor <onboarding@resend.dev>",
      to: ["larinoko@gmail.com"],
      replyTo: email,
      subject: `New Contact Request: ${requestTypeLabels[request_type] || request_type}`,
      html: `
        <h2>New Contact Request from ${sanitizeHTML(name)}</h2>
        
        <p><strong>Email:</strong> ${sanitizeHTML(email)}</p>
        ${company ? `<p><strong>Company:</strong> ${sanitizeHTML(company)}</p>` : ""}
        <p><strong>Request Type:</strong> ${requestTypeLabels[request_type] || request_type}</p>
        
        <h3>Message:</h3>
        <p>${sanitizeHTML(message).replace(/\n/g, "<br>")}</p>
        
        <hr>
        <p style="color: #666; font-size: 12px;">
          You can reply directly to this email to respond to ${sanitizeHTML(name)}.
        </p>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-contact-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
