'use client'

import { DURATION_PRESETS, type DurationPresetId } from '@chomp/utils'

type Props = {
  value: DurationPresetId | null
  onChange: (id: DurationPresetId) => void
}

/** Reused for both the initial location post and the extend action. */
export function LocationDurationPicker({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="How long will you be here?">
      {DURATION_PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          role="radio"
          aria-checked={value === preset.id}
          onClick={() => onChange(preset.id)}
          className={`rounded border px-3 py-1 text-sm ${
            value === preset.id ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300'
          }`}
        >
          {preset.label}
        </button>
      ))}
    </div>
  )
}
