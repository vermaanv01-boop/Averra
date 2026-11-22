import { useEffect, useRef, useState } from 'react'
import Alert from '../ui/Alert.jsx'
import Button from '../ui/Button.jsx'
import Input from '../ui/Input.jsx'
import Textarea from '../ui/Textarea.jsx'
import InterestsEditor from './InterestsEditor.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import {
  getChangedProfileValues,
  mapApiDetails,
  normalizeProfileValues,
  validateProfile
} from '../../utils/validation.js'
import { PROFILE_LIMITS } from '../../utils/constants.js'

export default function ProfileForm({ user }) {
  const [values, setValues] = useState(() => normalizeProfileValues(user))
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [success, setSuccess] = useState('')
  const submittingRef = useRef(false)
  const { updateProfile, updateProfileLoading } = useAuth()

  useEffect(() => {
    setValues(normalizeProfileValues(user))
    setFieldErrors({})
    setFormError(null)
  }, [user])

  const changes = getChangedProfileValues(user, values)
  const isDirty = Object.keys(changes).length > 0

  function updateField(field, value) {
    setValues((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
    setFormError(null)
    setSuccess('')
  }

  function handleReset() {
    setValues(normalizeProfileValues(user))
    setFieldErrors({})
    setFormError(null)
    setSuccess('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submittingRef.current) return

    const validationErrors = validateProfile(values)
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors)
      setFormError(null)
      setSuccess('')
      return
    }

    const payload = getChangedProfileValues(user, values)
    if (Object.keys(payload).length === 0) {
      setFormError({ message: 'Change at least one field before saving.' })
      setSuccess('')
      return
    }

    submittingRef.current = true
    const result = await updateProfile(payload)
    submittingRef.current = false

    if (result.error) {
      const mapped = mapApiDetails(result.error)
      setFormError(result.error)
      setFieldErrors(mapped.fields)
      setSuccess('')
      return
    }

    setFieldErrors({})
    setFormError(null)
    setSuccess('Your profile has been updated.')
    setValues(normalizeProfileValues(result.data.user))
  }

  const detailMessages = mapApiDetails(formError).messages

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          label="Full name"
          name="name"
          autoComplete="name"
          required
          maxLength={PROFILE_LIMITS.name.max}
          value={values.name}
          error={fieldErrors.name}
          onChange={(event) => updateField('name', event.target.value)}
        />
        <Input
          label="Username"
          name="username"
          autoComplete="username"
          required
          minLength={PROFILE_LIMITS.username.min}
          maxLength={PROFILE_LIMITS.username.max}
          helperText="Lowercase letters, numbers, and underscores"
          value={values.username}
          error={fieldErrors.username}
          onChange={(event) => updateField('username', event.target.value.toLowerCase())}
        />
        <Input
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={values.email}
          error={fieldErrors.email}
          onChange={(event) => updateField('email', event.target.value)}
        />
        <Input
          label="Profile image URL"
          name="profileImage"
          type="url"
          placeholder="https://example.com/portrait.jpg"
          helperText="Leave blank to remove your image"
          value={values.profileImage}
          error={fieldErrors.profileImage}
          onChange={(event) => updateField('profileImage', event.target.value)}
        />
        <Input
          label="Location"
          name="location"
          autoComplete="address-level2"
          maxLength={PROFILE_LIMITS.location.max}
          placeholder="City or region"
          value={values.location}
          error={fieldErrors.location}
          onChange={(event) => updateField('location', event.target.value)}
        />
        <Textarea
          label="Bio"
          name="bio"
          className="sm:col-span-2"
          maxLength={PROFILE_LIMITS.bio.max}
          placeholder="Tell others a little about yourself"
          helperText={`${values.bio.length}/${PROFILE_LIMITS.bio.max} characters`}
          value={values.bio}
          error={fieldErrors.bio}
          onChange={(event) => updateField('bio', event.target.value)}
        />
        <div className="sm:col-span-2">
          <InterestsEditor
            values={values.interests}
            error={fieldErrors.interests}
            disabled={updateProfileLoading}
            onChange={(nextInterests) => updateField('interests', nextInterests)}
          />
        </div>
      </div>

      {(formError || success) && (
        <div className="mt-5 space-y-2">
          {formError && (
            <Alert variant="error" title="Profile not updated">
              <p>{formError.message}</p>
              {detailMessages.length > 0 && (
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  {detailMessages.map((message, index) => (
                    <li key={`${message}-${index}`}>{message}</li>
                  ))}
                </ul>
              )}
            </Alert>
          )}
          {success && <Alert variant="success">{success}</Alert>}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-ink-100 pt-5">
        <Button variant="ghost" disabled={!isDirty || updateProfileLoading} onClick={handleReset}>
          Reset
        </Button>
        <Button type="submit" loading={updateProfileLoading} disabled={!isDirty}>
          Save changes
        </Button>
      </div>
    </form>
  )
}
