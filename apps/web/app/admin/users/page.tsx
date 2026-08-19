import { getAllUsersForAdmin } from '@/lib/users'
import { AdminUserQueue } from '@/components/admin/user-queue'

// Authorization is enforced by the parent layout (requireAdmin).
export default async function AdminUsersPage() {
  const users = await getAllUsersForAdmin()

  return (
    <div>
      <h1 className="text-2xl font-bold">Users</h1>
      <p className="mt-1 text-gray-500">
        Deleting a user who&apos;s the sole owner of a truck blocks the deletion and queues it for
        moderation instead — see the Moderation tab.
      </p>
      <AdminUserQueue users={users} />
    </div>
  )
}
