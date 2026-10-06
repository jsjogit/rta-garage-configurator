// web/src/preview/assets.ts
/*
  Where an image or texture lives. Normally it is a file next to the page; in the shareable prototype
  the Artifact viewer loads nothing from outside the page, so the same paths resolve to data URIs that
  preview/load.ts installs before the app renders.
*/
let embedded: Record<string, string> = {}

export function setEmbeddedAssets(assets: Record<string, string>): void {
  embedded = assets
}

export function assetUrl(path: string): string {
  return embedded[path] ?? `${import.meta.env.BASE_URL}${path}`
}
