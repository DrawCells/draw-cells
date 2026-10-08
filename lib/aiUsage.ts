import { supabaseAdmin } from "./supabaseAdmin";

// Per-user daily limit on the AI chat, so one user (or one runaway loop) cannot
// run up an unbounded bill. Backed by the ai_usage_daily table (migration
// supabase/migrations/20261009120100_ai_usage_daily.sql); days are UTC.
//
// The limit is in input-token equivalents: each kind of token is weighted by
// its price relative to an uncached input token, so the number tracks cost.
// Counting raw tokens would mostly count cache reads — every iteration of the
// tool loop re-sends the whole history — which are the cheapest tokens billed.
// The weights match Claude Opus 5's pricing ($5 in / $25 out per million;
// cache writes 1.25x input, cache reads 0.1x); revisit them if the model
// changes.
const WEIGHTS = {
  input: 1,
  cacheWrite: 1.25,
  cacheRead: 0.1,
  output: 5,
};

// 2M input-equivalent tokens is about $10 per user per day at Opus 5 prices —
// dozens of multi-frame builds. Override per environment with
// AI_DAILY_TOKEN_LIMIT (e.g. lower on staging).
const DEFAULT_DAILY_LIMIT = 2_000_000;

export function dailyTokenLimit(): number {
  const raw = process.env.AI_DAILY_TOKEN_LIMIT;
  if (!raw) return DEFAULT_DAILY_LIMIT;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    // A typo must not silently remove the limit.
    console.error(
      `AI_DAILY_TOKEN_LIMIT="${raw}" is not a positive number; using ${DEFAULT_DAILY_LIMIT}.`,
    );
    return DEFAULT_DAILY_LIMIT;
  }
  return Math.floor(parsed);
}

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

export function weightedTokens(usage: TokenUsage): number {
  return Math.ceil(
    usage.input_tokens * WEIGHTS.input +
      (usage.cache_creation_input_tokens ?? 0) * WEIGHTS.cacheWrite +
      (usage.cache_read_input_tokens ?? 0) * WEIGHTS.cacheRead +
      usage.output_tokens * WEIGHTS.output,
  );
}

const todayUtc = () => new Date().toISOString().slice(0, 10);

// Today's weighted usage for the user. Throws on a database error: the caller
// decides whether to fail open or closed.
export async function usedToday(userId: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("ai_usage_daily")
    .select("weighted_tokens")
    .eq("user_id", userId)
    .eq("day", todayUtc())
    .maybeSingle();
  if (error) throw error;
  return Number(data?.weighted_tokens ?? 0);
}

export async function recordUsage(
  userId: string,
  usage: TokenUsage,
): Promise<void> {
  const { error } = await supabaseAdmin.rpc("record_ai_usage", {
    p_user_id: userId,
    p_input: usage.input_tokens,
    p_cache_read: usage.cache_read_input_tokens ?? 0,
    p_cache_write: usage.cache_creation_input_tokens ?? 0,
    p_output: usage.output_tokens,
    p_weighted: weightedTokens(usage),
  });
  if (error) throw error;
}
