// web/src/components/__tests__/SkuImage.test.tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SkuImage } from '../SkuImage'
import { Results } from '../Results'
import type { SolveResponse } from '../../api/types'
import vignette from '../../fixtures/vignette-72.json'

describe('SkuImage', () => {
  it('shows the product image, lazily, with its size fixed so the page does not jump', () => {
    render(<SkuImage sku="MV-B24-F" alt="Full Height Door Base Cabinet" size={96} />)
    const img = screen.getByRole('img', { name: 'Full Height Door Base Cabinet' })
    expect(img.getAttribute('src')).toMatch(/renders\/MV-B24-F-96\.webp$/)
    expect(img).toHaveAttribute('loading', 'lazy')
    expect(img).toHaveAttribute('width')
    expect(img).toHaveAttribute('height')
  })

  it('shows nothing for a SKU without an image, rather than a broken one', () => {
    const { container } = render(<SkuImage sku="MV-NOT-A-SKU" alt="Mystery" size={96} />)
    expect(container.querySelector('img')).toBeNull()
  })

  it('shows nothing for a knee space', () => {
    const { container } = render(<SkuImage sku="" alt="Open knee space" size={96} />)
    expect(container.querySelector('img')).toBeNull()
  })
})

describe('product images in the results', () => {
  it('puts a photo beside every line in the parts table', () => {
    render(<Results response={vignette as SolveResponse} wall={{ length: 72, ceiling: 96 }} onStartOver={vi.fn()} />)
    const sheet = screen.getAllByRole('article')[0]
    const rows = within(sheet).getAllByRole('row').slice(1, -2) // skip the header and footer rows
    for (const row of rows) expect(within(row).getByRole('img')).toBeInTheDocument()
  })

  it('shows a larger photo of the selected cabinet', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ sku: 'MV-B24-F', options: [] }) }) as Response))
    const user = userEvent.setup()
    render(<Results response={vignette as SolveResponse} wall={{ length: 72, ceiling: 96 }} onStartOver={vi.fn()} />)
    const sheet = screen.getAllByRole('article')[0]
    await user.click(within(sheet).getByRole('button', { name: /edit this wall/i }))
    await user.click(within(sheet).getAllByRole('button', { name: /MV-B24-F, 24 inches wide/i })[0])
    const panel = within(sheet).getByRole('region', { name: 'Selected cabinet' })
    expect(within(panel).getByRole('img').getAttribute('src')).toMatch(/MV-B24-F-320\.webp$/)
    vi.unstubAllGlobals()
  })
})
