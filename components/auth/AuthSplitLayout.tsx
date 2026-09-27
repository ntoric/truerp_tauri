'use client'

import { ReactNode } from 'react'
import BrandLogo from '@/components/BrandLogo'
import { ArrowRight } from 'lucide-react'

export default function AuthSplitLayout({
  headline,
  benefits,
  children,
}: {
  headline: ReactNode
  benefits: string[]
  children: ReactNode
}) {
  return (
    <main className="login-page grid min-h-screen min-h-[100dvh] bg-white text-[#20212b] md:grid-cols-2">
      <section className="flex flex-col justify-between gap-12 bg-[linear-gradient(150deg,#dc2626_0%,#991b1b_55%,#450a0a_100%)] px-7 py-8 text-white md:min-h-[100dvh] md:p-10 lg:p-14" aria-labelledby="workspace-heading">
        <div>
          <BrandLogo iconClassName="h-10 w-10" wordmarkClassName="text-xl text-white [&>span]:text-white" />
          <p className="mt-3 text-xs font-medium tracking-[0.12em] text-rose-100">BY RUNERAIL</p>
        </div>
        <div className="max-w-lg md:pb-3">
          <h1 id="workspace-heading" className="text-[2rem] font-semibold leading-[1.12] tracking-tight sm:text-[2.5rem] lg:text-5xl">
            {headline}
          </h1>
          <ul className="mt-8 hidden space-y-4 text-[15px] text-rose-100 md:block">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex items-center gap-3">
                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                {benefit}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="flex items-center justify-center px-6 py-12 sm:px-10 md:py-16" aria-labelledby="login-heading">
        <div className="w-full max-w-[360px]">
          {children}
        </div>
      </section>
      <style jsx>{`
        .login-page {
          --primary: 350 74% 45%;
          color-scheme: light;
        }
        main.login-page :global(a:focus-visible),
        main.login-page :global(button:focus-visible) {
          outline: 2px solid #c81e3a !important;
          outline-offset: 4px;
        }
      `}</style>
    </main>
  )
}
