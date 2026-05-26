"use client";

import React from "react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 bg-background text-foreground">
          <p className="text-4xl">⚠️</p>
          <p className="text-lg font-semibold">Something went wrong</p>
          <p className="max-w-sm text-center text-sm text-muted-foreground">
            {this.state.error.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={() => { this.setState({ error: null }); window.location.reload(); }}
            className="mt-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 transition-opacity"
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
