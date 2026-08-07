import type { HandleMessageStreamEvent } from "eve/client";

export function isChatTurnSettledEvent(event: HandleMessageStreamEvent) {
  return (
    event.type === "authorization.required" ||
    event.type === "session.completed" ||
    event.type === "session.failed" ||
    event.type === "session.waiting"
  );
}
