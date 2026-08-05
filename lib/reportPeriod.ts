export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly'

export const REPORT_PERIOD_OPTIONS: { value: ReportPeriod; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]

export function isReportPeriod(value: string | null): value is ReportPeriod {
  return value === 'daily' || value === 'weekly' || value === 'monthly' || value === 'yearly'
}

/** Human-readable rolling window for period-scoped summary stats. */
export function reportPeriodWindowLabel(period: ReportPeriod): string {
  switch (period) {
    case 'daily':
      return 'last 30 days'
    case 'weekly':
      return 'last 12 weeks'
    case 'monthly':
      return 'last 12 months'
    case 'yearly':
      return 'last 5 years'
  }
}

/** Chart/table bucket label (Daily, Weekly, etc.). */
export function reportPeriodGroupingLabel(period: ReportPeriod): string {
  switch (period) {
    case 'daily':
      return 'Daily'
    case 'weekly':
      return 'Weekly'
    case 'monthly':
      return 'Monthly'
    case 'yearly':
      return 'Yearly'
  }
}
