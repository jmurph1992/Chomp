import { getAllTrucksForAdmin } from '@/lib/trucks'
import { AdminTruckQueue } from '@/components/admin/truck-queue'

// Authorization is enforced by the parent layout (requireAdmin).
export default async function AdminTrucksPage() {
  const trucks = await getAllTrucksForAdmin()

  return (
    <div>
      <h1 className="text-2xl font-bold">Truck verification</h1>
      <p className="mt-1 text-gray-500">
        Trucks are hidden from the map and their public page until verified.
      </p>
      <AdminTruckQueue trucks={trucks} />
    </div>
  )
}
