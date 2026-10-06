import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { existsSync, readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

/*
  virtual:preview-data carries the baked solver answers and embedded images into the shareable
  prototype (`vite build --mode preview`, after scripts/bake-preview.ts). In every other mode it is
  empty, so the normal app never carries a byte of it.
*/
function previewData(preview: boolean): Plugin {
  const id = 'virtual:preview-data'
  return {
    name: 'preview-data',
    resolveId: (source) => (source === id ? '\0' + id : null),
    load(resolved) {
      if (resolved !== '\0' + id) return null
      const dir = new URL('./src/preview/generated/', import.meta.url)
      if (!preview) return 'export const gridGzipBase64 = null; export const assets = {};'
      if (!existsSync(new URL('grid.json', dir))) throw new Error('Run scripts/bake-preview.ts first (npm run build:preview does).')
      const grid = gzipSync(readFileSync(new URL('grid.json', dir)), { level: 9 }).toString('base64')
      const assets = readFileSync(new URL('assets.json', dir), 'utf8')
      return `export const gridGzipBase64 = ${JSON.stringify(grid)}; export const assets = ${assets};`
    },
  }
}

export default defineConfig(({ mode }) => {
  const preview = mode === 'preview'
  return {
    plugins: [react(), previewData(preview), ...(preview ? [viteSingleFile()] : [])],
    build: preview ? { outDir: 'dist-preview', assetsInlineLimit: Number.MAX_SAFE_INTEGER } : undefined,
    server: {
      // `func start` serves the API on 7071; the web app calls /api/* either way.
      proxy: { '/api': 'http://localhost:7071' },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test-setup.ts'],
      globals: true,
    },
  }
}) as never
