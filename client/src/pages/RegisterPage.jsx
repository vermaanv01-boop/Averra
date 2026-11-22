import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Alert from '../components/ui/Alert.jsx'
import Button from '../components/ui/Button.jsx'
import Input from '../components/ui/Input.jsx'
import { useAuth } from '../hooks/useAuth.js'

const initialValues = {
  name: '',
  username: '',
  email: '',
  password: ''
}

export default function RegisterPage() {
  const [values, setValues] = useState(initialValues)
  const { register, registerLoading, error, clearError } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    clearError()
  }, [clearError])

  function updateField(event) {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const result = await register(values)
    if (result.error) return
    navigate('/app', { replace: true })
  }

  return (
    <div>
      <div className="lg:hidden">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lavender-700">
          Get started
        </p>
      </div>
      <h1 className="mt-3 text-3xl text-ink-900 lg:mt-0">Create your account</h1>
      <p className="mt-2 text-sm leading-6 text-ink-600">
        A few details and your workspace is ready.
      </p>

      {error && (
        <Alert variant="error" title="Unable to create your account" className="mt-6">
          {error.message}
        </Alert>
      )}

      <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
        <Input
          label="Full name"
          name="name"
          type="text"
          autoComplete="name"
          placeholder="Your name"
          minLength={2}
          maxLength={80}
          required
          value={values.name}
          onChange={updateField}
        />
        <Input
          label="Username"
          name="username"
          type="text"
          autoComplete="username"
          placeholder="your_username"
          pattern="[a-z0-9_]+"
          minLength={3}
          maxLength={30}
          title="Use lowercase letters, numbers, and underscores only"
          required
          value={values.username}
          onChange={updateField}
        />
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
          autoComplete="new-password"
          placeholder="At least 8 characters"
          minLength={8}
          maxLength={128}
          required
          value={values.password}
          onChange={updateField}
        />
        <Button type="submit" fullWidth size="lg" loading={registerLoading} className="mt-2">
          Create account
        </Button>
      </form>

      <p className="mt-7 text-center text-sm text-ink-600">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-lavender-700 hover:text-lavender-600">
          Sign in
        </Link>
      </p>
    </div>
  )
}
