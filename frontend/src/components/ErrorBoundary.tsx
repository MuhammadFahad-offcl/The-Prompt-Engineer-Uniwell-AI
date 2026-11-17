import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
}

/** Last-resort UI so a rendering bug never leaves a blank screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log the error type only; never user data.
    console.error('[UniWell] UI error:', error.name, info.componentStack?.split('\n')[1]?.trim())
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="mx-auto max-w-xl p-6">
        <div role="alert" className="card">
          <h1 className="text-lg font-semibold">Something went wrong on this screen.</h1>
          <p className="mt-1 text-sm text-muted">Your saved data is safe. Reload the page or go back to the dashboard.</p>
          <div className="mt-4 flex gap-2">
            <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
              Reload
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                this.setState({ error: null })
                window.location.hash = '#/dashboard'
              }}
            >
              Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }
}
