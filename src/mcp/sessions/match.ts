import type { SessionRecord } from "../types";

// Match session names by exact, prefix, then contains order.
export function fuzzyMatchSession(sessions: SessionRecord[], query: string): SessionRecord[] {
  const exact = sessions.filter((session) => session.meta.session === query);
  if (exact.length > 0) {
    return exact;
  }

  const prefix = sessions.filter((session) => session.meta.session.startsWith(query));
  if (prefix.length > 0) {
    return prefix;
  }

  return sessions.filter((session) => session.meta.session.includes(query));
}
