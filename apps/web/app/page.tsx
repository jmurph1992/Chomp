import { TruckDiscovery } from '@/components/truck-discovery'
import { getNearbyTrucks } from '@/lib/trucks'
import { getCurrentUser } from '@/lib/auth'
import { DEFAULT_LOCATION, DEFAULT_RADIUS_METERS } from '@/lib/geo'

// Truck locations change over time — always render at request time rather than
// baking a snapshot into a static build.
export const dynamic = 'force-dynamic'

/**
 * Root page — truck discovery map. Server-renders results around a default
 * fallback region so there's something on screen immediately; the client map
 * re-centers on the user's real location once/if geolocation is granted.
 */
export default async function HomePage() {
  const currentUser = await getCurrentUser()
  const trucks = await getNearbyTrucks(
    DEFAULT_LOCATION.lat,
    DEFAULT_LOCATION.lng,
    DEFAULT_RADIUS_METERS,
    currentUser?.id,
  )

  return (
    <main className="flex min-h-screen flex-col p-8">
      <h1 className="font-display text-4xl tracking-wide">Chomp</h1>
      <p className="mt-2 mb-6 text-lg text-muted-foreground">Food trucks near you.</p>
      <TruckDiscovery
        initialTrucks={trucks}
        defaultCenter={DEFAULT_LOCATION}
        viewerSignedIn={!!currentUser}
      />
    </main>
  )
}
