import { Pencil, Trash2 } from 'lucide-react'
import Badge from '../ui/Badge.jsx'
import { Card } from '../ui/Card.jsx'
import { SKILL_TYPE_LABELS, formatLabel } from '../../utils/constants.js'

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString()
}

export default function SkillCard({ skill, onEdit, onDelete, disabled = false }) {
  return (
    <Card className="flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate text-base text-ink-900">{skill.name}</h4>
          <p className="mt-1 text-xs text-ink-500">{formatLabel(skill.category)}</p>
        </div>
        <Badge tone={skill.type === 'teach' ? 'lavender' : 'neutral'}>
          {SKILL_TYPE_LABELS[skill.type] || formatLabel(skill.type)}
        </Badge>
      </div>

      <div className="mt-4">
        <Badge tone="success">{formatLabel(skill.proficiency)}</Badge>
      </div>

      <p
        className={`mt-4 flex-1 whitespace-pre-wrap text-sm leading-6 ${
          skill.experience ? 'text-ink-600' : 'text-ink-400'
        }`}
      >
        {skill.experience || 'No experience notes yet.'}
      </p>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-ink-100 pt-3">
        <p className="text-xs text-ink-500">Updated {formatDate(skill.updatedAt)}</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 transition-colors hover:bg-ivory-100 hover:text-ink-900 disabled:pointer-events-none disabled:opacity-50"
            aria-label={`Edit ${skill.name}`}
            disabled={disabled}
            onClick={() => onEdit(skill)}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 transition-colors hover:bg-red-50 hover:text-red-700 disabled:pointer-events-none disabled:opacity-50"
            aria-label={`Delete ${skill.name}`}
            disabled={disabled}
            onClick={() => onDelete(skill)}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </Card>
  )
}
