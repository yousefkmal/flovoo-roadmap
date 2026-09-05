import "server-only";

/**
 * Query embeddings for the semantic leg of search.
 *
 * The provider and model are configuration, not code (brief §7): any service
 * that speaks the OpenAI embeddings API shape works by pointing
 * `HELP_EMBEDDING_BASE_URL` at it. Nothing is called until a key is set, and a
 * failure degrades to lexical-only results rather than an error page — a
 * reader searching for help must never be blocked by a vendor outage.
 *
 * The vector column is 1536-wide (`help_article_chunks.embedding`), the width
 * the brief specifies. Models that support a `dimensions` parameter are asked
 * for exactly that; others must produce 1536-wide vectors natively.
 */

const apiKey = process.env.HELP_EMBEDDING_API_KEY;
const baseUrl = (process.env.HELP_EMBEDDING_BASE_URL || "https://api.openai.com/v1").replace(
  /\/$/,
  "",
);

export const EMBEDDING_DIMENSIONS = 1536;
export const EMBEDDING_MODEL = process.env.HELP_EMBEDDING_MODEL || "text-embedding-3-small";
export const isEmbeddingConfigured = Boolean(apiKey);

/** Models known to accept a `dimensions` request parameter. */
const SUPPORTS_DIMENSIONS = /^text-embedding-3/;

async function request(inputs: string[], timeoutMs: number): Promise<number[][] | null> {
  if (!apiKey) return null;

  try {
    const response = await fetch(`${baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: inputs,
        ...(SUPPORTS_DIMENSIONS.test(EMBEDDING_MODEL) ? { dimensions: EMBEDDING_DIMENSIONS } : {}),
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      console.warn(`help embeddings: request failed (${response.status})`);
      return null;
    }
    const payload = (await response.json()) as {
      data?: { embedding?: number[]; index?: number }[];
    };
    const items = payload.data ?? [];
    if (items.length !== inputs.length) {
      console.warn(`help embeddings: expected ${inputs.length} vectors, got ${items.length}`);
      return null;
    }
    // The API may return items out of order; `index` is authoritative.
    const vectors: number[][] = new Array(inputs.length);
    for (const [position, item] of items.entries()) {
      const vector = item.embedding;
      if (!Array.isArray(vector) || vector.length !== EMBEDDING_DIMENSIONS) {
        console.warn(
          `help embeddings: vector has ${vector?.length ?? 0} dimensions, expected ${EMBEDDING_DIMENSIONS}`,
        );
        return null;
      }
      vectors[item.index ?? position] = vector;
    }
    return vectors;
  } catch (error) {
    console.warn("help embeddings: request errored", error);
    return null;
  }
}

/** One query, embedded for search. Short timeout: a reader is waiting. */
export async function embedText(text: string): Promise<number[] | null> {
  const vectors = await request([text.slice(0, 2000)], 4000);
  return vectors?.[0] ?? null;
}

/**
 * A batch of passages, embedded for indexing. Longer timeout and chunked into
 * batches, because this runs on an admin save rather than in front of a reader.
 */
export async function embedTexts(texts: string[]): Promise<number[][] | null> {
  const BATCH = 32;
  const all: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const slice = texts.slice(i, i + BATCH).map((t) => t.slice(0, 8000));
    const vectors = await request(slice, 30000);
    if (!vectors) return null;
    all.push(...vectors);
  }
  return all;
}
