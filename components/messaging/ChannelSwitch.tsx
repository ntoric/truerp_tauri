'use client'

export type MessagingChannel = 'whatsapp' | 'telegram'

const CHANNEL_LABEL: Record<MessagingChannel, string> = {
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
}

/** Pill switch between WhatsApp and Telegram, with a connected/not-connected dot per channel. */
export default function ChannelSwitch({
  value,
  onChange,
  ready,
}: {
  value: MessagingChannel
  onChange: (v: MessagingChannel) => void
  ready: Partial<Record<MessagingChannel, boolean>>
}) {
  return (
    <div className="inline-flex rounded-md border p-0.5 text-sm" role="tablist" aria-label="Channel">
      {(['whatsapp', 'telegram'] as const).map((v) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={value === v}
          onClick={() => onChange(v)}
          className={`flex items-center gap-1.5 rounded px-4 py-1.5 ${
            value === v
              ? v === 'telegram'
                ? 'bg-sky-600 font-medium text-white'
                : 'bg-green-600 font-medium text-white'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          {CHANNEL_LABEL[v]}
          {ready[v] !== undefined && (
            <span
              className={`h-1.5 w-1.5 rounded-full ${ready[v] ? 'bg-green-400' : 'bg-amber-400'}`}
              aria-label={ready[v] ? 'connected' : 'not connected'}
            />
          )}
        </button>
      ))}
    </div>
  )
}
