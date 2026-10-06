// web/src/components/SkuImage.tsx
import available from '../renders/available.json'
import { assetUrl } from '../preview/assets'

const HAS_IMAGE = new Set<string>(available)

/** The manufacturer's render of a SKU, or nothing when there isn't one (knee space, a new SKU). */
export function SkuImage({ sku, alt, size }: { sku: string; alt: string; size: 96 | 320 }) {
  if (!HAS_IMAGE.has(sku)) return null
  const shown = size === 96 ? 40 : 140
  return (
    <img
      className={`sku-image sku-image-${size}`}
      src={assetUrl(`renders/${sku}-${size}.webp`)}
      alt={alt}
      width={shown}
      height={shown}
      loading="lazy"
      decoding="async"
    />
  )
}
