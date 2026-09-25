import { OPENROUTER_SECRET_KEY } from "@codex-avatar-studio/studio-host-core/openRouterConnection";
import {
  assertPkceState,
  buildOpenRouterAuthUrl,
  clearPkcePending,
  createCodeChallenge,
  createPkceMaterial,
  exchangeOpenRouterCode,
  OPENROUTER_CALLBACK_PATH,
  openRouterKeyLinks,
  readPkcePending,
  writePkcePending
} from "@codex-avatar-studio/studio-host-core/openRouterPkce";
import { browserOpenRouterSecretStore, setRememberOpenRouterKey, type WebSecretStore } from "./webSecretStore.js";

export async function beginWebOpenRouterConnect(input: {
  remember: boolean;
  returnHash: string;
  origin: string;
  assign?: (url: string) => void;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
}): Promise<void> {
  const material = createPkceMaterial();
  const challenge = await createCodeChallenge(material.verifier);
  writePkcePending(input.storage ?? window.sessionStorage, {
    ...material,
    returnHash: input.returnHash || "#/",
    remember: input.remember
  });
  const url = buildOpenRouterAuthUrl({
    callbackUrl: `${input.origin}${OPENROUTER_CALLBACK_PATH}?state=${encodeURIComponent(material.state)}`,
    challenge,
    keyLabel: "Kurva web"
  });
  (input.assign ?? ((next) => window.location.assign(next)))(url);
}

export async function completeWebOpenRouterConnect(input: {
  search: string;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  request?: typeof fetch;
  secrets?: WebSecretStore;
  replaceUrl?: (url: string) => void;
}): Promise<{ returnHash: string }> {
  const storage = input.storage ?? window.sessionStorage;
  const pending = readPkcePending(storage);
  const params = new URLSearchParams(input.search);
  try {
    if (!pending) throw new Error("This browser has no OpenRouter connection in progress.");
    assertPkceState(pending.state, params.get("state"));
    const code = params.get("code");
    if (!code) throw new Error("OpenRouter did not return an authorization code.");
    const key = await exchangeOpenRouterCode({
      code,
      verifier: pending.verifier,
      ...(input.request ? { request: input.request } : {})
    });
    setRememberOpenRouterKey(pending.remember);
    await (input.secrets ?? browserOpenRouterSecretStore()).store(OPENROUTER_SECRET_KEY, key);
    return { returnHash: pending.returnHash };
  } finally {
    clearPkcePending(storage);
    if (input.replaceUrl) input.replaceUrl(OPENROUTER_CALLBACK_PATH);
  }
}

export async function disconnectWebOpenRouter(secrets: WebSecretStore = browserOpenRouterSecretStore()): Promise<{
  settingsUrl: string;
  activityUrl: string;
} | null> {
  const key = await secrets.get(OPENROUTER_SECRET_KEY);
  const links = key ? await openRouterKeyLinks(key) : null;
  await secrets.delete(OPENROUTER_SECRET_KEY);
  return links;
}
