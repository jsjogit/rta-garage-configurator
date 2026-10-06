// web/src/preview/virtual.d.ts
// Provided by the preview-data plugin in vite.config.ts: the baked grid (gzip, base64) and embedded
// images in the prototype build; null and empty everywhere else, so nothing else ever carries them.
declare module 'virtual:preview-data' {
  export const gridGzipBase64: string | null
  export const assets: Record<string, string>
}
