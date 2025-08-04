'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div 
          className="min-h-[200px] flex items-center justify-center p-8 bg-error/10 border border-error/20 rounded-lg"
          role="alert"
          aria-live="assertive"
        >
          <div className="text-center max-w-md">
            <div className="text-4xl mb-4" role="img" aria-label="Error icon">⚠️</div>
            <h2 className="text-xl font-semibold text-error mb-2">
              Something went wrong
            </h2>
            <p className="text-neutral-600 mb-4">
              We&apos;re sorry, but something unexpected happened. Please try refreshing the page.
            </p>
            <button 
              className="btn btn-primary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              onClick={() => window.location.reload()}
              aria-label="Refresh the page to try again"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}