'use client'

import { useState } from 'react'
import Link from 'next/link'
import BrandLogo from '@/components/BrandLogo'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react'
import { FieldError } from '@/components/ui/field-error'
import { useFormErrors } from '@/hooks/useFormErrors'
import { cn } from '@/lib/utils'
import {
  firstValidationMessage,
  validateLoginForm,
} from '@/lib/authValidation'

export default function LoginPage() {
  const { login } = useAuth()
  const {
    fieldErrors,
    setFieldErrors,
    clearFieldError,
    showErrorToast,
  } = useFormErrors()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [totpCode, setTotpCode] = useState('')
  const [needs2fa, setNeeds2fa] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const errors = validateLoginForm({ email, password, totpCode, needs2fa })
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      showErrorToast(firstValidationMessage(errors) || 'Please fix the highlighted fields')
      return
    }
    setLoading(true)
    try {
      const result = await login(email.trim(), password, needs2fa ? totpCode.trim() : undefined)
      if (result.requiresPasswordChange) {
        window.location.href = '/change-password-required'
        return
      }
      const params = new URLSearchParams(window.location.search)
      const next = params.get('next')
      const dest = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'
      window.location.href = dest
    } catch (err: any) {
      if (err.requires2fa) {
        setNeeds2fa(true)
        setError('Enter the 6-digit code from your authenticator app')
      } else {
        setError(err.message)
        showErrorToast(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page grid min-h-screen min-h-[100dvh] bg-white text-[#20212b] md:grid-cols-2">
      <section className="flex flex-col justify-between gap-12 bg-[linear-gradient(150deg,#dc2626_0%,#991b1b_55%,#450a0a_100%)] px-7 py-8 text-white md:min-h-[100dvh] md:p-10 lg:p-14" aria-labelledby="workspace-heading">
        <div>
          <BrandLogo iconClassName="h-10 w-10" wordmarkClassName="text-xl text-white [&>span]:text-white" />
          <p className="mt-3 text-xs font-medium tracking-[0.12em] text-rose-100">BY RUNERAIL</p>
        </div>
        <div className="max-w-lg md:pb-3">
          <h1 id="workspace-heading" className="text-[2rem] font-semibold leading-[1.12] tracking-tight sm:text-[2.5rem] lg:text-5xl">
            Your business.<br />Your workspace.
          </h1>
          <ul className="mt-8 hidden space-y-4 text-[15px] text-rose-100 md:block">
            {['Bill with confidence', 'Keep your inventory in sync', 'See your business clearly'].map((benefit) => (
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
          <h2 id="login-heading" className="text-[28px] font-semibold leading-tight tracking-tight">Welcome back</h2>
          <p className="mb-8 mt-2 text-sm leading-6 text-[#5b5c6b]">Sign in to manage your business with TruERP.</p>
          <form onSubmit={handleSubmit} className="space-y-5" aria-busy={loading}>
            {error && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-800">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-semibold text-[#5b5c6b]">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                placeholder="you@company.com"
                value={email}
                disabled={loading}
                aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                onChange={(e) => {
                  clearFieldError('email')
                  setEmail(e.target.value)
                }}
                className={cn('h-12 rounded-lg border-[#e4e6ef] bg-white px-3.5 text-base text-[#20212b] placeholder:text-[#92939e] md:text-sm', fieldErrors.email && 'border-red-500')}
                required
              />
              <div id="email-error"><FieldError message={fieldErrors.email} /></div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="password" className="text-xs font-semibold text-[#5b5c6b]">Password</Label>
                <Link href="/forgot-password" className="rounded-sm text-xs font-medium text-[#c81e3a] underline-offset-4 hover:underline">Forgot password?</Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  disabled={loading}
                  aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                  onChange={(e) => {
                    clearFieldError('password')
                    setPassword(e.target.value)
                  }}
                  className={cn('h-12 rounded-lg border-[#e4e6ef] bg-white pl-3.5 pr-12 text-base text-[#20212b] placeholder:text-[#92939e] md:text-sm', fieldErrors.password && 'border-red-500')}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-controls="password"
                  disabled={loading}
                  className="absolute inset-y-1 right-1 flex w-10 items-center justify-center rounded-md text-[#737480] transition-colors hover:bg-neutral-100 hover:text-[#20212b] disabled:opacity-50"
                >
                  {showPassword ? <EyeOff className="h-[18px] w-[18px]" aria-hidden="true" /> : <Eye className="h-[18px] w-[18px]" aria-hidden="true" />}
                </button>
              </div>
              <div id="password-error"><FieldError message={fieldErrors.password} /></div>
            </div>
            {needs2fa && (
              <div className="space-y-2">
                <Label htmlFor="totp" className="text-xs font-semibold text-[#5b5c6b]">Authenticator code</Label>
                <Input
                  id="totp"
                  name="totp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  placeholder="123456"
                  value={totpCode}
                  disabled={loading}
                  aria-describedby={fieldErrors.totpCode ? 'totp-error' : 'totp-help'}
                  onChange={(e) => {
                    clearFieldError('totpCode')
                    setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }}
                  className={cn('h-12 rounded-lg border-[#e4e6ef] bg-white px-3.5 text-base tracking-[0.25em] text-[#20212b] placeholder:text-[#92939e]', fieldErrors.totpCode && 'border-red-500')}
                  maxLength={6}
                  required
                />
                <p id="totp-help" className="text-xs leading-5 text-[#5b5c6b]">Enter the 6-digit code from your authenticator app.</p>
                <div id="totp-error"><FieldError message={fieldErrors.totpCode} /></div>
              </div>
            )}
            <Button type="submit" className="h-12 w-full gap-2 rounded-lg bg-[#c81e3a] text-sm font-semibold text-white hover:bg-[#aa1931]" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {loading ? 'Signing in…' : needs2fa ? 'Verify and sign in' : 'Sign in'}
            </Button>
          </form>
          <a href="https://www.runerail.com/" target="_blank" rel="noopener noreferrer" className="mt-7 inline-flex items-center gap-2 rounded-sm text-[13px] text-[#5b5c6b] transition-colors hover:text-[#c81e3a]">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to RuneRail<span className="sr-only"> (opens in a new tab)</span>
          </a>
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
