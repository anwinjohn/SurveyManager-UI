import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function genCaptchaId(): string {
  return "cap_" + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
}

function genCaptchaText(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let text = "";
  for (let i = 0; i < 5; i++) {
    text += chars[Math.floor(Math.random() * chars.length)];
  }
  return text;
}

// Generate a simple SVG CAPTCHA image as base64
function generateCaptchaImage(text: string): string {
  const width = 200;
  const height = 60;
  const fontSize = 28;
  const colors = ["#0ea5e9", "#0d9488", "#6366f1", "#dc2626", "#f59e0b", "#7c3aed"];

  let textElements = "";
  const charWidth = width / (text.length + 1);
  for (let i = 0; i < text.length; i++) {
    const x = charWidth * (i + 1) + (Math.random() - 0.5) * 10;
    const y = height / 2 + (Math.random() - 0.5) * 8;
    const rotation = (Math.random() - 0.5) * 30;
    const color = colors[Math.floor(Math.random() * colors.length)];
    textElements += `<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="${color}" text-anchor="middle" dominant-baseline="central" transform="rotate(${rotation} ${x} ${y})">${text[i]}</text>`;
  }

  // Add noise lines
  let noiseLines = "";
  for (let i = 0; i < 6; i++) {
    const x1 = Math.random() * width;
    const y1 = Math.random() * height;
    const x2 = Math.random() * width;
    const y2 = Math.random() * height;
    const color = colors[Math.floor(Math.random() * colors.length)];
    noiseLines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1" opacity="0.3" />`;
  }

  // Add noise dots
  let noiseDots = "";
  for (let i = 0; i < 30; i++) {
    const cx = Math.random() * width;
    const cy = Math.random() * height;
    const r = Math.random() * 1.5 + 0.5;
    const color = colors[Math.floor(Math.random() * colors.length)];
    noiseDots += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="0.4" />`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="#f8fafc" />
    ${noiseLines}
    ${noiseDots}
    ${textElements}
  </svg>`;

  // Convert SVG to base64
  const base64 = btoa(svg);
  return `data:image/svg+xml;base64,${base64}`;
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

    const url = new URL(req.url);
    const path = url.pathname.replace("/captcha", "");

    // GET /captcha — generate new CAPTCHA
    // POST /captcha/verify — verify CAPTCHA
    // POST /captcha — generate new CAPTCHA (alias)

    if (req.method === "POST" && path === "/verify") {
      const { captchaId, answer } = await req.json();

      if (!captchaId || !answer) {
        return new Response(
          JSON.stringify({ success: false, error: "captchaId and answer are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: captcha, error } = await supabase
        .from("captcha_sessions")
        .select("answer, expires_at, verified")
        .eq("captcha_id", captchaId)
        .maybeSingle();

      if (error || !captcha) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid or expired CAPTCHA" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (captcha.verified) {
        return new Response(
          JSON.stringify({ success: false, error: "CAPTCHA already used" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (new Date(captcha.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ success: false, error: "CAPTCHA expired" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (captcha.answer.toUpperCase() === String(answer).toUpperCase().trim()) {
        await supabase
          .from("captcha_sessions")
          .update({ verified: true })
          .eq("captcha_id", captchaId);

        return new Response(
          JSON.stringify({ success: true, message: "CAPTCHA verified" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        return new Response(
          JSON.stringify({ success: false, error: "Incorrect answer" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Generate new CAPTCHA (GET or POST)
    const captchaText = genCaptchaText();
    const captchaId = genCaptchaId();
    const imageBase64 = generateCaptchaImage(captchaText);

    const { error: insertError } = await supabase
      .from("captcha_sessions")
      .insert({
        captcha_id: captchaId,
        answer: captchaText,
        image_base64: imageBase64,
        verified: false,
      });

    if (insertError) {
      return new Response(
        JSON.stringify({ error: "Failed to create CAPTCHA session" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        captchaId,
        image: imageBase64,
        expiresIn: 600,
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
