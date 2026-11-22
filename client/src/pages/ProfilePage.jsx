import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import LoadingScreen from '../components/common/LoadingScreen.jsx'
import PageHeader from '../components/common/PageHeader.jsx'
import Alert from '../components/ui/Alert.jsx'
import Button from '../components/ui/Button.jsx'
import { Card, CardDescription, CardHeader, CardTitle } from '../components/ui/Card.jsx'
import ProfileDetails from '../components/profile/ProfileDetails.jsx'
import ProfileForm from '../components/profile/ProfileForm.jsx'
import { useAuth } from '../hooks/useAuth.js'

export default function ProfilePage() {
  const { user, isLoading, refreshUser } = useAuth()
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState(null)

  async function handleRefresh() {
    setRefreshing(true)
    setRefreshError(null)
    try {
      await refreshUser()
    } catch (error) {
      setRefreshError(error)
    } finally {
      setRefreshing(false)
    }
  }

  if (isLoading && !user) {
    return <LoadingScreen message="Loading your profile…" />
  }

  return (
    <div className="animate-rise space-y-8">
      <PageHeader
        eyebrow="Profile"
        title="Your profile"
        description="Keep the details other members see accurate and up to date."
        actions={
          <Button variant="secondary" size="sm" loading={refreshing} onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      {refreshError && (
        <Alert variant="error" title="Could not refresh your profile">
          {refreshError.message}
        </Alert>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <ProfileDetails user={user} />
        <Card>
          <CardHeader>
            <CardTitle>Edit profile</CardTitle>
            <CardDescription>
              Only the fields shown here can be changed. Only modified fields are sent.
            </CardDescription>
          </CardHeader>
          <div className="px-5 py-5 sm:px-6">
            <ProfileForm user={user} />
          </div>
        </Card>
      </div>
    </div>
  )
}
