import { Component } from 'react'
import { AlertTriangle } from 'lucide-react'
import { buttonStyles } from '../components/ui/Button.jsx'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch() {
    return undefined
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="flex min-h-screen items-center justify-center bg-ivory-50 px-5 text-ink-900">
        <div className="max-w-md animate-rise text-center">
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-full border border-lavender-200 bg-lavender-50 text-lavender-700">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-3xl">Something went wrong.</h1>
          <p className="mt-3 text-sm leading-6 text-ink-600">
            The page could not be displayed. You can try again or return to the home page.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              className={buttonStyles({ variant: 'primary' })}
              onClick={() => this.setState({ hasError: false })}
            >
              Try again
            </button>
            <a href="/" className={buttonStyles({ variant: 'secondary' })}>
              Go home
            </a>
          </div>
        </div>
      </div>
    )
  }
}
