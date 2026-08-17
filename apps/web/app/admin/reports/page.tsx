import { getAllContentReports } from '@/lib/reports'
import { AdminReportQueue } from '@/components/admin/report-queue'

// Authorization is enforced by the parent layout (requireAdmin).
export default async function AdminReportsPage() {
  const reports = await getAllContentReports()

  return (
    <div>
      <h1 className="text-2xl font-bold">Content reports</h1>
      <p className="mt-1 text-gray-500">
        Customer-flagged reviews and photos. Resolving a report hides the underlying content;
        dismissing leaves it untouched. Resolving also closes any other open reports on the same
        item.
      </p>
      <AdminReportQueue reports={reports} />
    </div>
  )
}
