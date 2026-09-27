import { cn } from '@/lib/utils'

type BrandLogoProps = {
  className?: string
  iconClassName?: string
  wordmarkClassName?: string
  showWordmark?: boolean
}

export default function BrandLogo({
  className,
  iconClassName,
  wordmarkClassName,
  showWordmark = true,
}: BrandLogoProps) {
  return (
    <span role="img" aria-label="TruERP" className={cn('inline-flex shrink-0 items-center gap-2.5', className)}>
      <img
        src="/logo.svg"
        alt=""
        aria-hidden="true"
        width={96}
        height={96}
        className={cn('h-10 w-10 shrink-0 object-contain', iconClassName)}
      />
      {showWordmark && (
        <span aria-hidden="true" className={cn('whitespace-nowrap text-2xl font-bold tracking-tight text-[#111111]', wordmarkClassName)}>
          Tru<span className="text-[#c81e3a]">ERP</span>
        </span>
      )}
    </span>
  )
}
