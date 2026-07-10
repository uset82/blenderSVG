import { Assets, type Texture } from "pixi.js";

export type TextureLoader = (source: string) => Promise<Texture>;
export type TextureDestroyer = (texture: Texture) => void;

export type TextureCacheOptions = {
  load?: TextureLoader | undefined;
  destroy?: TextureDestroyer | undefined;
};

/**
 * Small, runtime-owned texture cache for local avatar assets.
 *
 * Loading is deduplicated by source and can be injected in tests or by a
 * future asset registry. The cache owns the loaded textures and destroys them
 * when removed, cleared, or disposed.
 */
export class PixiTextureCache {
  private readonly loadTexture: TextureLoader;
  private readonly destroyTexture: TextureDestroyer;
  private readonly textures = new Map<string, Texture>();
  private readonly pending = new Map<string, Promise<Texture>>();
  private generation = 0;
  private disposed = false;

  public constructor(options: TextureCacheOptions = {}) {
    this.loadTexture = options.load ?? ((source) => Assets.load<Texture>(source));
    this.destroyTexture = options.destroy ?? ((texture) => texture.destroy(true));
  }

  public async load(source: string): Promise<Texture> {
    const key = normalizeSource(source);
    if (this.disposed) throw new Error("Cannot load a texture after the cache has been disposed.");

    const cached = this.textures.get(key);
    if (cached) return cached;

    const existing = this.pending.get(key);
    if (existing) return existing;

    const generation = this.generation;
    const loadPromise = Promise.resolve(this.loadTexture(key))
      .then((texture) => {
        if (this.disposed || generation !== this.generation) {
          this.destroyTexture(texture);
          throw new Error("Texture load completed after the cache was cleared.");
        }
        this.textures.set(key, texture);
        return texture;
      })
      .finally(() => {
        if (this.pending.get(key) === loadPromise) this.pending.delete(key);
      });

    this.pending.set(key, loadPromise);
    return loadPromise;
  }

  public get(source: string): Texture | undefined {
    return this.textures.get(normalizeSource(source));
  }

  public has(source: string): boolean {
    return this.textures.has(normalizeSource(source));
  }

  public delete(source: string): boolean {
    const key = normalizeSource(source);
    const texture = this.textures.get(key);
    if (!texture) return false;
    this.textures.delete(key);
    this.destroyTexture(texture);
    return true;
  }

  public clear(): void {
    this.generation += 1;
    this.pending.clear();
    for (const texture of this.textures.values()) this.destroyTexture(texture);
    this.textures.clear();
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();
  }

  public get size(): number {
    return this.textures.size;
  }

  public get isDisposed(): boolean {
    return this.disposed;
  }
}

function normalizeSource(source: string): string {
  const key = source.trim();
  if (key.length === 0) throw new Error("Texture source must not be empty.");
  return key;
}
