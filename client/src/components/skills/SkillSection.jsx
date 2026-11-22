import { GraduationCap, Plus, Target } from 'lucide-react'
import EmptyState from '../common/EmptyState.jsx'
import Button from '../ui/Button.jsx'
import { Card, CardDescription, CardHeader, CardTitle } from '../ui/Card.jsx'
import SkillCard from './SkillCard.jsx'
import { SKILL_TYPE_LABELS } from '../../utils/constants.js'

const sectionMeta = {
  teach: {
    title: 'Skills I Can Teach',
    description: 'What you are comfortable helping others learn.',
    icon: GraduationCap,
    buttonLabel: 'Add a skill'
  },
  learn: {
    title: 'Skills I Want to Learn',
    description: 'What you would like to pick up from someone else.',
    icon: Target,
    buttonLabel: 'Add a skill'
  }
}

export default function SkillSection({ type, skills, loading, disabled, onAdd, onEdit, onDelete }) {
  const meta = sectionMeta[type]

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-lavender-200 bg-lavender-50 text-lavender-700">
            <meta.icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <CardTitle>{meta.title}</CardTitle>
            <CardDescription>{meta.description}</CardDescription>
          </div>
        </div>
        <Button
          variant={type === 'teach' ? 'primary' : 'subtle'}
          size="sm"
          disabled={loading || disabled}
          onClick={() => onAdd(type)}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {meta.buttonLabel}
        </Button>
      </CardHeader>

      <div className="px-5 py-5">
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2" aria-label="Loading skills">
            {[0, 1].map((item) => (
              <div key={item} className="h-40 animate-pulse rounded-lg border border-ink-100 bg-ivory-100" />
            ))}
          </div>
        ) : skills.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {skills.map((skill) => (
              <li key={skill.id}>
                <SkillCard
                  skill={skill}
                  disabled={disabled}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={meta.icon}
            title={`No ${SKILL_TYPE_LABELS[type].toLowerCase()} yet`}
            description={meta.description}
            action={
              <Button variant="secondary" size="sm" disabled={disabled} onClick={() => onAdd(type)}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add your first skill
              </Button>
            }
          />
        )}
      </div>
    </Card>
  )
}
