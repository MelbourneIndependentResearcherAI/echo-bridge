// Netlify Function: /.netlify/functions/generate
//
// This runs on the server, not in the browser, so your Anthropic API key
// (set as an environment variable in Netlify's dashboard — never in the
// code) is never exposed to anyone using the site.

const ICON_NAMES = [
  "Leaf", "Droplet", "Sun", "Zap", "Book", "Brain", "Coffee", "Heart", "Wind",
  "Flame", "Star", "Target", "CheckCircle", "Lightbulb", "Clock", "MessageCircle",
  "Users", "Home", "Map", "Music", "Camera", "Palette", "Code", "Globe", "Smile",
  "TreePine", "Mountain", "Waves", "Cloud", "Moon", "Rocket", "Puzzle", "Compass",
  "Anchor", "Feather", "Gift", "Key", "Layers", "Shield", "Sparkles",
];

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400 });
  }

  const sourceText = (body?.sourceText || "").toString().trim();
  if (sourceText.length < 20) {
    return new Response(JSON.stringify({ error: "Source text is too short." }), { status: 400 });
  }
  if (sourceText.length > 20000) {
    return new Response(JSON.stringify({ error: "Source text is too long." }), { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server is not configured with an API key." }), { status: 500 });
  }

  const systemPrompt = `You convert source material into a short-form spoken learning feed for someone who focuses best in short, complete bursts. Break the content into 4-9 steps. Each step must be a single, complete idea, written exactly as it should be SPOKEN ALOUD as narration — natural spoken rhythm, no bullet-point phrasing, no headers, comfortable to say aloud in under 20 seconds (roughly 30-55 words), self-contained with no cliffhangers, plain conversational language. For each step also pick the single icon name that best represents it from this exact list: ${ICON_NAMES.join(", ")}. Also pick a mood color hex (a rich, saturated but not neon color that fits the step's feeling — warm for energetic/practical steps, cool for calm/technical ones). Respond ONLY with JSON, no markdown fences, no preamble: {"title": "short title for this whole topic", "steps": [{"text": "step narration text", "icon": "IconName", "color": "#RRGGBB"}]}`;

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: "user", content: `Source material:\n\n${sourceText}` }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      return new Response(JSON.stringify({ error: "Generation failed.", detail: errText }), { status: 502 });
    }

    const data = await anthropicRes.json();
    const textBlock = (data.content || []).find((b) => b.type === "text");
    const cleaned = (textBlock?.text || "").replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return new Response(JSON.stringify({ error: "Model returned unparseable output." }), { status: 502 });
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Unexpected server error." }), { status: 500 });
  }
};
