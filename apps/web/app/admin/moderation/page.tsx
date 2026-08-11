import { getOpenModerationQueue } from '@/lib/moderation-queue'
import { AdminModerationQueue } from '@/components/admin/moderation-queue'

// Authorization is enforced by the parent layout (requireAdmin).
export default async function AdminModerationPage() {
  const entries = await getOpenModerationQueue()

  return (
    <div>
      <h1 className="text-2xl font-bold">Moderation queue</h1>
      <p className="mt-1 text-gray-500">
        Held account deletions, blocked because the account is the sole owner of a truck. Resolve a
        blocking truck below (delete it, or reassign it to an existing manager), then Resolve to
        complete the deletion — or Dismiss to restore the account instead.
      </p>
      {entries.length === 0 ? (
        <p className="mt-6 text-gray-500">Nothing pending.</p>
      ) : (
        <AdminModerationQueue entries={entries} />
      )}
    </div>
  )
}
