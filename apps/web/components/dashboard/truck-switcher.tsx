'use client'

import { useRouter } from 'next/navigation'
import type { OperatedTruck } from '@chomp/types'

export function TruckSwitcher({
  trucks,
  currentTruckId,
}: {
  trucks: OperatedTruck[]
  currentTruckId: string
}) {
  const router = useRouter()

  if (trucks.length <= 1) return null

  return (
    <select
      className="mt-2 rounded border p-1 text-sm"
      defaultValue={currentTruckId}
      onChange={(e) => router.push(`/dashboard/${e.target.value}`)}
    >
      {trucks.map((truck) => (
        <option key={truck.id} value={truck.id}>
          {truck.name}
        </option>
      ))}
    </select>
  )
}
