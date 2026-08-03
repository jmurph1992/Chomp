'use client'

import { useState, useTransition } from 'react'
import type { TruckProfileEdit } from '@chomp/types'
import { updateTruckProfileAction } from '@/app/actions/trucks'
import { MAX_TRUCK_DESCRIPTION_LENGTH, MAX_TRUCK_NAME_LENGTH } from '@/lib/trucks'
import { ImageUploadField } from '@/components/image-upload-field'

export function TruckProfileForm({ truck }: { truck: TruckProfileEdit }) {
  const [name, setName] = useState(truck.name)
  const [description, setDescription] = useState(truck.description ?? '')
  const [cuisine, setCuisine] = useState(truck.cuisineType.join(', '))
  const [phone, setPhone] = useState(truck.phone ?? '')
  const [website, setWebsite] = useState(truck.website ?? '')
  const [instagram, setInstagram] = useState(truck.instagram ?? '')
  const [logoUrl, setLogoUrl] = useState(truck.logoUrl ?? '')
  const [coverUrl, setCoverUrl] = useState(truck.coverUrl ?? '')
  const [isActive, setIsActive] = useState(truck.isActive)
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('idle')
    setError(null)

    startTransition(async () => {
      try {
        await updateTruckProfileAction(truck.id, truck.slug, {
          name: name.trim(),
          description: description.trim() || null,
          cuisineType: cuisine
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean),
          phone: phone.trim() || null,
          website: website.trim() || null,
          instagram: instagram.trim() || null,
          logoUrl: logoUrl.trim() || null,
          coverUrl: coverUrl.trim() || null,
          isActive,
        })
        setStatus('saved')
      } catch (err) {
        setStatus('error')
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4">
      <div>
        <label className="block text-sm font-medium">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_TRUCK_NAME_LENGTH}
          className="mt-1 w-full rounded border p-2 text-sm"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={MAX_TRUCK_DESCRIPTION_LENGTH}
          rows={3}
          className="mt-1 w-full rounded border p-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Cuisine (comma-separated)</label>
        <input
          value={cuisine}
          onChange={(e) => setCuisine(e.target.value)}
          className="mt-1 w-full rounded border p-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Phone</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-1 w-full rounded border p-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Website</label>
        <input
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className="mt-1 w-full rounded border p-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Instagram</label>
        <input
          value={instagram}
          onChange={(e) => setInstagram(e.target.value)}
          className="mt-1 w-full rounded border p-2 text-sm"
        />
      </div>
      <ImageUploadField label="Logo" value={logoUrl || null} onChange={setLogoUrl} />
      <ImageUploadField label="Cover image" value={coverUrl || null} onChange={setCoverUrl} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        Listed publicly
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {status === 'saved' && <p className="text-sm text-green-700">Saved.</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        Save
      </button>
    </form>
  )
}
