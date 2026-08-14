'use client'

import {
  Children,
  Fragment,
  isValidElement,
  ReactNode,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

type PageHeaderActionsProps = {
  children: ReactNode
  className?: string
  /**
   * Prefer keeping the last action (usually primary Create/Save) visible
   * and collapse earlier secondary actions into More.
   */
  keepLastVisible?: boolean
}

/** Flatten Fragments so PageHeader `actions={<>...</>}` becomes separate flex items with gap. */
function flattenActionChildren(children: ReactNode): ReactNode[] {
  return Children.toArray(children).flatMap((child) => {
    if (isValidElement(child) && child.type === Fragment) {
      return flattenActionChildren(child.props.children)
    }
    return [child]
  }).filter(Boolean)
}

type Visibility = {
  visible: number[]
  overflow: number[]
}

function computeVisibility(
  widths: number[],
  available: number,
  moreWidth: number,
  gap: number,
  keepLastVisible: boolean
): Visibility {
  const n = widths.length
  if (n === 0) return { visible: [], overflow: [] }
  if (widths.some((w) => w <= 0)) {
    return { visible: Array.from({ length: n }, (_, i) => i), overflow: [] }
  }

  const totalWidth = (indexes: number[], withMore: boolean) => {
    if (indexes.length === 0) return withMore ? moreWidth : 0
    const items = indexes.reduce((sum, i) => sum + widths[i], 0)
    const gaps = gap * Math.max(0, indexes.length - 1 + (withMore ? 1 : 0))
    return items + gaps + (withMore ? moreWidth : 0)
  }

  const all = Array.from({ length: n }, (_, i) => i)
  if (totalWidth(all, false) <= available) {
    return { visible: all, overflow: [] }
  }

  if (keepLastVisible && n > 1) {
    for (let secondary = n - 2; secondary >= 0; secondary--) {
      const visible = [...Array.from({ length: secondary }, (_, i) => i), n - 1]
      const overflow = Array.from({ length: n - 1 - secondary }, (_, i) => secondary + i)
      if (totalWidth(visible, overflow.length > 0) <= available) {
        return { visible, overflow }
      }
    }

    const onlyLast = [n - 1]
    const overflow = Array.from({ length: n - 1 }, (_, i) => i)
    if (totalWidth(onlyLast, true) <= available) {
      return { visible: onlyLast, overflow }
    }
  }

  for (let count = n - 1; count >= 0; count--) {
    const visible = Array.from({ length: count }, (_, i) => i)
    const overflow = Array.from({ length: n - count }, (_, i) => count + i)
    if (totalWidth(visible, overflow.length > 0) <= available) {
      return { visible, overflow }
    }
  }

  return { visible: [], overflow: all }
}

/**
 * Renders page-subheader actions in a single row.
 * When they would overflow, secondary actions move into a More dropdown.
 */
export default function PageHeaderActions({
  children,
  className,
  keepLastVisible = true,
}: PageHeaderActionsProps) {
  const items = useMemo(() => flattenActionChildren(children), [children])
  const itemCount = items.length

  const containerRef = useRef<HTMLDivElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])
  const moreBtnRef = useRef<HTMLButtonElement>(null)
  const widthCacheRef = useRef<number[]>([])
  const moreWidthRef = useRef(84)

  const [visibility, setVisibility] = useState<Visibility>(() => ({
    visible: Array.from({ length: itemCount }, (_, i) => i),
    overflow: [],
  }))
  const [menuOpen, setMenuOpen] = useState(false)

  useLayoutEffect(() => {
    widthCacheRef.current = []
    setVisibility({
      visible: Array.from({ length: itemCount }, (_, i) => i),
      overflow: [],
    })
    setMenuOpen(false)
  }, [itemCount])

  const recalculate = useCallback(() => {
    const container = containerRef.current
    if (!container || itemCount === 0) return

    const available = container.clientWidth
    if (available <= 0) return

    const cache = widthCacheRef.current
    itemRefs.current.forEach((el, index) => {
      if (!el) return
      const width = el.getBoundingClientRect().width
      if (width > 0) cache[index] = width
    })

    if (moreBtnRef.current) {
      const moreWidth = moreBtnRef.current.getBoundingClientRect().width
      if (moreWidth > 0) moreWidthRef.current = moreWidth
    }

    if (cache.length < itemCount || cache.slice(0, itemCount).some((w) => !w)) {
      setVisibility((prev) => {
        if (prev.overflow.length === 0 && prev.visible.length === itemCount) return prev
        return {
          visible: Array.from({ length: itemCount }, (_, i) => i),
          overflow: [],
        }
      })
      return
    }

    const widths = cache.slice(0, itemCount)
    const next = computeVisibility(
      widths,
      available,
      moreWidthRef.current,
      8,
      keepLastVisible
    )

    setVisibility((prev) => {
      if (
        prev.visible.length === next.visible.length &&
        prev.overflow.length === next.overflow.length &&
        prev.visible.every((v, i) => v === next.visible[i]) &&
        prev.overflow.every((v, i) => v === next.overflow[i])
      ) {
        return prev
      }
      return next
    })
  }, [itemCount, keepLastVisible])

  useLayoutEffect(() => {
    recalculate()
    const container = containerRef.current
    if (!container || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(() => recalculate())
    observer.observe(container)
    if (rowRef.current) observer.observe(rowRef.current)
    window.addEventListener('resize', recalculate)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', recalculate)
    }
  }, [recalculate, visibility.visible.length, visibility.overflow.length])

  if (itemCount === 0) return null

  const visibleItems = visibility.visible.map((i) => items[i])
  const overflowItems = visibility.overflow.map((i) => items[i])
  const showMore = overflowItems.length > 0

  return (
    <div
      ref={containerRef}
      data-page-header-actions=""
      className={cn('relative min-w-0 w-full', className)}
    >
      <div
        ref={rowRef}
        className="flex min-w-0 items-center justify-end gap-2 overflow-visible py-0.5"
      >
        {visibleItems.map((item, index) => {
          const itemIndex = visibility.visible[index]
          return (
            <div
              key={itemIndex}
              ref={(el) => {
                itemRefs.current[itemIndex] = el
              }}
              className="relative shrink-0 overflow-visible"
            >
              {item}
            </div>
          )
        })}

        <div className={cn('shrink-0', !showMore && 'pointer-events-none absolute opacity-0')}>
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger asChild>
              <Button
                ref={moreBtnRef}
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1 px-2.5"
                tabIndex={showMore ? 0 : -1}
                aria-hidden={!showMore}
                aria-label={`More actions (${overflowItems.length} hidden)`}
              >
                More
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </Button>
            </PopoverTrigger>
            {showMore ? (
              <PopoverContent
                align="end"
                className="w-auto min-w-[12.5rem] p-1.5"
                onOpenAutoFocus={(event) => event.preventDefault()}
              >
                <div
                  className="flex flex-col gap-1 [&_a]:w-full [&_button]:w-full [&_button]:justify-start"
                  onClick={() => setMenuOpen(false)}
                >
                  {overflowItems.map((item, index) => {
                    const itemIndex = visibility.overflow[index]
                    return (
                      <div
                        key={itemIndex}
                        ref={(el) => {
                          itemRefs.current[itemIndex] = el
                        }}
                        className="w-full"
                      >
                        {item}
                      </div>
                    )
                  })}
                </div>
              </PopoverContent>
            ) : null}
          </Popover>
        </div>
      </div>
    </div>
  )
}
