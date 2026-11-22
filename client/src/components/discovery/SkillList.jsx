import Badge from '../ui/Badge.jsx'
import { formatLabel } from '../../utils/constants.js'

export default function SkillList({ skills = [], emptyLabel = 'No skills to show.', limit }) {
  const visible = typeof limit === 'number' ? skills.slice(0, limit) : skills

  if (visible.length === 0) {
    return <p className="text-sm text-ink-400">{emptyLabel}</p>
  }

  return (
    <ul className="flex flex-wrap gap-2">
      {visible.map((skill, index) => (
        <li key={skill.id || `${skill.name}-${index}`}>
          <Badge tone="lavender">
            <span>{skill.name}</span>
            {(skill.category || skill.proficiency) && (
              <span className="ml-1.5 text-lavender-600/80">
                {[skill.category, skill.proficiency].filter(Boolean).map(formatLabel).join(' · ')}
              </span>
            )}
          </Badge>
        </li>
      ))}
    </ul>
  )
}
