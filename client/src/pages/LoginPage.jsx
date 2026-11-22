import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Alert from '../components/ui/Alert.jsx'
import Button from '../components/ui/Button.jsx'
import Input from '../components/ui/Input.jsx'
import { useAuth } from '../hooks/useAuth.js'

export default function LoginPage() {
  const [values, setValues] = useState({ email: '', password: '' })
  const { login, loginLoading, error, clearError } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    clearError()
  }, [clearError])

  function updateField(event) {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const result = await login(values)
    if (result.error) return

    const fallback = location.state?.from?.pathname || '/app'
    navigate(fallback, { replace: true })
  }

  return (
    <div>
      <div className="lg:hidden">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lavender-700">
          Welcome back
        </p>
      </div>
      <h1 className="mt-3 text-3xl text-ink-900 lg:mt-0">Sign in to Averra</h1>
      <p className="mt-2 text-sm leading-6 text-ink-600">
        Continue to your skill exchange workspace.
      </p>

      {error && (
        <Alert variant="error" title="Unable to sign in" className="mt-6">
          {error.message}
        </Alert>
      )}

      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        <Input
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          value={values.email}
          onChange={updateField}
        />
        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Your password"
          required
          value={values.password}
          onChange={updateField}
        />
        <Button type="submit" fullWidth size="lg" loading={loginLoading}>
          Sign in
        </Button>
      </form>

      <p className="mt-7 text-center text-sm text-ink-600">
        New to Averra?{' '}
        <Link to="/register" className="font-medium text-lavender-700 hover:text-lavender-600">
          Create an account
        </Link>
      </p>
    </div>
  )
}
