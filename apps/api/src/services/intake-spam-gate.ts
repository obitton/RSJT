export type SpamCheckMessage = {
  body: string;
  hasMedia: boolean;
};

export type SpamGateInput = {
  current: SpamCheckMessage;
  recentMessages: SpamCheckMessage[];
};

export type SpamGateResult = {
  isBlocked: boolean;
  score: number;
  reason: string | null;
};

const URL_PATTERN = /https?:\/\/\S+/gi;
const HIGH_RISK_PHRASES = [
  "click here to claim",
  "verify your account",
  "wire transfer",
  "send bitcoin",
  "gift card",
];

export class IntakeSpamGate {
  evaluate(input: SpamGateInput): SpamGateResult {
    const body = input.current.body.trim();

    if (body.length === 0 && !input.current.hasMedia) {
      return { isBlocked: true, score: 1, reason: "Empty message" };
    }

    const urlCount = countMatches(body, URL_PATTERN);
    if (urlCount > 3) {
      return {
        isBlocked: true,
        score: urlCount,
        reason: "Too many links",
      };
    }

    const lowered = body.toLowerCase();
    const highRiskMatch = HIGH_RISK_PHRASES.find((phrase) =>
      lowered.includes(phrase),
    );
    if (highRiskMatch) {
      return {
        isBlocked: true,
        score: 5,
        reason: `High risk phrase: ${highRiskMatch}`,
      };
    }

    const duplicateCount = countDuplicates(input.recentMessages, body);
    if (duplicateCount >= 3) {
      return {
        isBlocked: true,
        score: duplicateCount,
        reason: "Repeated identical messages",
      };
    }

    return { isBlocked: false, score: duplicateCount, reason: null };
  }
}

function countMatches(value: string, pattern: RegExp) {
  return value.match(pattern)?.length ?? 0;
}

function countDuplicates(recentMessages: SpamCheckMessage[], body: string) {
  if (body.length === 0) {
    return 0;
  }
  const normalized = body.trim().toLowerCase();
  let count = 0;
  for (const message of recentMessages) {
    if (message.body.trim().toLowerCase() === normalized) {
      count += 1;
    }
  }
  return count;
}
