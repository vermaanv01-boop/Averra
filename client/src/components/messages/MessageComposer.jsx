import { useEffect, useRef, useState } from 'react'
import { SendHorizontal } from 'lucide-react'
import Button from '../ui/Button.jsx'
import Textarea from '../ui/Textarea.jsx'
import { validateMessageContent } from '../../utils/messaging.js'

export default function MessageComposer({ disabled = false, sending = false, onSend, onTypingStart, onTypingStop }) {
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const startRef = useRef(onTypingStart)
  const stopRef = useRef(onTypingStop)
  const lastTypingRef = useRef(0)
  const stopTimerRef = useRef(null)

  useEffect(() => {
    startRef.current = onTypingStart
    stopRef.current = onTypingStop
  }, [onTypingStart, onTypingStop])

  useEffect(
    () => () => {
      clearTimeout(stopTimerRef.current)
      stopRef.current?.()
    },
    []
  )

  function notifyTyping() {
    const now = Date.now()
    if (now - lastTypingRef.current > 1500) {
      startRef.current?.()
      lastTypingRef.current = now
    }
    clearTimeout(stopTimerRef.current)
    stopTimerRef.current = setTimeout(() => {
      stopRef.current?.()
      lastTypingRef.current = 0
    }, 2000)
  }

  async function submit() {
    if (sending || disabled) return
    const validation = validateMessageContent(draft)
    if (validation.error) {
      setError(validation.error)
      return
    }
    setError('')
    const sent = await onSend(validation.content)
    if (sent) {
      setDraft('')
      clearTimeout(stopTimerRef.current)
      stopRef.current?.()
      lastTypingRef.current = 0
    }
  }

  return (
    <div className="border-t border-ink-100 bg-white px-4 py-3">
      <div className="flex items-end gap-3">
        <Textarea
          value={draft}
          rows={2}
          maxLength={4000}
          disabled={disabled || sending}
          placeholder={disabled ? 'Select a conversation to write a message' : 'Write a message…'}
          aria-label="Message"
          helperText="Enter to send · Shift + Enter for a new line"
          error={error}
          className="flex-1"
          onChange={(event) => {
            setDraft(event.target.value)
            setError('')
            if (event.target.value.trim()) notifyTyping()
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              submit()
            }
          }}
        />
        <Button
          size="md"
          loading={sending}
          disabled={disabled || !draft.trim()}
          onClick={submit}
          aria-label="Send message"
        >
          <SendHorizontal className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
