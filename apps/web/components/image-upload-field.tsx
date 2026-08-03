'use client'

import Image from 'next/image'
import { useImageUpload } from './use-image-upload'

type Props = {
  label: string
  value: string | null
  onChange: (url: string) => void
}

const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp'

export function ImageUploadField({ label, value, onChange }: Props) {
  const { upload, isUploading, error } = useImageUpload()

  return (
    <div>
      <label className="block text-sm font-medium">{label}</label>
      {value && (
        <Image
          src={value}
          alt=""
          width={80}
          height={80}
          unoptimized
          className="mt-1 h-20 w-20 rounded object-cover"
        />
      )}
      <input
        type="file"
        accept={ACCEPTED_TYPES}
        disabled={isUploading}
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          const url = await upload(file)
          if (url) onChange(url)
        }}
        className="mt-1 text-sm"
      />
      {isUploading && <p className="text-sm text-gray-500">Uploading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
