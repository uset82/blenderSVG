import { describe, expect, it } from "vitest";
import {
  guardStudioRequest,
  MAX_QUIVER_GENERATION_BODY_BYTES,
  readCookieToken,
  sessionCookie
} from "../src/hostSecurity.js";

const base = {
  method: "POST",
  host: "127.0.0.1:4173",
  urlHost: "127.0.0.1:4173",
  origin: "http://127.0.0.1:4173",
  cookieToken: "launch-token",
  queryToken: null,
  contentLength: 10,
  upgrade: false,
  launchToken: "launch-token",
  recentCount: 0
};

describe("studio host guard", () => {
  it("rejects a bad host, a bad origin, a missing token, and an oversized body", () => {
    expect(guardStudioRequest({ ...base, host: "evil.test", urlHost: "evil.test" }).status).toBe(421);
    expect(guardStudioRequest({ ...base, origin: "https://evil.test" }).status).toBe(403);
    expect(guardStudioRequest({ ...base, cookieToken: null, queryToken: null }).status).toBe(401);
    expect(guardStudioRequest({ ...base, contentLength: 2_000_000 }).status).toBe(413);
    expect(
      guardStudioRequest({ ...base, method: "GET", upgrade: true, origin: null, contentLength: null }).status
    ).toBe(403);
    expect(guardStudioRequest({ ...base, recentCount: 120 }).status).toBe(429);
  });

  it("sets a strict cookie only when the launch token is presented", () => {
    const decision = guardStudioRequest({
      ...base,
      method: "GET",
      cookieToken: null,
      queryToken: "launch-token",
      origin: null,
      contentLength: null
    });
    expect(decision.status).toBe(200);
    expect(decision.setCookie).toBe(true);
    expect(sessionCookie("launch-token")).toContain("HttpOnly");
    expect(sessionCookie("launch-token")).toContain("SameSite=Strict");
    expect(readCookieToken("studio_session=launch-token")).toBe("launch-token");
    expect(guardStudioRequest(base).headers["content-security-policy"]).toContain("default-src 'self'");
    expect(guardStudioRequest(base).headers["access-control-allow-origin"]).toBeUndefined();
    expect(guardStudioRequest({ ...base, method: "POST", origin: null }).status).toBe(200);
  });

  it("permits only the bounded Quiver generation payload size when the host route opts in", () => {
    expect(guardStudioRequest({ ...base, contentLength: 5_000_000 }).status).toBe(413);
    expect(
      guardStudioRequest({ ...base, contentLength: 5_000_000, maxBodyBytes: MAX_QUIVER_GENERATION_BODY_BYTES }).status
    ).toBe(200);
    expect(
      guardStudioRequest({
        ...base,
        contentLength: MAX_QUIVER_GENERATION_BODY_BYTES + 1,
        maxBodyBytes: MAX_QUIVER_GENERATION_BODY_BYTES
      }).status
    ).toBe(413);
  });

  it("replaces a stale session cookie when the new launch token is in the URL", () => {
    const decision = guardStudioRequest({
      ...base,
      method: "GET",
      cookieToken: "previous-launch",
      queryToken: "launch-token",
      origin: null,
      contentLength: null
    });
    expect(decision.status).toBe(200);
    expect(decision.setCookie).toBe(true);
  });
});
