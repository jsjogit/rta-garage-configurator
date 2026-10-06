// web/src/renders/__tests__/manifest.test.ts
import { describe, expect, it } from 'vitest'
import catalog from '../../../../data/catalog.json'
import manifest from '../../../../data/render-manifest.json'
import available from '../available.json'

const skus = [
  ...(catalog as { cabinets: { sku: string }[] }).cabinets.map((c) => c.sku),
  ...(catalog as { countertops: { sku: string }[] }).countertops.map((c) => c.sku),
]

describe('product images', () => {
  it('has a reference render for every catalog cabinet and countertop', () => {
    const missing = skus.filter((sku) => !(sku in manifest.renders))
    expect(missing).toEqual([])
  })

  it('has built images for every SKU in the manifest', () => {
    expect([...available].sort()).toEqual(Object.keys(manifest.renders).sort())
  })
})
