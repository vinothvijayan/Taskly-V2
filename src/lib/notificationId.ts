export function getSafeNotificationId(seed?: number) {
  // Use a provided seed or current timestamp for uniqueness
  const base = seed ?? Date.now();
  // Ensure the ID is within a safe range for Java int (approx. 2 billion)
  // We use modulo to keep it positive and within limits.
  return Math.floor(base % 2_000_000_000);
}
