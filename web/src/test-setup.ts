import '@testing-library/jest-dom/vitest'

// jsdom has no matchMedia; App asks it whether to pin the preview. Report a desktop-width viewport.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList
}

// jsdom has no PointerEvent, so fireEvent.pointerMove would drop clientX. A MouseEvent carries it.
if (!('PointerEvent' in window)) {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 1
    }
  }
  ;(window as unknown as { PointerEvent: typeof PointerEventPolyfill }).PointerEvent = PointerEventPolyfill
}

// jsdom has no canvas backend and logs "Not implemented" for getContext. Answer like a browser
// without WebGL would.
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext
