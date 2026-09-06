import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function genShortCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { eventTypeId, referenceId, payload, language } = body;

    if (!eventTypeId) {
      return new Response(
        JSON.stringify({ error: "eventTypeId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the survey bound to this event type
    const { data: survey, error: surveyError } = await supabase
      .from("surveys")
      .select("id, title, status")
      .eq("event_type_id", eventTypeId)
      .eq("status", "active")
      .maybeSingle();

    if (surveyError || !survey) {
      return new Response(
        JSON.stringify({ error: "No active survey found for event type: " + eventTypeId }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get base URL from master settings
    const { data: setting } = await supabase
      .from("master_settings")
      .select("value")
      .eq("key", "base_url")
      .maybeSingle();

    const baseUrl = setting?.value || "https://survey.pulse.app";

    // Generate unique short code
    let shortCode = genShortCode();
    let attempts = 0;
    while (attempts < 10) {
      const { data: existing } = await supabase
        .from("survey_instances")
        .select("id")
        .eq("short_code", shortCode)
        .maybeSingle();
      if (!existing) break;
      shortCode = genShortCode();
      attempts++;
    }

    const surveyUrl = `${baseUrl}/s/${shortCode}`;

    // Create the survey instance
    const { data: instance, error: instanceError } = await supabase
      .from("survey_instances")
      .insert({
        survey_id: survey.id,
        short_code: shortCode,
        event_type_id: eventTypeId,
        reference_id: referenceId || null,
        payload: payload || {},
        language: language || "en",
        status: "pending",
        survey_url: surveyUrl,
      })
      .select()
      .single();

    if (instanceError) {
      return new Response(
        JSON.stringify({ error: "Failed to create survey instance: " + instanceError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log audit entry
    await supabase.from("audit_log").insert({
      actor: "Event Engine",
      action: "Generated survey instance",
      target: `${survey.title} → ${shortCode}`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        instanceId: instance.id,
        shortCode: shortCode,
        surveyUrl: surveyUrl,
        surveyId: survey.id,
        surveyTitle: survey.title,
        language: language || "en",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
