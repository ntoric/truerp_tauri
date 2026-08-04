'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { exportReportCsv, exportReportJson } from '@/lib/reportsExport'
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
          onClick={() => {
            exportReportCsv(baseName, csvRows)
            onExported?.('csv')
          }}
        >
          Download CSV
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            exportReportJson(baseName, jsonData)
            onExported?.('json')
          }}
        >
          Download JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
