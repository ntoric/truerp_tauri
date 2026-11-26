'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  SCHEDULE_FREQUENCIES,
  WEEKDAYS,
  describeSchedule,
  type ScheduleFrequency,
} from '@/lib/partyStatement'

export interface ScheduleTiming {
  name: string
  frequency: ScheduleFrequency
  run_date: string
  weekday: number
  day_of_month: number
  send_time: string
}

export function defaultScheduleTiming(): ScheduleTiming {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const iso = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
  return { name: '', frequency: 'monthly', run_date: iso, weekday: 1, day_of_month: 1, send_time: '10:00' }
}

/** When / how often a statement schedule runs. Times are in the store's timezone. */
export default function StatementScheduleFields({
  value,
  onChange,
}: {
  value: ScheduleTiming
  onChange: (v: ScheduleTiming) => void
}) {
  const set = <K extends keyof ScheduleTiming>(k: K, v: ScheduleTiming[K]) => onChange({ ...value, [k]: v })

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="sch-frequency">Repeat</Label>
          <Select value={value.frequency} onValueChange={(v) => set('frequency', v as ScheduleFrequency)}>
            <SelectTrigger id="sch-frequency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCHEDULE_FREQUENCIES.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sch-time">Time</Label>
          <Input id="sch-time" type="time" value={value.send_time} onChange={(e) => set('send_time', e.target.value)} />
        </div>
      </div>

      {value.frequency === 'once' && (
        <div className="space-y-1.5">
          <Label htmlFor="sch-date">Date</Label>
          <Input id="sch-date" type="date" value={value.run_date} onChange={(e) => set('run_date', e.target.value)} />
        </div>
      )}
      {value.frequency === 'weekly' && (
        <div className="space-y-1.5">
          <Label htmlFor="sch-weekday">On</Label>
          <Select value={String(value.weekday)} onValueChange={(v) => set('weekday', Number(v))}>
            <SelectTrigger id="sch-weekday">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEEKDAYS.map((d, i) => (
                <SelectItem key={d} value={String(i)}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {value.frequency === 'monthly' && (
        <div className="space-y-1.5">
          <Label htmlFor="sch-dom">On day</Label>
          <Select value={String(value.day_of_month)} onValueChange={(v) => set('day_of_month', Number(v))}>
            <SelectTrigger id="sch-dom">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {d}
                </SelectItem>
              ))}
              <SelectItem value="0">Last day of month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="sch-name">Schedule name</Label>
        <Input
          id="sch-name"
          value={value.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="e.g. Monthly balance reminder"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {describeSchedule(value)}, store time. The period is worked out at each send, e.g. &quot;Previous month&quot;
        sent on the 1st covers the whole of last month.
      </p>
    </div>
  )
}
