import { getAllReviewsForAdmin } from '@/lib/reviews'
import { AdminReviewQueue } from '@/components/admin/review-queue'

// Authorization is enforced by the parent layout (requireAdmin).
export default async function AdminReviewsPage() {
  const reviews = await getAllReviewsForAdmin()

  return (
    <div>
      <h1 className="text-2xl font-bold">Review moderation</h1>
      <p className="mt-1 text-gray-500">
        Hidden reviews never appear on a truck's public page. Every hide/unhide requires a reason.
      </p>
      <AdminReviewQueue reviews={reviews} />
    </div>
  )
}
