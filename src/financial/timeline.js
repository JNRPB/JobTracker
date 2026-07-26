export function createTimelineEvent(type, message, extra = {}) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    message,
    at: new Date().toISOString(),
    ...extra,
  };
}

export function sortTimelineNewestFirst(events = []) {
  return [...events]
    .filter((event) => event?.at)
    .sort((a, b) => new Date(b.at) - new Date(a.at));
}

