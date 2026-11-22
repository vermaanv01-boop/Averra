import { useCallback, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import PageHeader from '../components/common/PageHeader.jsx'
import Alert from '../components/ui/Alert.jsx'
import Button from '../components/ui/Button.jsx'
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx'
import SkillFormDialog from '../components/skills/SkillFormDialog.jsx'
import SkillSection from '../components/skills/SkillSection.jsx'
import useSkills from '../hooks/useSkills.js'
import { SKILL_TYPE_LABELS } from '../utils/constants.js'

export default function SkillsPage() {
  const { skills, loading, error, mutating, load, create, update, remove } = useSkills()
  const [dialog, setDialog] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const deletingRef = useRef(false)

  const closeDialog = useCallback(() => setDialog(null), [])
  const closeDelete = useCallback(() => setDeleteTarget(null), [])

  async function handleCreate(values) {
    const result = await create(values)
    if (result.error) {
      setNotice('')
      setActionError(result.error.message)
      return result
    }
    setActionError('')
    setNotice(`“${result.data.name}” added to ${SKILL_TYPE_LABELS[values.type].toLowerCase()}.`)
    return result
  }

  async function handleUpdate(id, values) {
    const result = await update(id, values)
    if (result.error) {
      setNotice('')
      setActionError(result.error.message)
      return result
    }
    setActionError('')
    setNotice(`“${result.data.name}” was updated.`)
    return result
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget || deletingRef.current) return
    deletingRef.current = true
    const result = await remove(deleteTarget.id)
    deletingRef.current = false

    if (result.error) {
      setNotice('')
      setActionError(result.error.message)
      return
    }
    setActionError('')
    setNotice(`“${deleteTarget.name}” was removed.`)
    setDeleteTarget(null)
  }

  return (
    <div className="animate-rise space-y-8">
      <PageHeader
        eyebrow="Skills"
        title="What you know, and what you want to learn"
        description="Keep your teaching and learning skills separate so the right exchanges can find you."
        actions={
          <Button variant="secondary" size="sm" loading={loading} onClick={load}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      {error && (
        <Alert
          variant="error"
          title="Could not load your skills"
          action={
            <Button variant="secondary" size="sm" onClick={load}>
              Retry
            </Button>
          }
        >
          {error.message}
        </Alert>
      )}
      {actionError && <Alert variant="error">{actionError}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      <div className="grid gap-5 xl:grid-cols-2">
        <SkillSection
          type="teach"
          skills={skills.filter((skill) => skill.type === 'teach')}
          loading={loading}
          disabled={mutating}
          onAdd={(type) => setDialog({ type, skill: null })}
          onEdit={(skill) => setDialog({ type: skill.type, skill })}
          onDelete={setDeleteTarget}
        />
        <SkillSection
          type="learn"
          skills={skills.filter((skill) => skill.type === 'learn')}
          loading={loading}
          disabled={mutating}
          onAdd={(type) => setDialog({ type, skill: null })}
          onEdit={(skill) => setDialog({ type: skill.type, skill })}
          onDelete={setDeleteTarget}
        />
      </div>

      <SkillFormDialog
        open={Boolean(dialog)}
        type={dialog?.type || 'teach'}
        skill={dialog?.skill || null}
        skills={skills}
        saving={mutating}
        onClose={closeDialog}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete this skill?"
        description={deleteTarget ? `“${deleteTarget.name}” will be removed from your profile.` : ''}
        confirmLabel="Delete skill"
        loading={mutating}
        onConfirm={handleDeleteConfirm}
        onCancel={closeDelete}
      />
    </div>
  )
}
