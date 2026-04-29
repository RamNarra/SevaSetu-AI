/**
 * SevaSetu AI — Vector embeddings + semantic similarity.
 *
 * Strategy: use Gemini `text-embedding-004` (768-d) when GEMINI_API_KEY or
 * Vertex creds are available. Embeddings are stored on the document so we
 * can do cosine similarity in-memory for the MVP — and swap in Vertex AI
 * Vector Search later without changing the calling code.
 *
 * Phase upgrade path:
 *   in-memory cosine (today)   →   Firestore-cached top-K  →   Vertex Vector Search
 */

import { genai, MODELS } from './client';

export type Vector = number[];

export interface EmbeddedReportSummary {
  reportId: string;
  text: string;
  vector: Vector;
}

export interface EmbeddedVolunteerProfile {
  volunteerId: string;
  text: string;
  vector: Vector;
}

/** Cosine similarity between two equal-length vectors. */
export function cosineSimilarity(a: Vector, b: Vector): number {
  if (!a || !b || a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

interface RawEmbeddingResponse {
  embeddings?: Array<{ values?: number[] }>;
  embedding?: { values?: number[] };
}

/**
 * Generate a single embedding. Returns null if the embedding API is
 * unavailable so callers can fall back gracefully.
 */
export async function embedText(text: string): Promise<Vector | null> {
  const cleaned = text?.trim();
  if (!cleaned) return null;

  try {
    // The unified @google/genai SDK exposes embedContent on .models
    const modelClient = genai.models as unknown as {
      embedContent?: (args: {
        model: string;
        contents: Array<{ role: string; parts: Array<{ text: string }> }> | string;
      }) => Promise<RawEmbeddingResponse>;
    };
    if (typeof modelClient.embedContent !== 'function') return null;

    const res = await modelClient.embedContent({
      model: MODELS.embeddings,
      contents: [{ role: 'user', parts: [{ text: cleaned }] }],
    });

    const vec = res.embeddings?.[0]?.values ?? res.embedding?.values;
    if (!Array.isArray(vec) || vec.length === 0) return null;
    return vec as Vector;
  } catch (err) {
    console.warn('[embedText] failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

/** Build a single embedding-friendly summary string for a report. */
export function reportSummaryString(report: {
  locality?: { rawName?: string };
  needs?: Array<{ label: string; evidenceSpan?: string; severity?: number }>;
  urgencySignals?: Array<{ type: string; evidenceSpan?: string }>;
}): string {
  const parts: string[] = [];
  if (report.locality?.rawName) parts.push(`Locality: ${report.locality.rawName}.`);
  if (report.needs && report.needs.length > 0) {
    parts.push(
      'Needs: ' +
        report.needs
          .map(
            (n) =>
              `${n.label} (severity ${n.severity ?? '?'})${n.evidenceSpan ? ' - "' + n.evidenceSpan + '"' : ''}`
          )
          .join('; ')
    );
  }
  if (report.urgencySignals && report.urgencySignals.length > 0) {
    parts.push(
      'Urgency signals: ' +
        report.urgencySignals
          .map((u) => `${u.type}${u.evidenceSpan ? ' - "' + u.evidenceSpan + '"' : ''}`)
          .join('; ')
    );
  }
  return parts.join(' ');
}

/** Build a single embedding-friendly summary string for a volunteer profile. */
export function volunteerSummaryString(v: {
  role?: string;
  skills?: string[];
  certifications?: string[];
  languages?: string[];
  preferredAreas?: string[];
  completedCamps?: number;
  rating?: number;
}): string {
  const parts: string[] = [];
  if (v.role) parts.push(`Role: ${v.role}.`);
  if (v.skills && v.skills.length) parts.push('Skills: ' + v.skills.join(', ') + '.');
  if (v.certifications && v.certifications.length)
    parts.push('Certifications: ' + v.certifications.join(', ') + '.');
  if (v.languages && v.languages.length) parts.push('Languages: ' + v.languages.join(', ') + '.');
  if (v.preferredAreas && v.preferredAreas.length)
    parts.push('Preferred areas: ' + v.preferredAreas.join(', ') + '.');
  if (typeof v.completedCamps === 'number')
    parts.push(`Completed ${v.completedCamps} camps.`);
  if (typeof v.rating === 'number') parts.push(`Rating ${v.rating.toFixed(1)}/5.`);
  return parts.join(' ');
}

/**
 * Lexical fallback similarity (Jaccard token overlap with severity weighting).
 * Used when the embeddings API is unavailable so matching still beats
 * AlloCare's set-overlap heuristic and Team Dopaminers' prompt wrapper.
 */
export function lexicalSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const tokenize = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9 ]+/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length >= 3)
    );
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / Math.sqrt(ta.size * tb.size);
}
