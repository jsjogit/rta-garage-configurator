import type { Goal, SolveResponse, WallDto } from './types'

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
