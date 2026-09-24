export const MAX_BODY_BYTES = 1_000_000;
export const MAX_REQUESTS_PER_WINDOW = 120;

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'"
].join("; ");

export interface StudioGuardInput {
  method: string;
  host: string;
  urlHost: string;
  origin: string | null;
  cookieToken: string | null;
  queryToken: string | null;
  contentLength: number | null;
  upgrade: boolean;
  launchToken: string;
  recentCount: number;
}

export interface StudioGuardDecision {
  status: number;
  message: string;
  setCookie: boolean;
  headers: Record<string, string>;
}

export function guardStudioRequest(input: StudioGuardInput): StudioGuardDecision {
  const headers = { "content-security-policy": CSP, "cache-control": "no-store" };
  if (input.recentCount >= MAX_REQUESTS_PER_WINDOW) {
    return { status: 429, message: "Too many requests.", setCookie: false, headers };
  }
  if (!isLoopbackHost(input.host) || !isLoopbackHost(input.urlHost)) {
    return { status: 421, message: "Unknown host.", setCookie: false, headers };
  }
  if ((input.contentLength ?? 0) > MAX_BODY_BYTES) {
    return { status: 413, message: "The request is too large.", setCookie: false, headers };
  }
  const method = input.method.toUpperCase();
  if (method === "OPTIONS") {
    return { status: 403, message: "Cross-origin requests are not accepted.", setCookie: false, headers };
  }
  const presented = input.cookieToken ?? input.queryToken;
  if (presented !== input.launchToken) {
    return { status: 401, message: "Missing or invalid session.", setCookie: false, headers };
  }
  if (input.upgrade || (method !== "GET" && method !== "HEAD")) {
    if (!input.origin || !originMatchesHost(input.origin, input.host)) {
      return { status: 403, message: "The request origin is not this Studio host.", setCookie: false, headers };
    }
  }
  return { status: 200, message: "", setCookie: input.cookieToken !== input.launchToken, headers };
}

export function sessionCookie(token: string): string {
  return `studio_session=${token}; HttpOnly; SameSite=Strict; Path=/`;
}

export function readCookieToken(header: string | null): string | null {
  if (!header) return null;
  const match = /(?:^|;\s*)studio_session=([^;]+)/.exec(header);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function isLoopbackHost(host: string): boolean {
  if (!host || host === ":") return true;
  const name = host
    .replace(/:\d+$/, "")
    .replace(/^\[|\]$/g, "")
    .toLowerCase();
  return name === "127.0.0.1" || name === "localhost" || name === "::1";
}

function originMatchesHost(origin: string, host: string): boolean {
  try {
    const parsed = new URL(origin);
    return isLoopbackHost(parsed.hostname) && parsed.host === host.replace(/^\[|\]$/g, "");
  } catch {
    return false;
  }
}
