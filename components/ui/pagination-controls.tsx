'use client'

import { Button } from '@/components/ui/button'
import { DEFAULT_PAGE_SIZE } from '@/hooks/usePagination'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationControlsProps {
  page: number
  totalPages: number
  totalItems: number
  pageSize?: number
  onPageChange: (page: number) => void
  className?: string
}

export default function PaginationControls({
  page,
  totalPages,
  totalItems,
  pageSize = DEFAULT_PAGE_SIZE,
  onPageChange,
  className = '',
}: PaginationControlsProps) {
  if (totalItems === 0) return null

  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, totalItems)

  return (
    <div className={`flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      <p className="text-sm text-gray-500">
        Showing {start}–{end} of {totalItems}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <span className="min-w-[88px] text-center text-sm text-gray-600">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
