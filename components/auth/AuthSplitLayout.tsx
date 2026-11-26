'use client'

import { ReactNode } from 'react'
import BrandLogo from '@/components/BrandLogo'
import { ArrowRight } from 'lucide-react'

/*
  Sign-in shell following the Gooseroot UI kit (gooseroot-ui/pages/signin.html, `gr-signin`):
  brand-gradient panel on the left with a giant white Lens watermark, and the form in a
  floating white card on the tinted page background on the right. Stacks with the brand
  panel on top below 768px.
*/
export default function AuthSplitLayout({
  headline,
  benefits,
  overline = 'Billing & inventory',
  children,
}: {
  headline: ReactNode
  benefits: string[]
  overline?: string
  children: ReactNode
}) {
  return (
    <main className="auth-page relative isolate grid overflow-hidden min-h-screen min-h-[100dvh] bg-background text-foreground md:grid-cols-2">
      {/* Brand panel: fixed brand gradient (Scarlet → Red → Crimson, 140°), independent of the
          user's accent theme, with the official white Lens symbol as a 10% watermark. */}
      <section
        className="relative flex flex-col overflow-hidden bg-[linear-gradient(140deg,#F0140A_0%,#D4031A_45%,#B8002E_100%)] px-6 pb-8 pt-7 text-white sm:px-8 sm:pb-10 sm:pt-9 md:min-h-[100dvh] md:px-12 md:py-12 lg:px-16 lg:py-14"
        aria-labelledby="workspace-heading"
      >
        {/* Stacked (mobile) layout: watermark stays inside the brand panel. */}
        <img
          src="/brand/gooseroot-symbol-white-transparent.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-[120px] -right-[330px] w-[700px] max-w-none select-none opacity-10 md:hidden"
        />

        <div className="relative z-10">
          <BrandLogo iconClassName="h-10 w-10" wordmarkClassName="text-xl text-white [&>span]:text-white" />
          <p className="mt-3 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-white/80">
            <span>By</span>
            <img src="/brand/gooseroot-logo-white.svg" alt="Gooseroot" className="h-5 w-auto" />
          </p>
        </div>

        <div className="relative z-10 mt-12 max-w-[520px] md:mt-auto">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/80">{overline}</p>
          <h1
            id="workspace-heading"
            className="mb-4 mt-4 text-[32px] font-bold leading-[1.06] tracking-[-0.035em] sm:text-[40px] lg:text-[52px]"
          >
            {headline}
          </h1>
          <ul className="mt-6 hidden space-y-3.5 text-[15px] leading-6 text-white/90 md:block">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15">
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                {benefit}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 mt-12 hidden text-[13px] text-white/80 md:block">
          © {new Date().getFullYear()} TruERP · Built by Gooseroot Technologies
        </p>
      </section>

      <section
        className="flex items-start justify-center px-4 pb-12 pt-8 sm:px-6 md:items-center md:p-12"
        aria-labelledby="login-heading"
      >
        <div className="relative z-10 w-full max-w-[440px] rounded-2xl border border-border bg-card p-6 shadow-gr-sm sm:p-10">
          {children}
        </div>
      </section>

      {/* Split layout: one Lens watermark straddling the divide. The same official symbol is drawn
          twice at identical geometry: white at 10% clipped to the red panel, and the brand-gradient
          version at 6% clipped to the page side, so the shape reads as continuous across both. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1] hidden [clip-path:inset(0_50%_0_0)] md:block">
        <img src="/brand/gooseroot-symbol-white-transparent.svg" alt="" className="auth-mark opacity-10" />
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1] hidden [clip-path:inset(0_0_0_50%)] md:block">
        <img src="/brand/gooseroot-symbol-gradient-transparent.svg" alt="" className="auth-mark opacity-[0.06] dark:opacity-[0.12]" />
      </div>

      <style jsx>{`
        /*
          Sign-in screens always wear the Gooseroot brand palette. The user's Appearance accent
          (lib/colorThemes.ts) is written inline on <html>; redeclaring the Crimson ramp here
          shadows it for this subtree. Derived tokens are redeclared too, because a var() on
          :root resolves there and would otherwise inherit the accent's computed value.
        */
        main.auth-page {
          --theme-50: 352 79% 96%;
          --theme-100: 352 79% 93%;
          --theme-200: 352 79% 85%;
          --theme-300: 353 80% 75%;
          --theme-400: 355 81% 62%;
          --theme-500: 3 92% 49%;
          --theme-600: 353 97% 42%;
          --theme-700: 345 100% 36%;
          --theme-800: 344 100% 28%;
          --theme-900: 348 100% 18%;
          --theme-950: 347 100% 15%;
          --primary: var(--theme-600);
          --primary-foreground: 0 0% 100%;
          --ring: var(--theme-600);
          --heading: var(--theme-950);
          --secondary-foreground: var(--theme-950);
          --accent: var(--theme-50);
          --accent-foreground: var(--theme-700);
          --grad-start: var(--theme-500);
          --grad-mid: var(--theme-600);
          --grad-end: var(--theme-700);
          --btn-start: var(--theme-600);
          --btn-end: var(--theme-700);
          --shadow-sm: 0 1px 2px hsl(var(--theme-900) / 0.05), 0 8px 24px hsl(var(--theme-900) / 0.06);
          --shadow-accent: 0 12px 28px hsl(var(--theme-600) / 0.28);
        }
        :global(html.dark) main.auth-page {
          --heading: 0 0% 100%;
          --secondary-foreground: 0 0% 100%;
          --accent: 345 8% 15%;
          --accent-foreground: var(--theme-300);
          --shadow-sm: 0 1px 2px rgb(0 0 0 / 0.3), 0 8px 24px rgb(0 0 0 / 0.25);
          --shadow-accent: 0 12px 28px hsl(var(--theme-500) / 0.25);
        }
        main.auth-page :global(.auth-mark) {
          position: absolute;
          width: 1100px;
          max-width: none;
          left: calc(50% - 580px);
          bottom: -140px;
          user-select: none;
        }
        @media (max-width: 1023px) {
          main.auth-page :global(.auth-mark) {
            width: 800px;
            left: calc(50% - 420px);
            bottom: -120px;
          }
        }
        main.auth-page :global(a:focus-visible),
        main.auth-page :global(button:focus-visible) {
          outline: 2px solid hsl(var(--primary)) !important;
          outline-offset: 3px;
        }
        @media (prefers-reduced-motion: reduce) {
          main.auth-page :global(*) {
            transition: none !important;
          }
        }
      `}</style>
    </main>
  )
}
