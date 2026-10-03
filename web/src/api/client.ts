import type {
  CartHandoff,
  DesignResponse,
  FunnelEventName,
  Goal,
  LayoutDto,
  PricedLayoutDto,
  SolveResponse,
  SwapOptionDto,
  ViolationDto,
  WallDto,
} from './types'

export interface SolveInput {
  wall: WallDto
  goal: Goal
}

export class ApiError extends Error {}

/** Calls POST /api/solve. The dev server proxies /api to the Functions host on 7071. */
export async function solve(input: SolveInput, signal?: AbortSignal): Promise<SolveResponse> {
  const response = await fetch('/api/solve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null
    throw new ApiError(body?.message ?? `The planner is not responding (${response.status}).`)
  }

  return (await response.json()) as SolveResponse
}

/** Where "add entire wall to cart" posts. Session 6 wires the line items; this is the destination. */
export const CART_URL = 'https://www.rtacabinetstore.com/cart'

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as { message?: string } | null
    throw new ApiError(problem?.message ?? `Request failed (${response.status}).`)
  }

  return (await response.json()) as T
}

export function validate(layout: LayoutDto, wall: WallDto): Promise<{ violations: ViolationDto[] }> {
  return post('/api/validate', { layout, wall })
}

export function price(layout: LayoutDto): Promise<PricedLayoutDto> {
  return post('/api/price', { layout })
}

export function swaps(sku: string): Promise<{ sku: string; options: SwapOptionDto[] }> {
  return fetch(`/api/swaps/${encodeURIComponent(sku)}`).then(async (response) => {
    if (!response.ok) throw new ApiError('We could not look up alternatives for that cabinet.')
    return response.json()
  })
}

export function saveDesign(wall: WallDto, goal: Goal, layout: LayoutDto): Promise<{ configId: string }> {
  return post('/api/design', { wall, goal, layout })
}

export async function loadDesign(configId: string): Promise<DesignResponse | null> {
  const response = await fetch(`/api/design/${encodeURIComponent(configId)}`)

  if (response.status === 404) return null
  if (!response.ok) throw new ApiError('We could not open that design.')

  return (await response.json()) as DesignResponse
}

export function buildCart(layout: LayoutDto, configId?: string): Promise<CartHandoff> {
  return post('/api/cart', { layout, configId })
}

export function captureLead(lead: {
  kind: 'EmailMe' | 'DesignerHelp'
  email: string
  configId?: string | null
  name?: string | null
  message?: string | null
}): Promise<{ received: boolean }> {
  return post('/api/lead', lead)
}

/** Funnel steps from SPEC.md. Fire and forget: telemetry must never block or break the page. */
export function track(name: FunnelEventName, configId?: string | null, properties?: Record<string, string>): void {
  try {
    const body = JSON.stringify({ name, configId: configId ?? null, properties: properties ?? null })

    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon('/api/events', new Blob([body], { type: 'application/json' }))
      return
    }

    void fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => undefined)
  } catch {
    // Never let analytics take the page down.
  }
}
