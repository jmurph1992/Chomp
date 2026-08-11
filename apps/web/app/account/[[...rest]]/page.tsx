import { notFound } from 'next/navigation'
import { UserProfile } from '@clerk/nextjs'
import { getCurrentUser } from '@/lib/auth'
import { getReviewsForUser } from '@/lib/reviews'
import { getFavoriteMenuItemsForUser, getFavoriteTrucksForUser } from '@/lib/favorites'
import { findSoleOwnedTrucks } from '@/lib/user-erasure'
import { MyReviews } from '@/components/account/my-reviews'
import { MyFavorites } from '@/components/account/my-favorites'
import { DeleteAccountSection } from '@/components/account/delete-account-section'

/**
 * Catch-all route (not a stylistic choice) — Clerk's <UserProfile /> has its
 * own internal sub-navigation (account/security tabs) that pushes sub-paths
 * under wherever it's mounted; routing="path" needs a matching catch-all to
 * resolve them, same reason /sign-in and /sign-up are catch-alls too.
 *
 * Not in middleware.ts's public allowlist — protected by default, same as
 * /dashboard. getCurrentUser() should never actually be null here (the
 * middleware already guarantees a session) — notFound() defensively covers
 * the rare pre-webhook-sync race, same idiom the dashboard layout uses.
 */
export default async function AccountPage() {
  const user = await getCurrentUser()
  if (!user) notFound()

  const [reviews, favoriteTrucks, favoriteMenuItems, blockingTrucks] = await Promise.all([
    getReviewsForUser(user.id),
    getFavoriteTrucksForUser(user.id),
    getFavoriteMenuItemsForUser(user.id),
    findSoleOwnedTrucks(user.id),
  ])

  return (
    <main className="mx-auto max-w-2xl p-8">
      <UserProfile routing="path" path="/account" />

      <section className="mt-8">
        <h2 className="text-xl font-bold">Your favorites</h2>
        <div className="mt-4">
          <MyFavorites trucks={favoriteTrucks} menuItems={favoriteMenuItems} />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold">Your reviews</h2>
        <div className="mt-4">
          <MyReviews reviews={reviews} />
        </div>
      </section>

      <DeleteAccountSection userEmail={user.email} blockingTrucks={blockingTrucks} />
    </main>
  )
}
