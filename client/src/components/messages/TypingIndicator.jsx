export default function TypingIndicator({ person }) {
  if (!person) return null

  return (
    <div className="flex items-center gap-2 px-1 py-1" role="status" aria-live="polite">
      <span className="flex gap-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-lavender-500 [animation-delay:-0.2s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-lavender-400 [animation-delay:-0.1s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-lavender-300" />
      </span>
      <span className="text-xs text-ink-500">{person.name || person.username || 'Someone'} is typing</span>
    </div>
  )
}
