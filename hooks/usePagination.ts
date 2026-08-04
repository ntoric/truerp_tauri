'use client'

import { useEffect, useMemo, useState } from 'react'

export const DEFAULT_PAGE_SIZE = 25

export function usePagination<T>(items: T[], pageSize = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(1)

  const totalItems = items.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const paginatedItems = useMemo(() => {
    if (totalItems === 0) return []
    const currentPage = Math.min(page, totalPages)
    const start = (currentPage - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, page, pageSize, totalItems, totalPages])

  const resetPage = () => setPage(1)

  return {
    page,
    setPage,
    pageSize,
    totalItems,
    totalPages,
    paginatedItems,
    resetPage,
  }
}
