'use client'

import { useState } from 'react'
import Link from 'next/link'
import AuthSplitLayout from '@/components/auth/AuthSplitLayout'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
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
    <AuthSplitLayout
      headline={<>Your business.<br />Your workspace.</>}
      benefits={['Bill with confidence', 'Keep your inventory in sync', 'See your business clearly']}
    >
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
    </AuthSplitLayout>
  )
}
