const UNKNOWN_IP = "unknown";

/**
 * Best-effort client IP address, used to rate-limit logins per email + IP (BR-004).
 *
 * Reads the first entry of `X-Forwarded-For`, then `X-Real-IP`, else `"unknown"`.
 *
 * WARNING: a client can forge these headers unless the app runs behind a
 * reverse proxy that overwrites them. The login limit depends on this value,
 * so production MUST run behind such a proxy (deployment requirement).
 */
export function getClientIp(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  const firstForwarded = forwardedFor?.split(",")[0]?.trim();
  if (firstForwarded) {
    return firstForwarded;
  }

  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  return UNKNOWN_IP;
}
