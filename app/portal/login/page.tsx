'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { IndianRupee, Loader2 } from 'lucide-react'
import { fetchPortalPublic, portalLogin } from '@/lib/portalApi'
import { notifyError } from '@/lib/notify'

export default function PortalLoginPage() {
  const searchParams = useSearchParams()
  const [slug, setSlug] = useState(searchParams.get('slug') || '')
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [infoLoading, setInfoLoading] = useState(false)
  const [businessName, setBusinessName] = useState('')
  const [welcomeMessage, setWelcomeMessage] = useState('')

  useEffect(() => {
    if (!slug.trim()) return
    setInfoLoading(true)
    fetchPortalPublic(slug.trim())
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json()
          setBusinessName(data.business_name || '')
          setWelcomeMessage(data.welcome_message || '')
        }
      })
      .finally(() => setInfoLoading(false))
  }, [slug])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!slug.trim() || !phone.trim() || !pin.trim()) {
      notifyError('Enter portal URL, phone, and PIN')
      return
    }
    setLoading(true)
    try {
      await portalLogin(slug.trim(), phone.trim(), pin.trim())
      window.location.href = '/portal'
    } catch (err: unknown) {
      notifyError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white">
              <IndianRupee className="h-7 w-7" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Customer Portal</CardTitle>
          <CardDescription>
            {infoLoading ? 'Loading…' : businessName ? `Sign in to ${businessName}` : 'Access your invoices and account'}
          </CardDescription>
          {welcomeMessage && (
            <p className="text-sm text-muted-foreground pt-2">{welcomeMessage}</p>
          )}
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="slug">Portal URL</Label>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <span>/portal/</span>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="your-business"
                  className="flex-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Registered mobile number</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit mobile"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pin">Portal PIN</Label>
              <Input
                id="pin"
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="PIN from your supplier"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in'}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Business user?{' '}
              <Link href="/login" className="text-blue-600 hover:underline">
                TruERP login
              </Link>
            </p>
          </CardContent>
        </form>
      </Card>
    </div>
  )
}
