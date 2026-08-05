'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { exportReportCsv, exportReportJson } from '@/lib/reportsExport'
import { notifyError } from '@/lib/notify'
import { Download } from 'lucide-react'

type ReportExportMenuProps = {
  baseName: string
  csvRows: (string | number | null | undefined)[][]
  jsonData: unknown
  disabled?: boolean
  size?: 'sm' | 'default'
  onExported?: (format: 'csv' | 'json') => void
}

export function ReportExportMenu({
  baseName,
  csvRows,
  jsonData,
  disabled,
  size = 'sm',
  onExported,
}: ReportExportMenuProps) {
  const runCsv = async () => {
    try {
      await exportReportCsv(baseName, csvRows)
      onExported?.('csv')
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Failed to export CSV')
    }
  }

  const runJson = async () => {
    try {
      await exportReportJson(baseName, jsonData)
      onExported?.('json')
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Failed to export JSON')
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size={size} disabled={disabled}>
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault()
            void runCsv()
          }}
        >
          Download CSV
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault()
            void runJson()
          }}
        >
          Download JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
