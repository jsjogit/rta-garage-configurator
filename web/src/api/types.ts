// Mirrors src/GarageConfigurator.Api/openapi.yaml. Hand-written and narrow: the web only needs what
// it renders, and a drift should fail loudly in the fixture tests rather than silently.

export type Zone = 'Base' | 'Counter' | 'Wall' | 'Tall' | 'Filler' | 'KneeSpace'
export type Goal = 'Workbench' | 'Storage' | 'HideTheMess' | 'Balanced'
export type Tier = 'Standard' | 'Premiere'

export interface ObstructionDto {
  type: string
  startX: number
  width: number
  height: number
  bottomY: number
}

export interface WallDto {
  length: number
  ceiling: number
  obstructions?: ObstructionDto[] | null
}

export interface PlacedItemDto {
  sku: string
  x: number
  y: number
  width: number
  height: number
  depth: number
  zone: Zone
}

export interface LayoutDto {
  items: PlacedItemDto[]
  label?: string | null
  configId?: string | null
  tier?: Tier | null
}

export interface LineItemDto {
  sku: string
  name: string
  quantity: number
  unitList: number
  unitPromo: number
  extendedList: number
  extendedPromo: number
}

export interface PricedLayoutDto {
  layout: LayoutDto
  lineItems: LineItemDto[]
  subtotalList: number
  subtotalPromo: number
}

export interface LayoutOptionDto {
  label: string
  standard: PricedLayoutDto
  premiere: PricedLayoutDto
}

export interface ViolationDto {
  code: string
  message: string
  sku: string | null
}

export interface SwapOptionDto {
  sku: string
  name: string
  zone: Zone
  width: number
  height: number
  depth: number
}

export interface CartHandoff {
  configId: string | null
  lines: { sku: string; quantity: number; productId: number }[]
  ready: boolean
  unmappedSkus: string[]
  requests: { url: string; method: string }[]
  cartUrl: string
  storeOrigin: string
}

export interface DesignResponse {
  configId: string
  wall: WallDto
  goal: Goal
  design: PricedLayoutDto
  savedAtUtc: string
}

export type FunnelEventName =
  | 'wizard_started'
  | 'wall_defined'
  | 'layouts_returned'
  | 'layout_viewed'
  | 'layout_edited'
  | 'cart_add_all'
  | 'cart_add_item'
  | 'share_created'
  | 'lead_captured'
  | 'view_3d_opened'

export interface SolveResponse {
  options: LayoutOptionDto[]
  failure: { code: string; message: string } | null
  notices: { code: string; message: string }[]
}
