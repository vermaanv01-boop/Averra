import { useCallback, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { RefreshCw, Sparkles, Users } from 'lucide-react'
import PageHeader from '../components/common/PageHeader.jsx'
import DiscoveryFilters from '../components/discovery/DiscoveryFilters.jsx'
import ExchangeRequestDialog from '../components/discovery/ExchangeRequestDialog.jsx'
import MatchCard from '../components/discovery/MatchCard.jsx'
import Pagination from '../components/discovery/Pagination.jsx'
import ResultsSkeleton from '../components/discovery/ResultsSkeleton.jsx'
import UserCard from '../components/discovery/UserCard.jsx'
import Alert from '../components/ui/Alert.jsx'
import Button from '../components/ui/Button.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import Select from '../components/ui/Select.jsx'
import useDebouncedValue from '../hooks/useDebouncedValue.js'
import useDiscoveryRequest from '../hooks/useDiscoveryRequest.js'
import useSkills from '../hooks/useSkills.js'
import { discoveryService } from '../services/index.js'
import { SKILL_CATEGORIES, formatLabel } from '../utils/constants.js'
import { cn } from '../utils/cn.js'

const categoryOptions = SKILL_CATEGORIES.map((value) => ({ value, label: formatLabel(value) }))

function readValue(searchParams, key, fallback = '') {
  return searchParams.get(key) || fallback
}

export default function DiscoveryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [notice, setNotice] = useState('')
  const [requestDialog, setRequestDialog] = useState(null)
  const { skills, error: skillsError } = useSkills()

  const tab = searchParams.get('tab') === 'matches' ? 'matches' : 'discover'
  const values = {
    q: readValue(searchParams, 'q'),
    skill: readValue(searchParams, 'skill'),
    category: readValue(searchParams, 'category'),
    proficiency: readValue(searchParams, 'proficiency'),
    type: readValue(searchParams, 'type', 'teach'),
    sort: readValue(searchParams, 'sort', 'recent'),
    page: Math.max(1, Number(searchParams.get('page')) || 1)
  }

  const debouncedName = useDebouncedValue(values.q, 250)
  const debouncedSkill = useDebouncedValue(values.skill, 250)

  const setParams = useCallback(
    (patch, resetPage = true) => {
      const next = new URLSearchParams(searchParams)
      Object.entries(patch).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') next.delete(key)
        else next.set(key, String(value))
      })
      if (resetPage) next.delete('page')
      setSearchParams(next, { replace: true })
    },
    [searchParams, setSearchParams]
  )

  const userParams = useMemo(
    () => ({
      skill: debouncedSkill.trim() || undefined,
      category: values.category || undefined,
      proficiency: values.proficiency || undefined,
      type: values.type,
      sort: values.sort,
      page: values.page,
      limit: 12
    }),
    [debouncedSkill, values.category, values.proficiency, values.type, values.sort, values.page]
  )

  const matchParams = useMemo(
    () => ({
      category: values.category || undefined,
      page: values.page,
      limit: 12
    }),
    [values.category, values.page]
  )

  const usersQuery = useDiscoveryRequest(
    discoveryService.searchUsers,
    userParams,
    tab === 'discover'
  )
  const matchesQuery = useDiscoveryRequest(
    discoveryService.getMatches,
    matchParams,
    tab === 'matches'
  )
  const activeQuery = tab === 'matches' ? matchesQuery : usersQuery

  const visibleUsers = useMemo(() => {
    const term = debouncedName.trim().toLowerCase()
    if (!term) return usersQuery.items
    return usersQuery.items.filter(
      (user) =>
        user.name?.toLowerCase().includes(term) || user.username?.toLowerCase().includes(term)
    )
  }, [usersQuery.items, debouncedName])

  const ownTeachSkills = useMemo(() => skills.filter((skill) => skill.type === 'teach'), [skills])

  function handleFilterChange(field, value) {
    setNotice('')
    setParams({ [field]: value || null }, field !== 'q')
  }

  function handlePageChange(page) {
    setParams({ page }, false)
  }

  function resetFilters() {
    setNotice('')
    setParams(
      {
        q: null,
        skill: null,
        category: null,
        proficiency: null,
        type: null,
        sort: null
      },
      true
    )
  }

  function changeTab(nextTab) {
    setNotice('')
    setParams({ tab: nextTab === 'matches' ? 'matches' : null }, true)
  }

  function handleRequest(match, targetSkills = []) {
    setNotice('')
    setRequestDialog({
      recipient: match.user,
      targetTeachSkills: targetSkills.filter((skill) => skill.type === 'teach'),
      initialRequestedSkillId: match.teachesYouWant?.[0]?.id || ''
    })
  }

  function handleRequestCreated() {
    setNotice(`Exchange request sent to ${requestDialog?.recipient?.name || 'this member'}.`)
  }

  const tabs = [
    { id: 'discover', label: 'Discover people', icon: Users },
    { id: 'matches', label: 'Your matches', icon: Sparkles }
  ]

  return (
    <div className="animate-rise space-y-8">
      <PageHeader
        eyebrow="Discovery"
        title="Find people worth learning with"
        description="Browse real members by skill, or see who complements the skills you already share."
        actions={
          <>
            <Button variant="secondary" size="sm" loading={activeQuery.loading} onClick={activeQuery.reload}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </Button>
            <Link
              to="/app/skills"
              className="inline-flex h-9 items-center rounded-lg border border-lavender-200 bg-lavender-50 px-3 text-xs font-medium text-lavender-700 transition-colors hover:bg-lavender-100"
            >
              Manage skills
            </Link>
          </>
        }
      />

      <div
        role="tablist"
        aria-label="Discovery views"
        className="inline-flex rounded-xl border border-ink-200 bg-white p-1 shadow-soft"
      >
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            onClick={() => changeTab(id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors',
              tab === id
                ? 'bg-ink-900 text-white'
                : 'text-ink-600 hover:bg-ivory-100 hover:text-ink-900'
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {notice && <Alert variant="success">{notice}</Alert>}

      <div
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        className="space-y-6"
      >
        {tab === 'discover' ? (
          <>
            <DiscoveryFilters
              values={values}
              onChange={handleFilterChange}
              onReset={resetFilters}
              loading={usersQuery.loading}
            />

            {usersQuery.error && (
              <Alert
                variant="error"
                title="Could not load members"
                action={
                  <Button variant="secondary" size="sm" onClick={usersQuery.reload}>
                    Retry
                  </Button>
                }
              >
                {usersQuery.error.message}
              </Alert>
            )}

            {usersQuery.loading ? (
              <ResultsSkeleton />
            ) : visibleUsers.length === 0 ? (
              <EmptyState
                title={debouncedName.trim() ? 'No matching people on this page' : 'No members found'}
                description={
                  debouncedName.trim()
                    ? 'Name and username search only filters the current page. Try another page or clear the name.'
                    : 'Try a different skill, category, or proficiency.'
                }
                action={
                  <Button variant="secondary" size="sm" onClick={resetFilters}>
                    Reset filters
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {visibleUsers.map((user) => (
                  <UserCard key={user.id} user={user} />
                ))}
              </div>
            )}

            <Pagination
              pagination={usersQuery.pagination}
              onPageChange={handlePageChange}
              disabled={usersQuery.loading}
            />
          </>
        ) : (
          <>
            <section
              aria-label="Match filters"
              className="flex flex-wrap items-end justify-between gap-4 rounded-card border border-ink-200/80 bg-white p-5 shadow-soft"
            >
              <div>
                <h2 className="text-lg text-ink-900">Complementary learners</h2>
                <p className="mt-1 text-sm leading-6 text-ink-600">
                  Matches are based only on the skills you teach and want to learn.
                </p>
              </div>
              <Select
                label="Category"
                placeholder="Any category"
                options={categoryOptions}
                value={values.category}
                disabled={matchesQuery.loading}
                className="w-full sm:w-56"
                onChange={(event) => handleFilterChange('category', event.target.value)}
              />
            </section>

            {skillsError && (
              <Alert variant="warning" title="Your skills could not be loaded">
                Open an exchange from a public profile after refreshing your skills.
              </Alert>
            )}

            {matchesQuery.error && (
              <Alert
                variant="error"
                title="Could not load matches"
                action={
                  <Button variant="secondary" size="sm" onClick={matchesQuery.reload}>
                    Retry
                  </Button>
                }
              >
                {matchesQuery.error.message}
              </Alert>
            )}

            {matchesQuery.loading ? (
              <ResultsSkeleton />
            ) : matchesQuery.items.length === 0 ? (
              <EmptyState
                title="No matches yet"
                description="Add a skill you want to learn and a skill you can teach to see complementary members."
                action={
                  <Link
                    to="/app/skills"
                    className="inline-flex h-9 items-center rounded-lg border border-ink-900 bg-ink-900 px-4 text-sm font-medium text-white transition-colors hover:bg-ink-800"
                  >
                    Add your skills
                  </Link>
                }
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {matchesQuery.items.map((match) => (
                  <MatchCard
                    key={match.user.id}
                    match={match}
                    disabled={ownTeachSkills.length === 0}
                    onRequest={handleRequest}
                  />
                ))}
              </div>
            )}

            <Pagination
              pagination={matchesQuery.pagination}
              onPageChange={handlePageChange}
              disabled={matchesQuery.loading}
            />
          </>
        )}
      </div>

      <ExchangeRequestDialog
        open={Boolean(requestDialog)}
        recipient={requestDialog?.recipient}
        ownTeachSkills={ownTeachSkills}
        targetTeachSkills={requestDialog?.targetTeachSkills || []}
        initialRequestedSkillId={requestDialog?.initialRequestedSkillId || ''}
        onClose={() => setRequestDialog(null)}
        onCreated={handleRequestCreated}
      />
    </div>
  )
}
