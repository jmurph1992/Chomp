'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { TruckMapMarker } from '@chomp/types'
import { getNearbyTrucksAction } from '@/app/actions/trucks'

type Props = {
  initialTrucks: TruckMapMarker[]
  defaultCenter: { lat: number; lng: number }
}

/** Builds popup DOM via textContent (never innerHTML) so operator-entered
 * truck names/addresses can never inject markup into the page. */
function buildPopupContent(truck: TruckMapMarker): HTMLElement {
  const container = document.createElement('div')
  container.className = 'truck-popup'

  const name = document.createElement('strong')
  name.textContent = truck.name
  container.appendChild(name)

  if (truck.cuisineType.length > 0) {
    const cuisine = document.createElement('p')
    cuisine.textContent = truck.cuisineType.join(', ')
    container.appendChild(cuisine)
  }

  const link = document.createElement('a')
  link.href = `/trucks/${truck.slug}`
  link.textContent = 'View truck'
  container.appendChild(link)

  return container
}

export function TruckMap({ initialTrucks, defaultCenter }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])

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

    renderMarkers(map, markersRef, initialTrucks)

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords
          map.flyTo({ center: [longitude, latitude], zoom: 12 })
          const trucks = await getNearbyTrucksAction(latitude, longitude)
          renderMarkers(map, markersRef, trucks)
        },
        () => {
          // Permission denied or unavailable — keep the default-region results.
        },
        { timeout: 8000 },
      )
    }

    return () => {
      markersRef.current.forEach((marker) => marker.remove())
      map.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
) {
  markersRef.current.forEach((marker) => marker.remove())

  markersRef.current = trucks.map((truck) => {
    const popup = new mapboxgl.Popup({ offset: 24 }).setDOMContent(buildPopupContent(truck))
    return new mapboxgl.Marker()
      .setLngLat([truck.lng, truck.lat])
      .setPopup(popup)
      .addTo(map)
  })
}
