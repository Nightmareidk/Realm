"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Catches a failure inside one part of a page (a 3D scene whose model didn't download, a GPU that
 * gave out) so the rest of the page carries on. It shows `fallback` (nothing, by default) and
 * tells the parent through `onError`, which can switch to a simpler version of that part.
 */
export class SafeBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode; onError?: (error: unknown) => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("A part of the page failed and was set aside:", error, info.componentStack);
    this.props.onError?.(error);
  }

  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
  }
}
