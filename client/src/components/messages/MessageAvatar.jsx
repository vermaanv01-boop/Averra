import Avatar from '../ui/Avatar.jsx'
import { cn } from '../../utils/cn.js'

export default function MessageAvatar({ person, size = 'md', online = false, className }) {
  if (!person) return <Avatar name="?" size={size} className={className} />

  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      {person.profileImage ? (
        <img
          src={person.profileImage}
          alt=""
          className={cn(
            'rounded-full border border-lavender-200 bg-ivory-100 object-cover',
            size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-12 w-12' : 'h-10 w-10'
          )}
        />
      ) : (
        <Avatar name={person.name || person.username || '?'} size={size} />
      )}
      {online && (
        <span
          className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500"
          title="Online"
          aria-label="Online"
        />
      )}
    </span>
  )
}
