import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const authorization = request.headers.get('Authorization');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!authorization || !supabaseUrl || !supabaseAnonKey) return json({ error: 'Sign in to use the wellness assistant.' }, 401);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return json({ error: 'Sign in to use the wellness assistant.' }, 401);

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return json({ error: 'AI_NOT_CONFIGURED' }, 503);

  let payload: { message?: unknown; history?: unknown };
  try { payload = await request.json(); } catch { return json({ error: 'Invalid request.' }, 400); }
  if (typeof payload.message !== 'string' || payload.message.trim().length < 1 || payload.message.length > 2000) return json({ error: 'Message must be between 1 and 2000 characters.' }, 400);

  const history = Array.isArray(payload.history) ? payload.history.slice(-8).flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const entry = item as { role?: unknown; content?: unknown };
    if ((entry.role !== 'user' && entry.role !== 'assistant') || typeof entry.content !== 'string') return [];
    return [{ role: entry.role, content: entry.content.slice(0, 1200) }];
  }) : [];

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: Deno.env.get('OPENAI_MODEL') || 'gpt-4.1-mini',
        store: false,
        max_output_tokens: 650,
        instructions: `You are SportHub's friendly, non-judgmental general wellness and physical-activity coach. Reply in the language the user uses (Bulgarian or English). Provide concise, practical, evidence-aware education and help with small sustainable habits. Do not assume the user wants advice before they ask. If their message is unclear, ask one short clarifying question; otherwise answer directly and ask a follow-up only when it genuinely helps, not automatically. You are not a doctor: never diagnose, prescribe, interpret lab results, recommend hormone panels or tell users to stop medication. Encourage a licensed clinician for individual symptoms and tests. Never create an alcohol detox or taper plan. If someone may be dependent on alcohol or has withdrawal symptoms, explain that suddenly stopping without medical help can be dangerous and encourage prompt professional care. Seizures, hallucinations, severe confusion, chest pain, or immediate danger: call 112 in Bulgaria/EU. Encourage emergency services for imminent self-harm. Do not request identifying/private details.`,
        input: [...history, { role: 'user', content: payload.message.trim() }],
      }),
    });
    if (!response.ok) {
      const providerError = await response.json().catch(() => null) as { error?: { type?: string; code?: string } } | null;
      const errorType = providerError?.error?.type ?? 'unknown';
      const errorCode = providerError?.error?.code ?? 'unknown';
      const model = Deno.env.get('OPENAI_MODEL') || 'gpt-4.1-mini';
      console.error('wellness-coach: OpenAI request failed', { status: response.status, errorType, errorCode, model });
      if (response.status === 401) return json({ error: 'OPENAI_KEY_INVALID' }, 502);
      if (response.status === 429) return json({ error: 'OPENAI_RATE_LIMIT' }, 429);
      if (response.status === 403) return json({ error: 'OPENAI_ACCESS_DENIED' }, 502);
      if (response.status === 404) return json({ error: 'OPENAI_MODEL_NOT_FOUND' }, 502);
      if (response.status === 400) return json({ error: 'OPENAI_BAD_REQUEST' }, 502);
      return json({ error: 'The assistant is temporarily unavailable. Please try again later.' }, 502);
    }
    type ResponseTextPart = { type?: string; text?: string };
    type ResponseOutputItem = { content?: ResponseTextPart[] };
    type ResponsesResult = { output_text?: string; output?: ResponseOutputItem[] };
    const result = await response.json() as ResponsesResult;
    const outputText = typeof result.output_text === 'string'
      ? result.output_text
      : result.output?.flatMap((item) => item.content ?? []).find((part) => part.type === 'output_text')?.text;
    if (!outputText?.trim()) return json({ error: 'The assistant returned no reply.' }, 502);
    return json({ reply: outputText.trim() });
  } catch (error) {
    console.error('wellness-coach: internal failure', error instanceof Error ? error.name : 'unknown');
    return json({ error: 'The assistant is temporarily unavailable. Please try again later.' }, 502);
  }
});
