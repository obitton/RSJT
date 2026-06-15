import type {
  ConversationMessageDirection,
  OutboundMessageStatus,
  UserRole,
} from "@rsjt/shared";

const STALE_TAKEOVER_MINUTES = 60;

// Internal attribution shown to managers and techs only. The customer never
// sees this label; their channel only ever carries the message body. A
// manager- or tech-authored message is named from authorRole, an inbound
// message is always the customer, and an outbound/internal message with no
// human author is the AI/system.
export function formatMessageSender(
  direction: ConversationMessageDirection,
  authorRole: UserRole | null,
) {
  if (direction === "inbound") {
    return "Customer";
  }
  if (authorRole === "manager") {
    return "Manager";
  }
  if (authorRole === "tech") {
    return "Tech";
  }
  return "Automated";
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
