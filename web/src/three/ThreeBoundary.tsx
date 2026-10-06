// web/src/three/ThreeBoundary.tsx
import { Component, type ReactNode } from 'react'

/** If the 3D view throws — no context, a lost context, a driver bug — report it and render nothing. */
export class ThreeBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {
    this.props.onError()
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}
