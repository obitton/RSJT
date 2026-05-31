import type {
  ConversationMessageDirection,
  OutboundMessageStatus,
} from "@rsjt/shared";

const STALE_TAKEOVER_MINUTES = 60;

export function formatMessageDirection(
  direction: ConversationMessageDirection,
) {
  switch (direction) {
    case "inbound":
      return "Customer";
    case "outbound":
      return "Tech";
    case "internal":
      return "Internal";
  }
}

export function formatOutboundStatus(status: OutboundMessageStatus | string) {
  switch (status) {
    case "draft":
      return "Draft";
    case "blocked":
      return "Blocked (outbound disabled)";
    case "queued":
      return "Queued";
    case "accepted":
      return "Accepted";
    case "sent":
      return "Sent";
    case "delivered":
      return "Delivered";
    case "failed":
      return "Failed";
    case "undelivered":
      return "Undelivered";
    default:
      return status;
  }
}

export function isTakeoverStale(
  takeoverStartedAt: Date | null,
  now: Date = new Date(),
) {
  if (!takeoverStartedAt) {
    return false;
  }
  const elapsedMinutes =
    (now.getTime() - takeoverStartedAt.getTime()) / (60 * 1000);
  return elapsedMinutes >= STALE_TAKEOVER_MINUTES;
}

export function formatRelativeTime(date: Date | null, now: Date = new Date()) {
  if (!date) {
    return "Never";
  }
  const seconds = Math.max(
    0,
    Math.round((now.getTime() - date.getTime()) / 1000),
  );
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
