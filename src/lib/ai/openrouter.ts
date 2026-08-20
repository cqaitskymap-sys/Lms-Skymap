/**
 * OpenRouter chat completions client.
 * Uses OPENROUTER_API_KEY when configured; otherwise returns a clear error.
 */
import "server-only";

export type OpenRouterContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string | OpenRouterContentPart[];
}

export interface OpenRouterChatOptions {
  messages: OpenRouterMessage[];
  /** Override default model from OPENROUTER_MODEL */
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Prefer JSON object response when the model supports it */
  json?: boolean;
}

export type OpenRouterResult =
  | { ok: true; content: string; model: string }
  | { ok: false; error: string; status?: number };

export function isOpenRouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

export async function openRouterChat(
  options: OpenRouterChatOptions
): Promise<OpenRouterResult> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      error: "AI is not configured (OPENROUTER_API_KEY missing in .env.local)",
    };
  }

  const model =
    options.model ||
    process.env.OPENROUTER_MODEL?.trim() ||
    "openai/gpt-4o-mini";

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const appName = process.env.NEXT_PUBLIC_APP_NAME || "PharmaLMS";

  try {
    const body: Record<string, unknown> = {
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.4,
      max_tokens: options.maxTokens ?? 4096,
    };
    if (options.json) {
      body.response_format = { type: "json_object" };
    }

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": appUrl,
        "X-Title": appName,
      },
      body: JSON.stringify(body),
    });

    const raw = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: `OpenRouter error (${res.status}): ${raw.slice(0, 300)}`,
      };
    }

    let parsed: {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
    };
    try {
      parsed = JSON.parse(raw) as typeof parsed;
    } catch {
      return { ok: false, error: "Invalid JSON from OpenRouter" };
    }

    const content = parsed.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return { ok: false, error: "Empty response from OpenRouter" };
    }

    return { ok: true, content, model: parsed.model || model };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "OpenRouter request failed",
    };
  }
}

/** Extract a JSON object from model output (handles markdown fences). */
export function extractJsonObject<T = unknown>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] || text).trim();
  return JSON.parse(candidate) as T;
}
