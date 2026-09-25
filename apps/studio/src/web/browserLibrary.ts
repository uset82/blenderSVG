export const KURVA_LIBRARY_DB = "kurva-library";
export const KURVA_LIBRARY_VERSION = 1;
export const LIBRARY_STORES = ["projects", "assets", "thumbnails", "conversations", "meta"] as const;

export interface StoredProjectRow {
  id: string;
  document: unknown;
}

export interface StoredAssetRow {
  id: string;
  contentType: "image/png" | "image/jpeg" | "image/svg+xml";
  data: ArrayBuffer;
  bytes: number;
}

export interface StoredThumbnailRow {
  projectId: string;
  data: ArrayBuffer;
}

/** Versioned upgrade. Version 1 creates the five library stores. */
export function upgradeKurvaLibrary(database: IDBDatabase, oldVersion: number): void {
  if (oldVersion < 1) {
    database.createObjectStore("projects", { keyPath: "id" });
    database.createObjectStore("assets", { keyPath: "id" });
    database.createObjectStore("thumbnails", { keyPath: "projectId" });
    const conversations = database.createObjectStore("conversations", { keyPath: "id" });
    conversations.createIndex("projectId", "projectId", { unique: false });
    database.createObjectStore("meta");
  }
}

let openDatabase: Promise<IDBDatabase> | null = null;
let openConnection: IDBDatabase | null = null;

export function closeLibraryForTests(): void {
  openConnection?.close();
  openConnection = null;
  openDatabase = null;
}

export function openKurvaLibrary(factory: IDBFactory = indexedDB): Promise<IDBDatabase> {
  if (!openDatabase || factory !== indexedDB) {
    openDatabase = new Promise((resolve, reject) => {
      const request = factory.open(KURVA_LIBRARY_DB, KURVA_LIBRARY_VERSION);
      request.onupgradeneeded = (event) => {
        upgradeKurvaLibrary(request.result, (event as IDBVersionChangeEvent).oldVersion);
      };
      request.onsuccess = () => {
        openConnection = request.result;
        resolve(request.result);
      };
      request.onerror = () => reject(request.error ?? new Error("Kurva could not open its library."));
    });
  }
  return openDatabase;
}

export function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("The library request failed."));
  });
}

export function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("The library write was aborted."));
    transaction.onerror = () => reject(transaction.error ?? new Error("The library write failed."));
  });
}

export function isQuotaError(error: unknown): boolean {
  return error instanceof DOMException && (error.name === "QuotaExceededError" || error.code === 22);
}
