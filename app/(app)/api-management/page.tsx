'use client'

import { useEffect, useState } from 'react'
import { AppWindow, Gauge, KeyRound, ScrollText, ShieldCheck, Webhook } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import PageHeader from '@/components/layout/PageHeader'
import { FormPageSkeleton } from '@/components/layout/PageSkeleton'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { isSuperAdmin } from '@/lib/roles'
import { notifyError } from '@/lib/notify'
import { fetchCatalog, fetchStores, type IntegrationCatalog, type StoreOption } from '@/lib/apiManagement'
import OverviewTab from '@/components/api-management/OverviewTab'
import ApiKeysTab from '@/components/api-management/ApiKeysTab'
import PermissionsTab from '@/components/api-management/PermissionsTab'
import OAuthAppsTab from '@/components/api-management/OAuthAppsTab'
import WebhooksTab from '@/components/api-management/WebhooksTab'
import LogsTab from '@/components/api-management/LogsTab'

const TABS = ['overview', 'keys', 'permissions', 'oauth', 'webhooks', 'logs'] as const
type Tab = (typeof TABS)[number]

export default function ApiManagementPage() {
  const { user, loading: authLoading } = useAuth()
  const allowed = isSuperAdmin(user?.role)
  const [catalog, setCatalog] = useState<IntegrationCatalog | null>(null)
  const [stores, setStores] = useState<StoreOption[]>([])
  const [tab, setTab] = useState<Tab>('overview')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const fromHash = window.location.hash.replace('#', '') as Tab
    if (TABS.includes(fromHash)) setTab(fromHash)
  }, [])

  useEffect(() => {
    if (authLoading || !allowed) return
    Promise.all([fetchCatalog(), fetchStores()])
      .then(([c, s]) => {
        setCatalog(c)
        setStores(s.filter((st) => st.is_active !== false))
      })
      .catch((e) => notifyError(e instanceof Error ? e.message : 'Failed to load API management'))
  }, [authLoading, allowed])

  const changeTab = (v: string) => {
    setTab(v as Tab)
    if (typeof window !== 'undefined') window.history.replaceState(null, '', `#${v}`)
  }

  if (authLoading || (allowed && !catalog)) {
    return (
      <DashboardLayout>
        <FormPageSkeleton />
      </DashboardLayout>
    )
  }

  if (!allowed) {
    return (
      <DashboardLayout>
        <Card>
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
            <CardDescription>Only super admins can manage API access and integrations.</CardDescription>
          </CardHeader>
        </Card>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <PageHeader
          title="API Management"
          description="Control how external platforms connect to TruERP: API keys, OAuth apps, per-store permissions, webhooks and usage."
        />
        <Tabs value={tab} onValueChange={changeTab}>
          <TabsList>
            <TabsTrigger value="overview"><Gauge /> Overview</TabsTrigger>
            <TabsTrigger value="keys"><KeyRound /> API Keys</TabsTrigger>
            <TabsTrigger value="permissions"><ShieldCheck /> Permissions</TabsTrigger>
            <TabsTrigger value="oauth"><AppWindow /> OAuth Apps</TabsTrigger>
            <TabsTrigger value="webhooks"><Webhook /> Webhooks</TabsTrigger>
            <TabsTrigger value="logs"><ScrollText /> Request Logs</TabsTrigger>
          </TabsList>
          <div className="mt-4">
            <TabsContent value="overview"><OverviewTab /></TabsContent>
            <TabsContent value="keys"><ApiKeysTab catalog={catalog!.scopes} stores={stores} /></TabsContent>
            <TabsContent value="permissions"><PermissionsTab catalog={catalog!.scopes} /></TabsContent>
            <TabsContent value="oauth"><OAuthAppsTab catalog={catalog!.scopes} stores={stores} grantTypes={catalog!.grant_types} /></TabsContent>
            <TabsContent value="webhooks"><WebhooksTab stores={stores} eventTypes={catalog!.event_types} /></TabsContent>
            <TabsContent value="logs"><LogsTab stores={stores} /></TabsContent>
          </div>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
