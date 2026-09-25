import type { StudioHostKind } from "@codex-avatar-studio/avatar-core";
import { useEffect, useState } from "react";
import { CONNECTOR_SNIPPETS, connectorSnippetsForLaunch } from "../components/connectorSnippets.js";
import type { StudioRoute } from "../router/studioRoute.js";
import { BrowserStoragePanel } from "../web/BrowserStoragePanel.js";
import { beginWebOpenRouterConnect, disconnectWebOpenRouter } from "../web/openRouterConnect.js";
import { DesktopOnlyNotice } from "../web/DesktopOnlyNotice.js";
import { showDesktopOnlyNotice, studioCapabilities } from "../web/studioCapabilities.js";
import { INSTALL_GUIDANCE, WEB_APP_VERSION } from "../web/webShell.js";

export function StudioRouteNotice({
  route,
  theme,
  onHome,
  onConnectors,
  onSettings,
  onTheme,
  onRefreshCatalog,
  catalogStatus,
  launchToken,
  host
}: {
  route: StudioRoute;
  theme: "dark" | "light" | "contrast";
  onHome: () => void;
  onConnectors: () => void;
  onSettings: () => void;
  onTheme: (theme: "dark" | "light" | "contrast") => void;
  onRefreshCatalog: () => void;
  catalogStatus: string;
  launchToken: string | null;
  host: StudioHostKind;
}) {
  const capabilities = studioCapabilities(host);
  const desktopOnly = showDesktopOnlyNotice(capabilities);
  const [mcpClients, setMcpClients] = useState<
    Array<{ id: string; name: string; permission: string; revoked: boolean; lastSeen: string | null }>
  >([]);
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [keyStatus, setKeyStatus] = useState<{ configured: boolean; source: string }>({
    configured: false,
    source: "none"
  });
  const [keyNotice, setKeyNotice] = useState("Credit usage was not returned by the host.");
  const [replacingKey, setReplacingKey] = useState(false);
  const [quiverStatus, setQuiverStatus] = useState<{
    available: boolean;
    configured: boolean;
    enabled: boolean;
    message: string;
  }>({
    available: true,
    configured: false,
    enabled: false,
    message: "QuiverAI stays off until you turn it on."
  });
  const [alwaysPreview, setAlwaysPreview] = useState(() => {
    try {
      return window.localStorage.getItem("studio-always-preview") !== "no";
    } catch {
      return true;
    }
  });
  const [warnPaidModels, setWarnPaidModels] = useState(() => {
    try {
      return window.localStorage.getItem("studio-warn-paid") !== "no";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    if (desktopOnly) return;
    if (route.name === "settings") {
      void fetch("/api/openrouter-key", { credentials: "same-origin" })
        .then((response) => response.json())
        .then((body: { configured?: boolean; source?: string }) =>
          setKeyStatus({ configured: body.configured === true, source: body.source ?? "none" })
        )
        .catch(() => setKeyStatus({ configured: false, source: "none" }));
      void fetch("/api/quiver", { credentials: "same-origin" })
        .then((response) => response.json())
        .then((body: { available?: boolean; configured?: boolean; enabled?: boolean; message?: string }) =>
          setQuiverStatus({
            available: body.available !== false,
            configured: body.configured === true,
            enabled: body.enabled === true,
            message: body.message ?? "QuiverAI stays off until you turn it on."
          })
        )
        .catch(() =>
          setQuiverStatus({
            available: false,
            configured: false,
            enabled: false,
            message: "QuiverAI status is unavailable."
          })
        );
    }
    if (route.name === "connectors" && capabilities.mcp) {
      void fetch("/api/mcp-clients", { credentials: "same-origin" })
        .then((response) => response.json())
        .then((body: { clients?: typeof mcpClients }) => setMcpClients(body.clients ?? []))
        .catch(() => setMcpClients([]));
    }
  }, [capabilities.mcp, desktopOnly, route.name]);
  const loadClients = () => {
    if (!capabilities.mcp) return;
    void fetch("/api/mcp-clients", { credentials: "same-origin" })
      .then((response) => response.json())
      .then((body: { clients?: typeof mcpClients }) => setMcpClients(body.clients ?? []))
      .catch(() => setMcpClients([]));
  };
  const title =
    route.name === "connectors"
      ? "Connectors"
      : route.name === "settings"
        ? "Models & keys"
        : route.name === "gallery"
          ? "Gallery"
          : "Page not found";
  const message =
    route.name === "connectors"
      ? "Let coding agents read and edit this canvas over MCP. They connect to the Studio on this computer, and their changes appear live on the canvas where you can undo them."
      : route.name === "settings"
        ? "Keys stay on this computer. The page never shows a saved key."
        : route.name === "gallery"
          ? "The component gallery is available only in a development build."
          : "This address is not a Studio page.";
  return (
    <section className="studio-route-page" aria-labelledby="studio-route-title">
      <h1 id="studio-route-title">{title}</h1>
      <p>{message}</p>
      {route.name === "settings" ? (
        <div className="studio-settings">
          <nav aria-label="Settings">
            <button type="button" onClick={onHome}>
              Back to Home
            </button>
            <p className="studio-settings__label">Settings</p>
            <button
              type="button"
              onClick={() => document.getElementById("appearance")?.scrollIntoView({ block: "start" })}
            >
              Appearance
            </button>
            <button
              type="button"
              aria-current="page"
              onClick={() => document.getElementById("models")?.scrollIntoView({ block: "start" })}
            >
              Models & keys
            </button>
            <button type="button" onClick={onConnectors}>
              Connectors
            </button>
            <button
              type="button"
              onClick={() => document.getElementById("blender")?.scrollIntoView({ block: "start" })}
            >
              Blender
            </button>
            <button
              type="button"
              onClick={() => document.getElementById("privacy")?.scrollIntoView({ block: "start" })}
            >
              Privacy
            </button>
            <button
              type="button"
              onClick={() => document.getElementById("shortcuts")?.scrollIntoView({ block: "start" })}
            >
              Keyboard shortcuts
            </button>
          </nav>
          <div>
            <section id="models" className="studio-settings-card">
              <div className="studio-settings-card__title">
                <h2>OpenRouter</h2>
                <span
                  className={`studio-settings-card__status${keyStatus.configured ? " studio-settings-card__status--on" : ""}`}
                >
                  {keyStatus.configured ? "Connected" : "Not connected"}
                </span>
              </div>
              {desktopOnly ? (
                <>
                  <p>
                    OpenRouter connects from this browser. Requests go directly from this browser to OpenRouter. Kurva
                    has no server. The key stays on this device and is sent only to OpenRouter.
                  </p>
                  <div className="studio-settings-card__actions">
                    <button
                      type="button"
                      onClick={() => {
                        void beginWebOpenRouterConnect({
                          remember: true,
                          returnHash: window.location.hash || "#/settings",
                          origin: window.location.origin
                        });
                      }}
                    >
                      Connect
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void disconnectWebOpenRouter().then((links) => {
                          setKeyNotice(
                            links
                              ? "The key was removed from this browser. Revoke it on OpenRouter if you no longer want it."
                              : "No OpenRouter key was stored in this browser."
                          );
                          setKeyStatus({ configured: false, source: "none" });
                          if (links) {
                            setIssuedToken(null);
                            setKeyNotice(
                              `The key was removed from this browser. Revoke it at ${links.settingsUrl} and review activity at ${links.activityUrl}.`
                            );
                          }
                          window.dispatchEvent(new CustomEvent("kurva-web-openrouter", { detail: "disconnect" }));
                        });
                      }}
                    >
                      Disconnect
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <dl className="studio-settings-card__facts">
                    <div>
                      <dt>Key</dt>
                      <dd>{keyStatus.configured ? "Saved on this computer" : "Not shown"}</dd>
                    </div>
                    <div>
                      <dt>Stored in</dt>
                      <dd>
                        {keyStatus.source === "keychain"
                          ? "This computer's keychain"
                          : keyStatus.source === "environment"
                            ? "Environment variable"
                            : "Not stored"}
                      </dd>
                    </div>
                    <div>
                      <dt>Credit</dt>
                      <dd>Not returned</dd>
                    </div>
                  </dl>
                  {(!keyStatus.configured || replacingKey) && (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        const input = event.currentTarget.elements.namedItem("openrouter-key");
                        const key = input instanceof HTMLInputElement ? input.value : "";
                        void fetch("/api/openrouter-key", {
                          method: "POST",
                          credentials: "same-origin",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({ key })
                        })
                          .then((response) => response.json())
                          .then((body: { configured?: boolean; source?: string }) => {
                            setKeyStatus({ configured: body.configured === true, source: body.source ?? "none" });
                            setReplacingKey(false);
                            setKeyNotice(
                              body.configured
                                ? "Key saved on this computer."
                                : "The key was not saved. It is not shown."
                            );
                          })
                          .catch(() => setKeyNotice("The key was not saved. It is not shown."))
                          .finally(() => {
                            if (input instanceof HTMLInputElement) input.value = "";
                          });
                      }}
                    >
                      <label>
                        OpenRouter key
                        <input name="openrouter-key" type="password" autoComplete="off" aria-label="OpenRouter key" />
                      </label>
                      <div className="studio-settings-card__actions">
                        <button type="submit">Save key on this computer</button>
                        {replacingKey && (
                          <button type="button" onClick={() => setReplacingKey(false)}>
                            Cancel
                          </button>
                        )}
                      </div>
                    </form>
                  )}
                  <div className="studio-settings-card__actions">
                    <button
                      type="button"
                      onClick={() => {
                        void fetch("/api/openrouter-key", {
                          method: "POST",
                          credentials: "same-origin",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({ action: "test" })
                        })
                          .then((response) => response.json())
                          .then((body: { configured?: boolean }) =>
                            setKeyNotice(
                              body.configured
                                ? "A key is stored on this computer."
                                : "No OpenRouter key is stored on this computer."
                            )
                          )
                          .catch(() => setKeyNotice("The key could not be checked."));
                      }}
                    >
                      Test
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setReplacingKey(true);
                        window.requestAnimationFrame(() =>
                          document.querySelector<HTMLInputElement>('input[name="openrouter-key"]')?.focus()
                        );
                      }}
                    >
                      Replace key
                    </button>
                    <button
                      className="studio-settings-card__danger"
                      type="button"
                      onClick={() => {
                        void fetch("/api/openrouter-key", {
                          method: "POST",
                          credentials: "same-origin",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({ action: "disconnect" })
                        })
                          .then((response) => response.json())
                          .then((body: { configured?: boolean; source?: string }) => {
                            setKeyStatus({ configured: body.configured === true, source: body.source ?? "none" });
                            setReplacingKey(false);
                            setKeyNotice("The stored key was removed from this computer.");
                          })
                          .catch(() => setKeyNotice("The key could not be removed."));
                      }}
                    >
                      Disconnect
                    </button>
                  </div>
                  <p>{keyNotice}</p>
                  <p>Your key stays in the local Studio host. This page only learns whether a key is stored.</p>
                </>
              )}
            </section>
            <section className="studio-settings-card" aria-label="Chat defaults">
              <h2>Chat defaults</h2>
              <div className="studio-settings-card__row">
                <span>
                  <strong>Model for new conversations</strong>
                  <span>No default. Each conversation keeps the model you choose in the composer.</span>
                </span>
              </div>
              <label className="studio-settings-card__row">
                <span>
                  <strong>Warn before using a paid model</strong>
                  <span>Shows the model's price before the first message.</span>
                </span>
                <input
                  type="checkbox"
                  checked={warnPaidModels}
                  aria-label="Warn before using a paid model"
                  onChange={(event) => {
                    const next = event.target.checked;
                    setWarnPaidModels(next);
                    try {
                      window.localStorage.setItem("studio-warn-paid", next ? "yes" : "no");
                    } catch {
                      // The agent panel still receives the event for this page.
                    }
                    window.dispatchEvent(new Event("studio-warn-paid"));
                  }}
                />
              </label>
              <label className="studio-settings-card__row">
                <span>
                  <strong>Always show the full request preview</strong>
                  <span>Review instructions, history and attachments before each send.</span>
                </span>
                <input
                  type="checkbox"
                  checked={alwaysPreview}
                  aria-label="Always show the full request preview"
                  onChange={(event) => {
                    const next = event.target.checked;
                    setAlwaysPreview(next);
                    try {
                      window.localStorage.setItem("studio-always-preview", next ? "yes" : "no");
                    } catch {
                      // The agent panel still receives the event for this page.
                    }
                    window.dispatchEvent(new Event("studio-always-preview"));
                  }}
                />
              </label>
              <div className="studio-settings-card__row">
                <span>
                  <strong>Model catalog</strong>
                  <span>{catalogStatus}</span>
                </span>
                {desktopOnly ? null : (
                  <button type="button" onClick={onRefreshCatalog}>
                    Refresh catalog
                  </button>
                )}
              </div>
            </section>
            {desktopOnly || !capabilities.quiver ? (
              <section className="studio-settings-card" aria-label="Optional QuiverAI SVG generation">
                <h2>QuiverAI</h2>
                <DesktopOnlyNotice feature="QuiverAI" />
              </section>
            ) : (
              <section className="studio-settings-card" aria-label="Optional QuiverAI SVG generation">
                <div className="studio-settings-card__title">
                  <h2>QuiverAI</h2>
                  <span
                    className={`studio-settings-card__status${quiverStatus.enabled ? " studio-settings-card__status--on" : ""}`}
                  >
                    {quiverStatus.enabled ? "On" : "Off"}
                  </span>
                </div>
                <p>
                  Generates SVG from a prompt and a reference image you choose. Saving a key does not turn it on.
                  Turning it on can send that prompt and image to QuiverAI.
                </p>
                {quiverStatus.available ? (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      const input = event.currentTarget.elements.namedItem("quiver-key");
                      const key = input instanceof HTMLInputElement ? input.value : "";
                      void fetch("/api/quiver", {
                        method: "POST",
                        credentials: "same-origin",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ action: "save", key })
                      })
                        .then((response) => response.json())
                        .then(
                          (body: { available?: boolean; configured?: boolean; enabled?: boolean; message?: string }) =>
                            setQuiverStatus({
                              available: body.available !== false,
                              configured: body.configured === true,
                              enabled: body.enabled === true,
                              message: body.message ?? "The QuiverAI key was not saved."
                            })
                        )
                        .catch(() =>
                          setQuiverStatus({
                            available: false,
                            configured: false,
                            enabled: false,
                            message: "The QuiverAI key was not saved."
                          })
                        )
                        .finally(() => {
                          if (input instanceof HTMLInputElement) input.value = "";
                        });
                    }}
                  >
                    <label>
                      QuiverAI key
                      <input name="quiver-key" type="password" autoComplete="off" aria-label="QuiverAI API key" />
                    </label>
                    <div className="studio-settings-card__actions">
                      <button type="submit">Save key on this computer</button>
                      <button
                        type="button"
                        disabled={!quiverStatus.configured || quiverStatus.enabled}
                        onClick={() => {
                          void fetch("/api/quiver", {
                            method: "POST",
                            credentials: "same-origin",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({ action: "enable" })
                          })
                            .then((response) => response.json())
                            .then(
                              (body: {
                                available?: boolean;
                                configured?: boolean;
                                enabled?: boolean;
                                message?: string;
                              }) =>
                                setQuiverStatus({
                                  available: body.available !== false,
                                  configured: body.configured === true,
                                  enabled: body.enabled === true,
                                  message: body.message ?? "QuiverAI was not turned on."
                                })
                            )
                            .catch(() =>
                              setQuiverStatus((current) => ({ ...current, message: "QuiverAI was not turned on." }))
                            );
                        }}
                      >
                        Turn on for this session
                      </button>
                      <button
                        type="button"
                        disabled={!quiverStatus.enabled}
                        onClick={() => {
                          void fetch("/api/quiver", {
                            method: "POST",
                            credentials: "same-origin",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({ action: "disable" })
                          })
                            .then((response) => response.json())
                            .then(
                              (body: {
                                available?: boolean;
                                configured?: boolean;
                                enabled?: boolean;
                                message?: string;
                              }) =>
                                setQuiverStatus({
                                  available: body.available !== false,
                                  configured: body.configured === true,
                                  enabled: body.enabled === true,
                                  message: body.message ?? "QuiverAI was not turned off."
                                })
                            )
                            .catch(() =>
                              setQuiverStatus((current) => ({ ...current, message: "QuiverAI was not turned off." }))
                            );
                        }}
                      >
                        Turn off
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="studio-settings-card__actions">
                    <button type="button" disabled title={quiverStatus.message}>
                      Add key and turn on…
                    </button>
                  </div>
                )}
                <p>{quiverStatus.message}</p>
              </section>
            )}
            <section id="appearance">
              <h2>Appearance</h2>
              <p>Current theme: {theme}.</p>
              <div className="studio-settings__themes">
                {(["dark", "light", "contrast"] as const).map((next) => (
                  <button key={next} type="button" aria-pressed={theme === next} onClick={() => onTheme(next)}>
                    {next}
                  </button>
                ))}
              </div>
            </section>
            <section id="blender">
              <h2>Blender</h2>
              {desktopOnly || !capabilities.blender ? (
                <DesktopOnlyNotice feature="Blender" />
              ) : (
                <p>Check Blender from the editor Settings menu. A missing install does not change a scene file.</p>
              )}
            </section>
            {host === "web" ? <BrowserStoragePanel /> : null}
            <section id="privacy">
              <h2>Privacy</h2>
              <p>
                {desktopOnly
                  ? "The first send in a project asks before anything leaves this browser. Requests go directly to OpenRouter. Kurva has no server."
                  : "The first send in a project asks before anything leaves this computer. The key is not included."}
              </p>
              {host === "web" ? (
                <>
                  <p>
                    <a href="/privacy.html">What Kurva stores</a> · <a href="/notices.html">Notices</a> ·{" "}
                    <a href="https://github.com/uset82/blenderSVG">GitHub</a> ·{" "}
                    <a href="https://github.com/uset82/blenderSVG/releases">Get the desktop app for Blender and MCP</a>
                  </p>
                  <h3>Install</h3>
                  {INSTALL_GUIDANCE.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </>
              ) : null}
            </section>
            {host === "web" ? (
              <section id="about">
                <h2>About</h2>
                <p>Kurva {WEB_APP_VERSION}. Web edition. Tracing does not create a rigged or animated character.</p>
              </section>
            ) : null}
            <section id="shortcuts">
              <h2>Keyboard shortcuts</h2>
              <ul className="studio-settings-shortcuts">
                {[
                  ["Select", "V"],
                  ["Hand", "H"],
                  ["Frame", "F"],
                  ["Rectangle", "R"],
                  ["Pen", "P"],
                  ["Text", "T"],
                  ["Sticky note", "N"],
                  ["Image or SVG", "I"],
                  ["Trace image locally", "trace"],
                  ["Command palette", "Ctrl+K"],
                  ["Toggle panels", "Ctrl+\\"],
                  ["Undo", "Ctrl+Z"],
                  ["Redo", "Ctrl+Shift+Z"],
                  ["Duplicate", "Ctrl+D"],
                  ["Group", "Ctrl+G"],
                  ["Snapping", "Ctrl+Shift+S"],
                  ["Zoom to fit", "Shift+1"],
                  ["Zoom to selection", "Shift+2"],
                  ["Shortcut sheet", "?"]
                ].map(([label, keys]) => (
                  <li key={keys}>
                    <span>{label}</span>
                    <kbd>{keys}</kbd>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      ) : null}
      {route.name === "connectors" ? (
        desktopOnly ? (
          <DesktopOnlyNotice feature="MCP connectors" />
        ) : (
          <div className="studio-settings">
            <nav aria-label="Studio">
              <button type="button" onClick={onHome}>
                Back to Home
              </button>
              <button type="button" onClick={onSettings}>
                Settings
              </button>
            </nav>
            <div>
              <div className="studio-route-page__endpoint-row">
                <div className="studio-route-page__endpoint">
                  <span>MCP endpoint</span>
                  <span className="studio-route-page__endpoint-url">{`${window.location.origin}/mcp`}</span>
                  <button
                    type="button"
                    aria-label="Copy endpoint"
                    onClick={() => {
                      const endpoint = launchToken
                        ? `${window.location.origin}/mcp?studioToken=${encodeURIComponent(launchToken)}`
                        : `${window.location.origin}/mcp`;
                      void navigator.clipboard?.writeText(endpoint);
                    }}
                  >
                    Copy
                  </button>
                  <span className="studio-settings-card__status studio-settings-card__status--on">
                    Host running · loopback only
                  </span>
                </div>
              </div>
              <p className="studio-route-page__endpoint-note">
                {launchToken
                  ? "Visible snippets show the loopback endpoint. Copy snippet includes this session’s launch token."
                  : "Create a token before an IDE connects."}
              </p>
              <ul className="studio-route-page__connectors">
                {(launchToken
                  ? connectorSnippetsForLaunch(window.location.origin, launchToken)
                  : CONNECTOR_SNIPPETS
                ).map((connector) => {
                  const client = mcpClients.find((item) => item.name.toLowerCase() === connector.name.toLowerCase());
                  const status = !client ? "Not connected" : client.revoked ? "Revoked" : client.permission;
                  const copyText =
                    "copySnippet" in connector && typeof connector.copySnippet === "string"
                      ? connector.copySnippet
                      : connector.snippet;
                  return (
                    <li key={connector.id}>
                      <div className="studio-route-page__connector-title">
                        <h2>{connector.name}</h2>
                        <span
                          className={`studio-settings-card__status${client && !client.revoked ? " studio-settings-card__status--on" : ""}`}
                        >
                          {status}
                        </span>
                      </div>
                      <p>
                        {connector.file}
                        {client?.lastSeen ? ` · last seen ${client.lastSeen}` : ""}
                      </p>
                      <pre>{connector.snippet}</pre>
                      <div className="studio-route-page__connector-actions">
                        <select
                          aria-label={`Permission for ${connector.name}`}
                          {...(client && !client.revoked ? { value: client.permission } : { defaultValue: "read" })}
                          onChange={(event) => {
                            if (!client || client.revoked) return;
                            const permission = event.currentTarget.value;
                            void fetch("/api/mcp-clients", {
                              method: "POST",
                              credentials: "same-origin",
                              headers: { "content-type": "application/json" },
                              body: JSON.stringify({ action: "permission", id: client.id, permission })
                            }).then(() => loadClients());
                          }}
                        >
                          <option value="read">Read only</option>
                          <option value="propose">Propose</option>
                          <option value="apply">Apply</option>
                        </select>
                        {client && !client.revoked ? (
                          <button
                            className="studio-route-page__revoke"
                            type="button"
                            onClick={() => {
                              void fetch("/api/mcp-clients", {
                                method: "POST",
                                credentials: "same-origin",
                                headers: { "content-type": "application/json" },
                                body: JSON.stringify({ action: "revoke", id: client.id })
                              }).then(() => loadClients());
                            }}
                          >
                            Revoke
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(event) => {
                              const select = event.currentTarget.parentElement?.querySelector("select");
                              const permission =
                                select instanceof HTMLSelectElement &&
                                (select.value === "propose" || select.value === "apply")
                                  ? select.value
                                  : "read";
                              void fetch("/api/mcp-clients", {
                                method: "POST",
                                credentials: "same-origin",
                                headers: { "content-type": "application/json" },
                                body: JSON.stringify({ name: connector.name, permission })
                              })
                                .then((response) => response.json())
                                .then((body: { token?: string }) => {
                                  setIssuedToken(body.token ?? null);
                                  loadClients();
                                })
                                .catch(() => setIssuedToken(null));
                            }}
                          >
                            Create token
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard?.writeText(copyText);
                          }}
                        >
                          Copy snippet
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {issuedToken ? <p>Copy this token now. It will not be shown again. {issuedToken}</p> : null}
            </div>
          </div>
        )
      ) : null}
      <button className="studio-route-page__home" type="button" onClick={onHome}>
        Go to Home
      </button>
    </section>
  );
}
