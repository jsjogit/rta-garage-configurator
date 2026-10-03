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

export interface SolveResponse {
  options: LayoutOptionDto[]
  failure: { code: string; message: string } | null
  notices: { code: string; message: string }[]
}
