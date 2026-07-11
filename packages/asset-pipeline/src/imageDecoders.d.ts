declare module "jimp" {
  const Jimp: {
    read(inputPath: string): Promise<{
      bitmap: { width: number; height: number; data: Buffer };
      greyscale(): this;
      threshold(options: { max: number; replace: number; autoGreyscale: boolean }): this;
      blur(radius: number): this;
    }>;
  };

  export default Jimp;
}

declare module "imagetracerjs" {
  const ImageTracer: {
    imagedataToSVG(
      image: { width: number; height: number; data: Uint8ClampedArray },
      options: Record<string, number | boolean>
    ): string;
  };

  export default ImageTracer;
}
