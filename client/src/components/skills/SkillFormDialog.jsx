import { useEffect, useId, useRef, useState } from 'react'
import Alert from '../ui/Alert.jsx'
import Button from '../ui/Button.jsx'
import Input from '../ui/Input.jsx'
import Modal from '../ui/Modal.jsx'
import Select from '../ui/Select.jsx'
import Textarea from '../ui/Textarea.jsx'
import {
  PROFICIENCY_LEVELS,
  SKILL_CATEGORIES,
  SKILL_LIMITS,
  SKILL_TYPE_LABELS,
  formatLabel
} from '../../utils/constants.js'
import {
  mapApiDetails,
  normalizeSkillName,
  normalizeSkillValues,
  validateSkill
} from '../../utils/validation.js'

const categoryOptions = SKILL_CATEGORIES.map((value) => ({ value, label: formatLabel(value) }))
const proficiencyOptions = PROFICIENCY_LEVELS.map((value) => ({ value, label: formatLabel(value) }))

export default function SkillFormDialog({
  open,
  type,
  skill,
  skills = [],
  onClose,
  onCreate,
  onUpdate,
  onSaved,
  saving = false
}) {
  const formId = useId()
  const submittingRef = useRef(false)
  const [values, setValues] = useState(() => normalizeSkillValues(skill || { type }))
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState(null)

  const isEditing = Boolean(skill)
  const title = isEditing ? 'Edit skill' : 'Add skill'
  const effectiveType = skill?.type || type

  useEffect(() => {
    if (!open) return
    submittingRef.current = false
    setValues(normalizeSkillValues(skill || { type }))
    setFieldErrors({})
    setFormError(null)
  }, [open, skill, type])

  function updateField(field, value) {
    setValues((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
    setFormError(null)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submittingRef.current) return

    const errors = validateSkill(values)
    const duplicate = skills.some(
      (item) =>
        item.id !== skill?.id &&
        item.type === values.type &&
        normalizeSkillName(item.name) === normalizeSkillName(values.name)
    )
    if (duplicate) {
      errors.name = 'This skill already exists for this type'
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setFormError(null)
      return
    }

    submittingRef.current = true
    const payload = normalizeSkillValues(values)
    const result = isEditing ? await onUpdate(skill.id, payload) : await onCreate(payload)
    submittingRef.current = false

    if (result.error) {
      const mapped = mapApiDetails(result.error)
      setFormError(result.error)
      setFieldErrors(mapped.fields)
      return
    }

    onSaved?.()
    onClose()
  }

  const detailMessages = mapApiDetails(formError).messages

  return (
    <Modal
      open={open}
      title={title}
      description={`This skill will appear under “${SKILL_TYPE_LABELS[effectiveType] || 'Skills'}”.`}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={saving} disabled={saving}>
            {isEditing ? 'Save changes' : 'Add skill'}
          </Button>
        </div>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-5">
        <Input
          label="Skill name"
          name="name"
          required
          maxLength={SKILL_LIMITS.name.max}
          placeholder="e.g. Visual design"
          disabled={saving}
          value={values.name}
          error={fieldErrors.name}
          onChange={(event) => updateField('name', event.target.value)}
          autoFocus
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <Select
            label="Category"
            name="category"
            required
            placeholder="Select a category"
            options={categoryOptions}
            value={values.category}
            error={fieldErrors.category}
            onChange={(event) => updateField('category', event.target.value)}
          />
          <Select
            label="Proficiency"
            name="proficiency"
            required
            placeholder="Select a level"
            options={proficiencyOptions}
            value={values.proficiency}
            error={fieldErrors.proficiency}
            onChange={(event) => updateField('proficiency', event.target.value)}
          />
        </div>

        <Textarea
          label="Experience"
          name="experience"
          maxLength={SKILL_LIMITS.experience.max}
          placeholder="Optional context about how you use this skill"
          helperText={`${values.experience.length}/${SKILL_LIMITS.experience.max} characters`}
          value={values.experience}
          error={fieldErrors.experience}
          onChange={(event) => updateField('experience', event.target.value)}
        />

        {formError && (
          <Alert variant="error" title="Skill not saved">
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
      </form>
    </Modal>
  )
}
