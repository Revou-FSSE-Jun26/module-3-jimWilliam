declare module "imagetracerjs" {
  interface ImageTracer {
    imagedataToSVG(imgd: { width: number; height: number; data: Uint8ClampedArray }, options?: Record<string, unknown>): string;
  }
  const tracer: ImageTracer;
  export default tracer;
}
