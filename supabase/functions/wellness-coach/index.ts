import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
const instructions = `You are SportHub's friendly, non-judgmental general wellness and physical-activity coach. Reply in the language the user uses (Bulgarian or English). Provide concise, practical, evidence-aware education and help with small sustainable habits. Do not assume the user wants advice before they ask. If their message is unclear, ask one short clarifying question; otherwise answer directly and ask a follow-up only when it genuinely helps, not automatically. You are not a doctor: never diagnose, prescribe, interpret lab results, recommend hormone panels or tell users to stop medication. Encourage a licensed clinician for individual symptoms and tests. Never create an alcohol detox or taper plan. If someone may be dependent on alcohol or has withdrawal symptoms, explain that suddenly stopping without medical help can be dangerous and encourage prompt professional care. Seizures, hallucinations, severe confusion, chest pain, or immediate danger: call 112 in Bulgaria/EU. Encourage emergency services for imminent self-harm. Do not request identifying/private details.`;

type ChatMessage = { role: "user" | "assistant"; content: string };
type GeminiResult = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
};

async function askGemini(
  apiKey: string,
  model: string,
  history: ChatMessage[],
  message: string,
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: instructions }] },
          contents: [...history, { role: "user", content: message }].map(
            (item) => ({
              role: item.role === "assistant" ? "model" : "user",
              parts: [{ text: item.content }],
            }),
          ),
          generationConfig: { maxOutputTokens: 650 },
        }),
      },
    );
    if (!response.ok) throw new Error(`Gemini returned ${response.status}`);
    const result = (await response.json()) as GeminiResult;
    const outputText = result.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();
    if (!outputText) throw new Error("Gemini returned no reply");
    return outputText;
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST")
    return json({ error: "Method not allowed." }, 405);

  const authorization = request.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!authorization || !supabaseUrl || !supabaseAnonKey)
    return json({ error: "Sign in to use the wellness assistant." }, 401);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user)
    return json({ error: "Sign in to use the wellness assistant." }, 401);

  let payload: { message?: unknown; history?: unknown };
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  if (
    typeof payload.message !== "string" ||
    payload.message.trim().length < 1 ||
    payload.message.length > 2000
  )
    return json(
      { error: "Message must be between 1 and 2000 characters." },
      400,
    );

  const history: ChatMessage[] = Array.isArray(payload.history)
    ? payload.history.slice(-8).flatMap((item): ChatMessage[] => {
        if (!item || typeof item !== "object") return [];
        const entry = item as { role?: unknown; content?: unknown };
        if (
          (entry.role !== "user" && entry.role !== "assistant") ||
          typeof entry.content !== "string"
        )
          return [];
        return [{ role: entry.role, content: entry.content.slice(0, 1200) }];
      })
    : [];
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) return json({ error: "AI_NOT_CONFIGURED" }, 503);

  try {
    const reply = await askGemini(
      geminiKey,
      Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash-lite",
      history,
      payload.message.trim(),
    );
    return json({ reply, provider: "gemini" });
  } catch (error) {
    console.error(
      "wellness-coach: Gemini failed",
      error instanceof Error ? error.message : "unknown",
    );
    return json(
      {
        error:
          "The assistant is temporarily unavailable. Please try again later.",
      },
      502,
    );
  }
});
