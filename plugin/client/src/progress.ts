/**
 * Live progress protocol (feature: real-time workflow status).
 *
 * Zero backend changes: the AGENT writes a `cae-progress.json` file into the
 * session workspace as it performs Abaqus operations, and this tab polls that
 * file (via BSB's fs.read route) to render a live stepper. The agent can write
 * it with any file tool — the file is the contract.
 *
 * File location: `<session workspace>/cae-progress.json`
 *
 * Schema:
 * {
 *   "sessionId": "...",            // optional, informational
 *   "updatedAt": "ISO-8601",        // optional
 *   "current": "5",                 // optional: n of the in-progress step
 *   "steps": [
 *     { "n": "1", "status": "done",    "at": "ISO" },
 *     { "n": "2", "status": "active",  "at": "ISO" },
 *     { "n": "5", "status": "error",   "error": "mesh failed",
 *       "detail": "seed size 20 too large for 50mm part", "at": "ISO" }
 *   ]
 * }
 *
 * status: "pending" | "active" | "done" | "error"
 *   - active  → node highlighted / pulsing (the step being executed now)
 *   - done    → green light
 *   - error   → red light + the card shows `error`/`detail` (where it broke)
 *   - pending → default when a step has no entry
 */

export type NodeStatus = 'pending' | 'active' | 'done' | 'error'

export interface ProgressNode {
  n: string
  status: NodeStatus
  at?: string
  /** Short one-line error summary shown on the node card. */
  error?: string
  /** Longer detail: where the problem is / how to fix. */
  detail?: string
}

export interface ProgressFile {
  sessionId?: string
  updatedAt?: string
  current?: string
  steps: ProgressNode[]
}

/** Parse the progress file; returns null when absent/invalid (→ guide mode). */
export function parseProgress(text: string): ProgressFile | null {
  if (!text) return null
  try {
    const j = JSON.parse(text)
    if (!j || !Array.isArray(j.steps)) return null
    const steps: ProgressNode[] = j.steps
      .filter((s: unknown) => s && typeof (s as { n?: unknown }).n !== 'undefined')
      .map((s: Record<string, unknown>) => ({
        n: String(s.n),
        status: (['pending', 'active', 'done', 'error'] as const).includes(s.status as NodeStatus)
          ? (s.status as NodeStatus)
          : 'pending',
        ...(typeof s.at === 'string' ? { at: s.at } : {}),
        ...(typeof s.error === 'string' ? { error: s.error } : {}),
        ...(typeof s.detail === 'string' ? { detail: s.detail } : {}),
      }))
    return {
      ...(typeof j.sessionId === 'string' ? { sessionId: j.sessionId } : {}),
      ...(typeof j.updatedAt === 'string' ? { updatedAt: j.updatedAt } : {}),
      ...(typeof j.current === 'string' ? { current: j.current } : {}),
      steps,
    }
  } catch {
    return null
  }
}

/** Index a progress file by step number for O(1) lookup. */
export function nodeMap(f: ProgressFile | null): Map<string, ProgressNode> {
  const m = new Map<string, ProgressNode>()
  if (f) for (const s of f.steps) m.set(String(s.n), s)
  return m
}

export const PROGRESS_FILENAME = 'cae-progress.json'
