import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import Input from '../ui/Input.jsx'
import { PROFILE_LIMITS } from '../../utils/constants.js'
import { cn } from '../../utils/cn.js'

export default function InterestsEditor({ values = [], onChange, error, disabled = false }) {
  const [draft, setDraft] = useState('')
  const [localError, setLocalError] = useState('')

  function addInterest() {
    const value = draft.trim()
    if (!value) return

    if (value.length > PROFILE_LIMITS.interests.itemMax) {
      setLocalError(`Each interest must be ${PROFILE_LIMITS.interests.itemMax} characters or fewer`)
      return
    }
    if (values.length >= PROFILE_LIMITS.interests.max) {
      setLocalError(`You can add up to ${PROFILE_LIMITS.interests.max} interests`)
      return
    }
    if (values.some((interest) => interest.toLowerCase() === value.toLowerCase())) {
      setLocalError('This interest is already added')
      return
    }

    onChange([...values, value])
    setDraft('')
    setLocalError('')
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addInterest()
    }
  }

  return (
    <div className="space-y-2">
      <Input
        label="Interests"
        value={draft}
        disabled={disabled || values.length >= PROFILE_LIMITS.interests.max}
        placeholder="Type an interest and press Enter"
        helperText={`${values.length}/${PROFILE_LIMITS.interests.max} added · press Enter or comma to add`}
        error={localError || error}
        onChange={(event) => {
          setDraft(event.target.value)
          setLocalError('')
        }}
        onKeyDown={handleKeyDown}
      />

      <div className="flex justify-end">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-medium text-ink-700 transition-colors hover:border-lavender-300 hover:bg-lavender-50 disabled:pointer-events-none disabled:opacity-50"
          disabled={disabled || !draft.trim() || values.length >= PROFILE_LIMITS.interests.max}
          onClick={addInterest}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Add interest
        </button>
      </div>

      {values.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Current interests">
          {values.map((interest, index) => (
            <li
              key={`${interest}-${index}`}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border border-lavender-200 bg-lavender-50 py-1 pl-2.5 pr-1.5 text-xs text-lavender-700'
              )}
            >
              {interest}
              <button
                type="button"
                className="grid h-5 w-5 place-items-center rounded-full text-lavender-700 transition-colors hover:bg-lavender-100 disabled:opacity-50"
                aria-label={`Remove ${interest}`}
                disabled={disabled}
                onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
