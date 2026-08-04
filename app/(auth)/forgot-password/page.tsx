'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, CheckCircle2, IndianRupee, Loader2 } from 'lucide-react'
import { FieldError } from '@/components/ui/field-error'
import { useFormErrors } from '@/hooks/useFormErrors'
import { API_BASE, cn } from '@/lib/utils'
import {
  firstValidationMessage,
  validateForgotPasswordForm,
} from '@/lib/authValidation'

export default function ForgotPasswordPage() {
  const {
    fieldErrors,
    setFieldErrors,
    clearFieldError,
    showErrorToast,
  } = useFormErrors()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
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
      setSubmitted(true)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      setError(message)
      showErrorToast(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white">
              <IndianRupee className="h-7 w-7" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Forgot password</CardTitle>
          <CardDescription>
            {submitted
              ? 'Check your email for a reset link'
              : 'Enter your email and we will send you a reset link'}
          </CardDescription>
        </CardHeader>

        {submitted ? (
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center gap-3 rounded-lg bg-green-50 p-4 text-center text-sm text-green-700">
              <CheckCircle2 className="h-8 w-8" />
              <p>
                A password reset link has been sent to <strong>{email}</strong>.
              </p>
            </div>
            <Button asChild variant="outline" className="w-full">
              <Link href="/login">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to login
              </Link>
            </Button>
          </CardContent>
        ) : (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    clearFieldError('email')
                    setEmail(e.target.value)
                  }}
                  className={cn(fieldErrors.email && 'border-red-500')}
                  required
                />
                <FieldError message={fieldErrors.email} />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Send reset link
              </Button>
              <p className="text-sm text-muted-foreground">
                Remember your password?{' '}
                <Link href="/login" className="text-blue-600 hover:underline">
                  Login
                </Link>
              </p>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  )
}
