export function confidenceToBasisPoints(confidence: number) {
  return Math.round(confidence * 10000);
}
