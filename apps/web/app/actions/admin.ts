'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin'
import { dismissContentReport, resolveContentReport } from '@/lib/reports'
import { setReviewVisibility } from '@/lib/reviews'
import { holdTruck, rejectTruck, verifyTruck } from '@/lib/trucks'

// slug is only needed to revalidate the now-stale public page/map data —
// verifyTruck/rejectTruck/holdTruck themselves are scoped by truckId alone.

export async function verifyTruckAction(truckId: string, slug: string): Promise<void> {
  await requireAdmin()
  await verifyTruck(truckId)
  revalidatePath('/admin/trucks')
  revalidatePath(`/trucks/${slug}`)
  revalidatePath('/')
}

export async function rejectTruckAction(truckId: string, slug: string, reason: string): Promise<void> {
  await requireAdmin()
  await rejectTruck(truckId, reason)
  revalidatePath('/admin/trucks')
  revalidatePath(`/trucks/${slug}`)
  revalidatePath('/')
}

export async function holdTruckAction(truckId: string, slug: string, reason: string): Promise<void> {
  await requireAdmin()
  await holdTruck(truckId, reason)
  revalidatePath('/admin/trucks')
  revalidatePath(`/trucks/${slug}`)
  revalidatePath('/')
}

export async function hideReviewAction(reviewId: string, slug: string, reason: string): Promise<void> {
  const admin = await requireAdmin()
  await setReviewVisibility(reviewId, false, reason, admin.id)
  revalidatePath('/admin/reviews')
  revalidatePath(`/trucks/${slug}`)
}

export async function unhideReviewAction(reviewId: string, slug: string, reason: string): Promise<void> {
  const admin = await requireAdmin()
  await setReviewVisibility(reviewId, true, reason, admin.id)
  revalidatePath('/admin/reviews')
  revalidatePath(`/trucks/${slug}`)
}

// slug isn't known ahead of time here (the report could target either a
// review or a photo, on any truck) — resolveContentReportAction/
// dismissContentReportAction revalidate broadly rather than threading a
// truck slug through, same tradeoff verifyTruckAction's revalidatePath('/')
// already makes.
export async function resolveContentReportAction(reportId: string, resolutionNote: string): Promise<void> {
  const admin = await requireAdmin()
  await resolveContentReport(reportId, admin.id, resolutionNote)
  revalidatePath('/admin/reports')
  revalidatePath('/admin/reviews')
}

export async function dismissContentReportAction(reportId: string, resolutionNote: string): Promise<void> {
  const admin = await requireAdmin()
  await dismissContentReport(reportId, admin.id, resolutionNote)
  revalidatePath('/admin/reports')
}
