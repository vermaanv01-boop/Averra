import { Link, useLocation } from 'react-router-dom'
import { ArrowUpRight, MapPin } from 'lucide-react'
import Avatar from '../ui/Avatar.jsx'
import SkillList from './SkillList.jsx'
import { formatLabel, SKILL_TYPE_LABELS } from '../../utils/constants.js'

export default function UserCard({ user }) {
  const location = useLocation()
  const profilePath = `/app/users/${encodeURIComponent(user.username)}`
  const linkState = {
    skills: user.skills || [],
    from: `${location.pathname}${location.search}`
  }

  return (
    <article className="flex h-full flex-col rounded-card border border-ink-200/80 bg-white p-5 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-lavender-300 hover:shadow-lift">
      <div className="flex items-start gap-3">
        {user.profileImage ? (
          <img
            src={user.profileImage}
            alt=""
            className="h-11 w-11 shrink-0 rounded-full border border-ink-200 bg-ivory-100 object-cover"
          />
        ) : (
          <Avatar name={user.name} />
        )}
        <div className="min-w-0">
          <Link
            to={profilePath}
            state={linkState}
            className="block truncate text-lg text-ink-900 transition-colors hover:text-lavender-700"
          >
            {user.name}
          </Link>
          <p className="truncate text-sm text-ink-500">@{user.username}</p>
        </div>
      </div>

      {user.location && (
        <p className="mt-4 flex items-center gap-1.5 text-xs text-ink-500">
          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
          {user.location}
        </p>
      )}

      <p className="mt-3 line-clamp-3 flex-1 text-sm leading-6 text-ink-600">
        {user.bio || 'No bio added yet.'}
      </p>

      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">
          {SKILL_TYPE_LABELS[user.skills?.[0]?.type] || 'Matching skills'}
        </p>
        <SkillList
          skills={user.skills}
          limit={4}
          emptyLabel="No matching skills in this view."
        />
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-ink-100 pt-4">
        <p className="text-xs text-ink-500">
          {user.skillCount ?? user.skills?.length ?? 0} matching{' '}
          {(user.skillCount ?? user.skills?.length ?? 0) === 1 ? 'skill' : 'skills'}
        </p>
        <Link
          to={profilePath}
          state={linkState}
          className="inline-flex items-center gap-1 text-sm font-medium text-lavender-700 transition-colors hover:text-lavender-600"
        >
          View profile
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
      {user.interests?.length > 0 && (
        <p className="sr-only">Interests: {user.interests.map(formatLabel).join(', ')}</p>
      )}
    </article>
  )
}
