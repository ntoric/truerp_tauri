'use client'

import { useState } from 'react'
import Link from 'next/link'
import AuthSplitLayout from '@/components/auth/AuthSplitLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react'
import { FieldError } from '@/components/ui/field-error'
import { useFormErrors } from '@/hooks/useFormErrors'
import { API_BASE, cn } from '@/lib/utils'
import {
  firstValidationMessage,
  validateForgotPasswordForm,
  validateResetOTPForm,
  validateResetPasswordForm,
} from '@/lib/authValidation'

type Step = 'email' | 'otp' | 'password' | 'done'

export default function ForgotPasswordPage() {
  const {
    fieldErrors,
    setFieldErrors,
    clearFieldError,
    showErrorToast,
  } = useFormErrors()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const errors = validateForgotPasswordForm({ email })
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      showErrorToast(firstValidationMessage(errors) || 'Please fix the highlighted fields')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Request failed')
      setFieldErrors({})
      setStep('otp')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      setError(message)
      showErrorToast(message)
    } finally {
      setLoading(false)
    }
  }

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const errors = validateResetOTPForm({ otp })
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      showErrorToast(firstValidationMessage(errors) || 'Please fix the highlighted fields')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/verify-reset-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp: otp.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || data.fields?.otp || 'Verification failed')
      setFieldErrors({})
      setStep('password')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      setError(message)
      showErrorToast(message)
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const errors = validateResetPasswordForm({ password, confirmPassword })
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      showErrorToast(firstValidationMessage(errors) || 'Please fix the highlighted fields')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          otp: otp.trim(),
          new_password: password,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Reset failed')
      setStep('done')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      setError(message)
      showErrorToast(message)
    } finally {
      setLoading(false)
    }
  }

  const stepDescription = {
    email: 'Enter your email and we will send you a 6-digit verification code',
    otp: `Enter the 6-digit code sent to ${email}`,
    password: 'Choose a new password for your account',
    done: 'Your password has been reset successfully',
  }[step]

  const stepTitle = {
    email: 'Forgot password?',
    otp: 'Check your email',
    password: 'Set a new password',
    done: 'Password updated',
  }[step]

  const stepNumber = step === 'done' ? 0 : { email: 1, otp: 2, password: 3 }[step]

  return (
    <AuthSplitLayout
      headline={<>Locked out?<br />We’ll get you back in.</>}
      benefits={['Verify with a 6-digit code', 'Choose a new password', 'Get back to your business']}
    >
      {step !== 'done' && (
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#c81e3a]">Step {stepNumber} of 3</p>
      )}
      <h2 id="login-heading" className="mt-2 text-[28px] font-semibold leading-tight tracking-tight">{stepTitle}</h2>
      <p className="mb-8 mt-2 text-sm leading-6 text-[#5b5c6b]">{stepDescription}</p>

      {step === 'done' ? (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center text-sm text-emerald-800">
            <CheckCircle2 className="h-8 w-8" />
            <p>Your password has been updated. You can now log in with your new password.</p>
          </div>
          <Button asChild className="w-full">
            <Link href="/login">Go to login</Link>
          </Button>
        </div>
      ) : step === 'email' ? (
        <form onSubmit={handleEmailSubmit} className="space-y-5" aria-busy={loading}>
          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-800">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs font-semibold text-[#5b5c6b]">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              disabled={loading}
              onChange={(e) => {
                clearFieldError('email')
                setEmail(e.target.value)
              }}
              className={cn('border-[#e4e6ef] bg-white', fieldErrors.email && 'border-red-500')}
              required
            />
            <FieldError message={fieldErrors.email} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Send verification code
          </Button>
          <p className="text-sm text-muted-foreground">
            Remember your password?{' '}
            <Link href="/login" className="text-[#c81e3a] underline-offset-4 hover:underline">
              Login
            </Link>
          </p>
        </form>
      ) : step === 'otp' ? (
        <form onSubmit={handleOtpSubmit} className="space-y-5" aria-busy={loading}>
          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-800">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="otp" className="text-xs font-semibold text-[#5b5c6b]">Verification code</Label>
            <Input
              id="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              maxLength={6}
              value={otp}
              disabled={loading}
              onChange={(e) => {
                clearFieldError('otp')
                setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
              }}
              className={cn('border-[#e4e6ef] bg-white', fieldErrors.otp && 'border-red-500', 'tracking-widest text-center text-lg')}
              required
            />
            <FieldError message={fieldErrors.otp} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Verify code
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={loading}
            onClick={() => {
              setError('')
              setOtp('')
              setFieldErrors({})
              setStep('email')
            }}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Use a different email
          </Button>
        </form>
      ) : (
        <form onSubmit={handlePasswordSubmit} className="space-y-5" aria-busy={loading}>
          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-800">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-xs font-semibold text-[#5b5c6b]">New password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              disabled={loading}
              onChange={(e) => {
                clearFieldError('password')
                setPassword(e.target.value)
              }}
              className={cn('border-[#e4e6ef] bg-white', fieldErrors.password && 'border-red-500')}
              required
              minLength={6}
            />
            <FieldError message={fieldErrors.password} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-xs font-semibold text-[#5b5c6b]">Confirm new password</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              disabled={loading}
              onChange={(e) => {
                clearFieldError('confirmPassword')
                setConfirmPassword(e.target.value)
              }}
              className={cn('border-[#e4e6ef] bg-white', fieldErrors.confirmPassword && 'border-red-500')}
              required
              minLength={6}
            />
            <FieldError message={fieldErrors.confirmPassword} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Reset password
          </Button>
          <p className="text-sm text-muted-foreground">
            <Link href="/login" className="text-[#c81e3a] underline-offset-4 hover:underline">
              Back to login
            </Link>
          </p>
        </form>
      )}
    </AuthSplitLayout>
  )
}
