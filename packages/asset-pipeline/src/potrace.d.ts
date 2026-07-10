declare module "potrace" {
  export type TraceOptions = {
    threshold?: number;
    turdSize?: number;
    alphaMax?: number;
    optCurve?: boolean;
    optTolerance?: number;
    blackOnWhite?: boolean;
    color?: string;
    background?: string;
  };

  export function trace(
    file: string | Buffer,
    options: TraceOptions,
    callback: (error: Error | null, svg?: string) => void
  ): void;
}
