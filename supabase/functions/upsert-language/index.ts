import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, name } = await req.json();

    if (!code || !name) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: code and name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Supabase environment not configured");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Try to find by code
    const { data: existing, error: findError } = await supabase
      .from("languages")
      .select("*")
      .eq("code", code)
      .maybeSingle();

    if (findError) throw findError;

    if (existing) {
      return new Response(
        JSON.stringify({ language: existing }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert a new language
    const { data: inserted, error: insertError } = await supabase
      .from("languages")
      .insert({ code, name, is_popular: false })
      .select("*")
      .single();

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ language: inserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in upsert-language:", error);
    return new Response(
      JSON.stringify({ error: error.message ?? "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
