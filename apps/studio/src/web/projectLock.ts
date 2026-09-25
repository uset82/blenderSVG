const CHANNEL = "kurva-library";

export interface ProjectLock {
  readonly: boolean;
  release(): void;
}

export function acquireProjectLock(projectId: string): Promise<ProjectLock> {
  if (!navigator.locks?.request) return Promise.resolve({ readonly: false, release() {} });
  return new Promise((resolve) => {
    void navigator.locks.request(`kurva-project:${projectId}`, { ifAvailable: true }, (lock) => {
      if (!lock) {
        resolve({ readonly: true, release() {} });
        return Promise.resolve();
      }
      return new Promise<void>((release) => {
        resolve({
          readonly: false,
          release() {
            release();
          }
        });
      });
    });
  });
}

export function requestProjectLockRelease(projectId: string): void {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(CHANNEL);
  channel.postMessage({ type: "release-project", projectId });
  channel.close();
}

export function listenForLockRelease(projectId: string, release: () => void): () => void {
  if (typeof BroadcastChannel === "undefined") return () => undefined;
  const channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (event: MessageEvent<{ type?: string; projectId?: string }>) => {
    if (event.data?.type === "release-project" && event.data.projectId === projectId) release();
  };
  return () => channel.close();
}

export function publishLibraryChange(): void {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(CHANNEL);
  channel.postMessage({ type: "library-changed" });
  channel.close();
}

export function subscribeLibraryChanges(onChange: () => void): () => void {
  if (typeof BroadcastChannel === "undefined") return () => undefined;
  const channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (event: MessageEvent<{ type?: string }>) => {
    if (event.data?.type === "library-changed") onChange();
  };
  return () => channel.close();
}
