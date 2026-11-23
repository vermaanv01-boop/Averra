import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, MapPin, Star } from 'lucide-react'
import PageHeader from '../components/common/PageHeader.jsx'
import ExchangeRequestDialog from '../components/discovery/ExchangeRequestDialog.jsx'
import SkillList from '../components/discovery/SkillList.jsx'
import Alert from '../components/ui/Alert.jsx'
import Avatar from '../components/ui/Avatar.jsx'
import Badge from '../components/ui/Badge.jsx'
import Button from '../components/ui/Button.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import Spinner from '../components/ui/Spinner.jsx'
import useAuth from '../hooks/useAuth.js'
import useSkills from '../hooks/useSkills.js'
import { discoveryService, userService } from '../services/index.js'
import { SKILL_TYPES, SKILL_TYPE_LABELS } from '../utils/constants.js'

function toSkillMap(skills) {
  return {
    teach: skills.filter((skill) => skill.type === 'teach'),
    learn: skills.filter((skill) => skill.type === 'learn')
  }
}

function formatJoined(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(new Date(value))
}

export default function PublicProfilePage() {
  const { username } = useParams()
  const location = useLocation()
  const { user } = useAuth()
  const { skills: ownSkills, loading: ownSkillsLoading, error: ownSkillsError } = useSkills()
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileError, setProfileError] = useState(null)
  const [skillsLoading, setSkillsLoading] = useState(true)
  const [skillsError, setSkillsError] = useState(null)
  const [notice, setNotice] = useState('')
  const [exchangeOpen, setExchangeOpen] = useState(false)

  const reviewNotice = new URLSearchParams(location.search).get('review') === '1'

  const passedSkills = useMemo(
    () => (Array.isArray(location.state?.skills) ? location.state.skills : []),
    [location.state]
  )
  const passedSkillTypes = useMemo(
    () => (Array.isArray(location.state?.skillTypes) ? location.state.skillTypes : []),
    [location.state]
  )
  const initialSkills = useMemo(() => toSkillMap(passedSkills), [passedSkills])
  const missingTypes = useMemo(
    () => SKILL_TYPES.filter((type) => !passedSkillTypes.includes(type)),
    [passedSkillTypes]
  )
  const missingTypesKey = missingTypes.join(',')
  const [profileSkills, setProfileSkills] = useState(initialSkills)

  const backTo = location.state?.from || '/app/discovery'
  const ownTeachSkills = useMemo(
    () => ownSkills.filter((skill) => skill.type === 'teach'),
    [ownSkills]
  )
  const isSelf = Boolean(user && user.username?.toLowerCase() === username?.toLowerCase())

  useEffect(() => {
    let active = true
    setProfileLoading(true)
    setProfileError(null)
    setNotice('')
    setExchangeOpen(false)

    userService
      .getByUsername(username)
      .then((data) => {
        if (!active) return
        setProfile(data?.user || null)
      })
      .catch((error) => {
        if (!active) return
        setProfileError(error)
      })
      .finally(() => {
        if (active) setProfileLoading(false)
      })

    return () => {
      active = false
    }
  }, [username])

  useEffect(() => {
    let active = true
    setProfileSkills(initialSkills)
    setSkillsError(null)

    if (missingTypes.length === 0) {
      setSkillsLoading(false)
      return undefined
    }

    setSkillsLoading(true)
    discoveryService
      .findUserSkills(username, missingTypes)
      .then((data) => {
        if (!active) return
        setProfileSkills((current) => ({
          teach: [...current.teach, ...(data.teach || [])],
          learn: [...current.learn, ...(data.learn || [])]
        }))
      })
      .catch((error) => {
        if (active) setSkillsError(error)
      })
      .finally(() => {
        if (active) setSkillsLoading(false)
      })

    return () => {
      active = false
    }
  }, [username, missingTypesKey, initialSkills])

  if (profileLoading) {
    return (
      <div className="animate-rise space-y-6">
        <Link to={backTo} className="inline-flex items-center gap-1.5 text-sm text-ink-600 hover:text-ink-900">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to discovery
        </Link>
        <div className="grid h-80 place-items-center rounded-card border border-ink-200 bg-white shadow-soft">
          <Spinner label="Loading public profile" />
        </div>
      </div>
    )
  }

  if (profileError || !profile) {
    return (
      <div className="animate-rise space-y-6">
        <Link to={backTo} className="inline-flex items-center gap-1.5 text-sm text-ink-600 hover:text-ink-900">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to discovery
        </Link>
        <EmptyState
          title="Profile unavailable"
          description={profileError?.message || 'This member could not be found.'}
          action={
            <Link
              to="/app/discovery"
              className="inline-flex h-9 items-center rounded-lg border border-ink-900 bg-ink-900 px-4 text-sm font-medium text-white transition-colors hover:bg-ink-800"
            >
              Browse members
            </Link>
          }
        />
      </div>
    )
  }

  const reputation = profile.reputation || {}
  const memberSince = formatJoined(profile.createdAt)
  const canRequest = !isSelf && profileSkills.teach.length > 0 && ownTeachSkills.length > 0

  return (
    <div className="animate-rise space-y-8">
      <Link to={backTo} className="inline-flex items-center gap-1.5 text-sm text-ink-600 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to discovery
      </Link>

      {notice && <Alert variant="success">{notice}</Alert>}
      {ownSkillsError && (
        <Alert variant="warning" title="Could not load your skills">
          Refresh the page before sending an exchange request.
        </Alert>
      )}
      {skillsError && (
        <Alert variant="warning" title="Some skills could not be loaded">
          {skillsError.message}
        </Alert>
      )}

      <PageHeader
        eyebrow="Public profile"
        title={profile.name}
        description={`@${profile.username}`}
        actions={
          isSelf ? (
            <Link
              to="/app/profile"
              className="inline-flex h-9 items-center rounded-lg border border-lavender-200 bg-lavender-50 px-3 text-xs font-medium text-lavender-700 transition-colors hover:bg-lavender-100"
            >
              Edit your profile
            </Link>
          ) : (
            <div className="flex flex-col items-end gap-1">
              <Button
                disabled={!canRequest || skillsLoading || ownSkillsLoading}
                onClick={() => setExchangeOpen(true)}
              >
                Request exchange
              </Button>
              {ownTeachSkills.length === 0 && !ownSkillsLoading && (
                <Link to="/app/skills" className="text-xs text-ink-500 hover:text-ink-900">
                  Add a teaching skill first
                </Link>
              )}
            </div>
          )
        }
      />

      <section className="overflow-hidden rounded-card border border-ink-200/80 bg-white shadow-soft">
        <div className="h-24 bg-gradient-to-r from-lavender-100 via-ivory-100 to-lavender-50" />
        <div className="px-6 pb-6">
          <div className="-mt-8 flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              {profile.profileImage ? (
                <img
                  src={profile.profileImage}
                  alt=""
                  className="h-16 w-16 rounded-full border-4 border-white bg-ivory-100 object-cover shadow-soft"
                />
              ) : (
                <Avatar name={profile.name} size="lg" className="h-16 w-16 border-4 border-white text-lg shadow-soft" />
              )}
              <div className="pb-1">
                <h2 className="text-xl text-ink-900">{profile.name}</h2>
                <p className="text-sm text-ink-500">@{profile.username}</p>
              </div>
            </div>
            {memberSince && (
              <p className="flex items-center gap-1.5 pb-1 text-xs text-ink-500">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                Joined {memberSince}
              </p>
            )}
          </div>

          <p className="mt-6 max-w-3xl text-sm leading-7 text-ink-600">
            {profile.bio || 'This member has not added a bio yet.'}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-ink-600">
            {profile.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-ink-400" aria-hidden="true" />
                {profile.location}
              </span>
            )}
            {reputation.totalReviews > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Star className="h-4 w-4 text-amber-500" aria-hidden="true" />
                {Number(reputation.averageOverallRating).toFixed(1)} · {reputation.totalReviews} reviews
              </span>
            )}
            <span>{reputation.completedExchanges || 0} completed exchanges</span>
          </div>

          {profile.interests?.length > 0 && (
            <div className="mt-6 border-t border-ink-100 pt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">
                Interests
              </p>
              <div className="flex flex-wrap gap-2">
                {profile.interests.map((interest, index) => (
                  <Badge key={`${interest}-${index}`}>{interest}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        {SKILL_TYPES.map((type) => (
          <section
            key={type}
            className="rounded-card border border-ink-200/80 bg-white p-5 shadow-soft"
          >
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-ink-100 pb-4">
              <div>
                <h3 className="text-lg text-ink-900">{SKILL_TYPE_LABELS[type]}</h3>
                <p className="mt-1 text-xs text-ink-500">From public discovery data</p>
              </div>
              {skillsLoading ? (
                <Spinner label={`Loading ${type} skills`} />
              ) : (
                <Badge tone={type === 'teach' ? 'success' : 'lavender'}>
                  {profileSkills[type].length}
                </Badge>
              )}
            </div>
            <SkillList
              skills={profileSkills[type]}
              emptyLabel={`No ${type === 'teach' ? 'teaching' : 'learning'} skills listed yet.`}
            />
          </section>
        ))}
      </div>

      <ExchangeRequestDialog
        open={exchangeOpen}
        recipient={{ id: profile.id, name: profile.name }}
        ownTeachSkills={ownTeachSkills}
        targetTeachSkills={profileSkills.teach}
        onClose={() => setExchangeOpen(false)}
        onCreated={() => setNotice(`Exchange request sent to ${profile.name}.`)}
      />
    </div>
  )
}
