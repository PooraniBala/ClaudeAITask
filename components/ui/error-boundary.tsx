'use client'

import React from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { ErrorBoundaryProps } from '@/lib/types'

type ErrorBoundaryState = {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <Card className="border-red-200 bg-red-50">
          <p className="mb-3 text-sm font-medium text-red-700">
            Something went wrong
          </p>
          {this.state.error && (
            <p className="mb-4 text-xs text-red-600">
              {this.state.error.message}
            </p>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try again
          </Button>
        </Card>
      )
    }

    return this.props.children
  }
}
