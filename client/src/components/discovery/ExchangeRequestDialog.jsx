import { useEffect, useId, useRef, useState } from 'react'
import Alert from '../ui/Alert.jsx'
import Button from '../ui/Button.jsx'
import Modal from '../ui/Modal.jsx'
import Select from '../ui/Select.jsx'
import { exchangeRequestService } from '../../services/index.js'
import { formatLabel } from '../../utils/constants.js'
import { mapApiDetails } from '../../utils/validation.js'

function skillOptions(skills) {
  return skills.map((skill) => ({
    value: skill.id,
    label: `${skill.name} · ${formatLabel(skill.proficiency)}`
  }))
}

export default function ExchangeRequestDialog({
  open,
  recipient,
  ownTeachSkills = [],
  targetTeachSkills = [],
  initialRequestedSkillId = '',
  onClose,
  onCreated
}) {
  const formId = useId()
  const submittingRef = useRef(false)
  const [offeredSkillId, setOfferedSkillId] = useState('')
  const [requestedSkillId, setRequestedSkillId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    submittingRef.current = false
    setOfferedSkillId('')
    setRequestedSkillId(initialRequestedSkillId || '')
    setSubmitting(false)
    setError(null)
  }, [open, initialRequestedSkillId, recipient?.id])

  const canSubmit = Boolean(
    recipient?.id && offeredSkillId && requestedSkillId && ownTeachSkills.length && targetTeachSkills.length
  )

  async function handleSubmit(event) {
    event.preventDefault()
    if (submittingRef.current || !canSubmit) return

    submittingRef.current = true
    setSubmitting(true)
    setError(null)

    const result = await exchangeRequestService.create({
      recipientId: recipient.id,
      offeredSkillId,
      requestedSkillId
    })

    submittingRef.current = false
    setSubmitting(false)

    if (result?.success === false) {
      setError(result)
      return
    }

    onCreated?.(result)
    onClose()
  }

  const detailMessages = mapApiDetails(error).messages

  return (
    <Modal
      open={open}
      title="Request an exchange"
      description={
        recipient ? `Choose a skill to offer ${recipient.name} and one you would like to learn.` : ''
      }
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" disabled={submitting} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={submitting} disabled={!canSubmit || submitting}>
            Send request
          </Button>
        </div>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-5">
        {ownTeachSkills.length === 0 || targetTeachSkills.length === 0 ? (
          <Alert variant="info" title="A skill is missing">
            <p>
              {ownTeachSkills.length === 0
                ? 'Add a skill you can teach before sending a request.'
                : 'This member has no teaching skills available for a request.'}
            </p>
          </Alert>
        ) : (
          <>
            <Select
              label="Skill you offer"
              placeholder="Select one of your skills"
              options={skillOptions(ownTeachSkills)}
              value={offeredSkillId}
              disabled={submitting}
              required
              onChange={(event) => setOfferedSkillId(event.target.value)}
            />
            <Select
              label="Skill you want to learn"
              placeholder="Select one of their skills"
              options={skillOptions(targetTeachSkills)}
              value={requestedSkillId}
              disabled={submitting}
              required
              onChange={(event) => setRequestedSkillId(event.target.value)}
            />
          </>
        )}

        {error && (
          <Alert variant="error" title="Request not sent">
            <p>{error.message || 'The request could not be sent.'}</p>
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
