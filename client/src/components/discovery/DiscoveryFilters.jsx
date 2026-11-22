import Input from '../ui/Input.jsx'
import Select from '../ui/Select.jsx'
import Button from '../ui/Button.jsx'
import {
  DISCOVERY_SORTS,
  PROFICIENCY_LEVELS,
  SKILL_CATEGORIES,
  SKILL_TYPE_LABELS,
  SKILL_TYPES,
  formatLabel
} from '../../utils/constants.js'

const categoryOptions = SKILL_CATEGORIES.map((value) => ({ value, label: formatLabel(value) }))
const proficiencyOptions = PROFICIENCY_LEVELS.map((value) => ({ value, label: formatLabel(value) }))
const typeOptions = SKILL_TYPES.map((value) => ({ value, label: SKILL_TYPE_LABELS[value] }))
const sortOptions = DISCOVERY_SORTS

export default function DiscoveryFilters({ values, onChange, onReset, loading = false }) {
  return (
    <section aria-label="Discovery filters" className="rounded-card border border-ink-200/80 bg-white p-5 shadow-soft">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Input
          label="Search people"
          value={values.q}
          disabled={loading}
          placeholder="Name or username"
          helperText="Filters the current page of results."
          onChange={(event) => onChange('q', event.target.value)}
        />
        <Input
          label="Skill"
          value={values.skill}
          disabled={loading}
          placeholder="e.g. Design"
          helperText="Searches skills through the API."
          onChange={(event) => onChange('skill', event.target.value)}
        />
        <Select
          label="Category"
          value={values.category}
          disabled={loading}
          placeholder="Any category"
          options={categoryOptions}
          onChange={(event) => onChange('category', event.target.value)}
        />
        <Select
          label="Proficiency"
          value={values.proficiency}
          disabled={loading}
          placeholder="Any level"
          options={proficiencyOptions}
          onChange={(event) => onChange('proficiency', event.target.value)}
        />
        <Select
          label="Skill type"
          value={values.type}
          disabled={loading}
          options={typeOptions}
          onChange={(event) => onChange('type', event.target.value)}
        />
        <Select
          label="Sort by"
          value={values.sort}
          disabled={loading}
          options={sortOptions}
          onChange={(event) => onChange('sort', event.target.value)}
        />
      </div>

      <div className="mt-5 flex justify-end border-t border-ink-100 pt-4">
        <Button variant="ghost" size="sm" onClick={onReset}>
          Reset filters
        </Button>
      </div>
    </section>
  )
}
