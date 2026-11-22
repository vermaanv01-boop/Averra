import { Link, useLocation } from 'react-router-dom'
import { ArrowUpRight, MapPin, Repeat2 } from 'lucide-react'
import Avatar from '../ui/Avatar.jsx'
import Badge from '../ui/Badge.jsx'
import Button from '../ui/Button.jsx'
import SkillList from './SkillList.jsx'

export default function MatchCard({ match, onRequest, disabled = false }) {
  const location = useLocation()
  const profilePath = `/app/users/${encodeURIComponent(match.user.username)}`
  const targetSkills = [
    ...(match.teachesYouWant || []).map((skill) => ({ ...skill, type: 'teach' })),
    ...(match.wantsYouTeach || []).map((skill) => ({ ...skill, type: 'learn' }))
  ]
  const linkState = {
    skills: targetSkills,
    from: `${location.pathname}${location.search}`
  }

  return (
    <article className="flex h-full flex-col rounded-card border border-ink-200/80 bg-white p-5 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-lavender-300 hover:shadow-lift">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {match.user.profileImage ? (
            <img
              src={match.user.profileImage}
              alt=""
              className="h-11 w-11 shrink-0 rounded-full border border-ink-200 bg-ivory-100 object-cover"
            />
          ) : (
            <Avatar name={match.user.name} />
          )}
          <div className="min-w-0">
            <Link
              to={profilePath}
              state={linkState}
              className="block truncate text-lg text-ink-900 transition-colors hover:text-lavender-700"
            >
              {match.user.name}
            </Link>
            <p className="truncate text-sm text-ink-500">@{match.user.username}</p>
          </div>
        </div>
        {match.complementary && (
          <Badge tone="success">
            <Repeat2 className="mr-1 h-3 w-3" aria-hidden="true" />
            Reciprocal
          </Badge>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-ink-500">
        {match.user.location && (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            {match.user.location}
          </span>
        )}
        <span>
          {match.matchCount} {match.matchCount === 1 ? 'shared skill' : 'shared skills'}
        </span>
      </div>

      <p className="mt-3 line-clamp-2 text-sm leading-6 text-ink-600">
        {match.user.bio || 'No bio added yet.'}
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">
            They can teach what you want
          </p>
          <SkillList skills={match.teachesYouWant} emptyLabel="No matching teach skills." />
        </div>
        {match.complementary && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">
              They want what you teach
            </p>
            <SkillList skills={match.wantsYouTeach} emptyLabel="No reciprocal learning skills." />
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-4">
        <Link
          to={profilePath}
          state={linkState}
          className="inline-flex items-center gap-1 text-sm font-medium text-lavender-700 transition-colors hover:text-lavender-600"
        >
          View profile
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
        <Button
          size="sm"
          disabled={disabled || !match.teachesYouWant?.length}
          onClick={() => onRequest(match, targetSkills)}
        >
          Request exchange
        </Button>
      </div>
    </article>
  )
}
