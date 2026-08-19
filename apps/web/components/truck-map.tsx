'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { TruckMapMarker } from '@chomp/types'
import { favoriteTruckAction, unfavoriteTruckAction } from '@/app/actions/favorites'

type Props = {
  /** Controlled — the current (possibly filtered/geolocation-refreshed) truck set.
   * Ownership of fetching lives in TruckDiscovery, not here, so the same data can
   * also drive the list view. */
  trucks: TruckMapMarker[]
  defaultCenter: { lat: number; lng: number }
  /** Set once geolocation resolves — triggers a flyTo, distinct from the marker
   * data itself since trucks can change (e.g. filtering) without the camera moving. */
  center: { lat: number; lng: number } | null
  /** Whether to render a favorite toggle in each popup at all — resolved once,
   * server-side, since there's no React context inside a Mapbox popup to
   * check <SignedIn> against. */
  viewerSignedIn: boolean
}

/**
 * Manual DOM event wiring, not React state — Mapbox popups aren't
 * React-rendered, so there's no revalidatePath-driven re-render like
 * TruckFavoriteButton gets on the truck detail page. This button owns and
 * updates its own textContent/aria-pressed directly after each toggle.
 */
function buildFavoriteButton(truck: TruckMapMarker): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'truck-popup-favorite text-marigold disabled:opacity-50'
  let isFavorited = truck.isFavorited
  let pending = false

  function render() {
    button.textContent = isFavorited ? '♥' : '♡'
    button.setAttribute('aria-pressed', String(isFavorited))
    button.disabled = pending
  }
  render()

  button.addEventListener('click', async () => {
    if (pending) return
    pending = true
    render()
    try {
      if (isFavorited) {
        await unfavoriteTruckAction(truck.id, truck.slug)
      } else {
        await favoriteTruckAction(truck.id, truck.slug)
      }
      isFavorited = !isFavorited
    } finally {
      pending = false
      render()
    }
  })

  return button
}

/**
 * Builds popup DOM via textContent (never innerHTML) so operator-entered
 * truck names/addresses can never inject markup into the page.
 *
 * Styled as a .ticket-card (see globals.css) rather than inheriting the
 * page's theme tokens: Mapbox's vendored CSS hardcodes the popup's own
 * background to white with no text color set, so text used to fall back to
 * inheriting --foreground — which flips to near-white in dark mode, giving
 * white text on a white card. .ticket-card's colors are fixed regardless of
 * theme, which fixes that and doubles as this app's one shared truck-card
 * motif (see ticket-card.tsx for the React version used elsewhere).
 */
function buildPopupContent(truck: TruckMapMarker, viewerSignedIn: boolean): HTMLElement {
  const container = document.createElement('div')
  container.className = 'truck-popup ticket-card w-56 overflow-hidden'

  const perforation = document.createElement('div')
  perforation.className = 'ticket-card__perforation'
  perforation.setAttribute('aria-hidden', 'true')
  container.appendChild(perforation)

  const body = document.createElement('div')
  body.className = 'space-y-1 p-3'
  container.appendChild(body)

  const nameRow = document.createElement('div')
  nameRow.className = 'flex items-start justify-between gap-2'
  body.appendChild(nameRow)

  const name = document.createElement('strong')
  name.className = 'font-display text-base leading-snug tracking-wide'
  name.textContent = truck.name
  nameRow.appendChild(name)

  if (viewerSignedIn) {
    nameRow.appendChild(buildFavoriteButton(truck))
  }

  if (truck.cuisineType.length > 0) {
    const cuisine = document.createElement('p')
    cuisine.className = 'text-sm text-char'
    cuisine.textContent = truck.cuisineType.join(', ')
    body.appendChild(cuisine)
  }

  const link = document.createElement('a')
  link.href = `/trucks/${truck.slug}`
  link.className = 'mt-1 inline-block text-sm font-medium text-salsa underline underline-offset-2'
  link.textContent = 'View truck'
  body.appendChild(link)

  return container
}

export function TruckMap({ trucks, defaultCenter, center, viewerSignedIn }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])

  // Mount once — creates the map and renders whatever trucks/viewerSignedIn
  // are current at mount time. Subsequent updates are handled by the two
  // effects below, keyed on the props that actually change over time.
  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!token || !containerRef.current) return

    mapboxgl.accessToken = token
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [defaultCenter.lng, defaultCenter.lat],
      zoom: 11,
    })
    mapRef.current = map

    renderMarkers(map, markersRef, trucks, viewerSignedIn)

    return () => {
      // Read live, not copied: renderMarkers reassigns markersRef.current to a
      // new array (not an in-place mutation) whenever trucks/viewerSignedIn
      // change, so a value captured here at mount time would go stale and
      // leak whatever markers got added by later renders.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      markersRef.current.forEach((marker) => marker.remove())
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-render markers whenever the (possibly filtered/refreshed) truck set changes.
  useEffect(() => {
    if (!mapRef.current) return
    renderMarkers(mapRef.current, markersRef, trucks, viewerSignedIn)
  }, [trucks, viewerSignedIn])

  // Fly to the viewer's real location once geolocation resolves — independent
  // of trucks changing, since filtering shouldn't move the camera.
  useEffect(() => {
    if (!mapRef.current || !center) return
    mapRef.current.flyTo({ center: [center.lng, center.lat], zoom: 12 })
  }, [center])

  if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
    return (
      <div className="flex min-h-[500px] items-center justify-center rounded-lg bg-gray-100 p-8 text-center text-gray-500">
        Map unavailable — NEXT_PUBLIC_MAPBOX_TOKEN is not configured.
      </div>
    )
  }

  return <div ref={containerRef} className="min-h-[500px] w-full rounded-lg" />
}

function renderMarkers(
  map: mapboxgl.Map,
  markersRef: React.MutableRefObject<mapboxgl.Marker[]>,
  trucks: TruckMapMarker[],
  viewerSignedIn: boolean,
) {
  markersRef.current.forEach((marker) => marker.remove())

  markersRef.current = trucks.map((truck) => {
    const popup = new mapboxgl.Popup({ offset: 24 }).setDOMContent(
      buildPopupContent(truck, viewerSignedIn),
    )
    return new mapboxgl.Marker()
      .setLngLat([truck.lng, truck.lat])
      .setPopup(popup)
      .addTo(map)
  })
}
