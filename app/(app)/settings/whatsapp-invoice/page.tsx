"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { FormPageSkeleton } from "@/components/layout/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  History,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
  Save,
  Send,
  Settings2,
  Trash2,
} from "lucide-react";
import { notifyError, notifySuccess } from "@/lib/notify";
import { formatDateTime } from "@/lib/utils";
import {
  DEFAULT_NO_LOYALTY_TEMPLATE_PREVIEW,
  DEFAULT_TEMPLATE_PREVIEW,
  buildTemplatePreview,
  sampleFieldValue,
  WHATSAPP_PROVIDER_COPY,
  fetchWhatsAppInvoiceLogs,
  fetchWhatsAppInvoiceSettings,
  saveWhatsAppInvoiceSettings,
  sendWhatsAppInvoiceTest,
  type WhatsAppInvoiceLog,
  type WhatsAppInvoiceSettings,
  type WhatsAppProvider,
} from "@/lib/whatsappInvoice";

const STATUS_CLASS: Record<string, string> = {
  sent: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  skipped: "bg-gray-100 text-gray-700",
};

export default function WhatsAppInvoiceSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<WhatsAppInvoiceSettings | null>(
    null,
  );
  // Provider as last saved; a switch needs a fresh secret for the new gateway.
  const [savedProvider, setSavedProvider] =
    useState<WhatsAppProvider>("whatsapp_cloud");
  const [apiKey, setApiKey] = useState("");
  // Write-only like the access token; blank keeps the saved value.
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [showPhoneId, setShowPhoneId] = useState(false);
  const [accountSid, setAccountSid] = useState("");
  const [mapping, setMapping] = useState<string[]>([]);
  const [templateBody, setTemplateBody] = useState(DEFAULT_TEMPLATE_PREVIEW);
  // Template sent while the loyalty program is off.
  const [nlMapping, setNlMapping] = useState<string[]>([]);
  const [nlBody, setNlBody] = useState(DEFAULT_NO_LOYALTY_TEMPLATE_PREVIEW);
  // Which template the variables + preview cards are editing.
  const [variant, setVariant] = useState<"main" | "no_loyalty">("main");
  const [testPhone, setTestPhone] = useState("");
  const [testing, setTesting] = useState(false);
  const [logs, setLogs] = useState<WhatsAppInvoiceLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [tab, setTab] = useState<"settings" | "messages">("settings");

  const applySettings = (s: WhatsAppInvoiceSettings) => {
    setSettings(s);
    setSavedProvider(s.provider || "whatsapp_cloud");
    setMapping(
      (s.variable_mapping || s.default_mapping || "")
        .split(",")
        .filter(Boolean),
    );
    setTemplateBody(
      s.template_body?.trim() ? s.template_body : DEFAULT_TEMPLATE_PREVIEW,
    );
    setNlMapping(
      (s.no_loyalty_variable_mapping || s.default_no_loyalty_mapping || "")
        .split(",")
        .filter(Boolean),
    );
    setNlBody(
      s.no_loyalty_template_body?.trim()
        ? s.no_loyalty_template_body
        : DEFAULT_NO_LOYALTY_TEMPLATE_PREVIEW,
    );
    setApiKey("");
    setPhoneNumberId("");
    setShowPhoneId(false);
    setAccountSid(s.account_sid || "");
  };

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      setLogs(await fetchWhatsAppInvoiceLogs(50));
    } catch {
      // non-fatal
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWhatsAppInvoiceSettings()
      .then(applySettings)
      .catch((e) =>
        notifyError(e instanceof Error ? e.message : "Failed to load settings"),
      )
      .finally(() => setLoading(false));
    void loadLogs();
  }, [loadLogs]);

  const fields = settings?.available_fields ?? [];
  const fieldLabel = (key: string) =>
    fields.find((f) => f.key === key)?.label ?? key;

  const isNoLoyalty = variant === "no_loyalty";
  const curMapping = isNoLoyalty ? nlMapping : mapping;
  const setCurMapping = isNoLoyalty ? setNlMapping : setMapping;
  const curBody = isNoLoyalty ? nlBody : templateBody;
  const setCurBody = isNoLoyalty ? setNlBody : setTemplateBody;
  const curDefaultBody = isNoLoyalty
    ? DEFAULT_NO_LOYALTY_TEMPLATE_PREVIEW
    : DEFAULT_TEMPLATE_PREVIEW;

  const preview = useMemo(
    () =>
      buildTemplatePreview(curBody, curMapping, settings?.store_display_name),
    [curBody, curMapping, settings?.store_display_name],
  );
  // {{n}} in the text with no mapped value, and mapped values the text never uses.
  // WhatsApp rejects a send when the parameter count differs from the template.
  const unmappedVars = preview.used.filter((n) => n > curMapping.length);
  // PDF-file variables live in a Twilio media URL, not the body text.
  const unusedVars = curMapping
    .map((_, i) => i + 1)
    .filter(
      (n) =>
        !preview.used.includes(n) && curMapping[n - 1] !== "invoice_pdf_file",
    );

  if (loading || !settings) {
    return (
      <DashboardLayout>
        <FormPageSkeleton />
      </DashboardLayout>
    );
  }

  const provider: WhatsAppProvider =
    settings.provider === "fast2sms" || settings.provider === "twilio"
      ? settings.provider
      : "whatsapp_cloud";
  const isTwilio = provider === "twilio";
  const copy = WHATSAPP_PROVIDER_COPY[provider];
  const providerSwitched = provider !== savedProvider;
  const providerOptions = settings.providers?.length
    ? settings.providers
    : (Object.keys(WHATSAPP_PROVIDER_COPY) as WhatsAppProvider[]).map(
        (key) => ({
          key,
          label: WHATSAPP_PROVIDER_COPY[key].label,
        }),
      );

  const update = <K extends keyof WhatsAppInvoiceSettings>(
    key: K,
    value: WhatsAppInvoiceSettings[K],
  ) => setSettings((s) => (s ? { ...s, [key]: value } : s));

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await saveWhatsAppInvoiceSettings({
        enabled: settings.enabled,
        provider: settings.provider,
        message_id: settings.message_id,
        phone_number_id: phoneNumberId.trim(),
        account_sid: accountSid.trim(),
        language_code: settings.language_code,
        variable_mapping: mapping.join(","),
        store_display_name: settings.store_display_name,
        template_body:
          templateBody.trim() === DEFAULT_TEMPLATE_PREVIEW.trim()
            ? ""
            : templateBody,
        no_loyalty_message_id: settings.no_loyalty_message_id ?? "",
        no_loyalty_variable_mapping: nlMapping.join(","),
        no_loyalty_template_body:
          nlBody.trim() === DEFAULT_NO_LOYALTY_TEMPLATE_PREVIEW.trim()
            ? ""
            : nlBody,
        attach_pdf: settings.attach_pdf,
        public_base_url: settings.public_base_url,
        country_code: settings.country_code,
        send_for_pos: settings.send_for_pos,
        send_for_non_pos: settings.send_for_non_pos,
        pdf_link_ttl_minutes: settings.pdf_link_ttl_minutes,
        api_key: apiKey.trim() || undefined,
      });
      applySettings(saved);
      notifySuccess("WhatsApp invoice settings saved");
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testPhone.trim()) {
      notifyError("Enter a WhatsApp number to send the test to");
      return;
    }
    setTesting(true);
    try {
      await sendWhatsAppInvoiceTest(testPhone.trim());
      notifySuccess("Test message sent using your latest invoice");
    } catch (e) {
      notifyError(
        e instanceof Error ? e.message : "Failed to send test message",
      );
    } finally {
      setTesting(false);
      void loadLogs();
    }
  };

  const templateSwitch = (
    <Tabs value={variant} onValueChange={(v) => setVariant(v as typeof variant)}>
      <TabsList aria-label="Template to edit" className="min-h-0">
        <TabsTrigger value="main" className="px-3 py-1.5 text-xs">
          Main
        </TabsTrigger>
        <TabsTrigger value="no_loyalty" className="px-3 py-1.5 text-xs">
          Without loyalty
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );

  return (
    <DashboardLayout>
      <div className="w-full space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/settings?tab=invoice">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
            </Link>
            <div>
              <h1 className="flex items-center gap-2 text-xl font-semibold">
                <MessageCircle className="h-5 w-5 text-green-600" /> WhatsApp
                Invoice
              </h1>
              <p className="text-sm text-muted-foreground">
                Send a purchase summary with the invoice PDF to the
                customer&apos;s WhatsApp via the WhatsApp Cloud API (Meta),
                Fast2SMS or Twilio. These settings apply to the current store
                only.
              </p>
            </div>
          </div>
          {tab === "settings" && (
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save
            </Button>
          )}
        </div>

        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v as "settings" | "messages");
            if (v === "messages") void loadLogs();
          }}
          className="space-y-6"
        >
          <TabsList>
            <TabsTrigger value="settings" className="gap-1.5">
              <Settings2 className="h-4 w-4" /> Settings
            </TabsTrigger>
            <TabsTrigger value="messages" className="gap-1.5">
              <History className="h-4 w-4" /> Recent messages
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="mt-0 space-y-6">
            <Card>
              <CardContent className="flex items-center justify-between gap-4 pt-6">
                <div>
                  <p className="font-medium">
                    Send WhatsApp message on every sale
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Sent automatically in the background after an invoice is
                    saved. Customers without a valid mobile number are skipped.
                  </p>
                </div>
                <Switch
                  checked={settings.enabled}
                  onCheckedChange={(v) => update("enabled", v)}
                />
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-5">
              <div className="space-y-6 lg:col-span-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      WhatsApp connection
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="wa-provider">Provider</Label>
                      <Select
                        value={provider}
                        onValueChange={(v) =>
                          update("provider", v as WhatsAppProvider)
                        }
                      >
                        <SelectTrigger id="wa-provider">
                          <SelectValue>{copy.label}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {providerOptions.map((p) => (
                            <SelectItem key={p.key} value={p.key}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Use the account you already have. Each sends your
                        approved WhatsApp template.
                      </p>
                    </div>
                    {isTwilio && (
                      <div className="space-y-1.5">
                        <Label htmlFor="wa-account-sid">Account SID</Label>
                        <Input
                          id="wa-account-sid"
                          autoComplete="off"
                          value={accountSid}
                          onChange={(e) => setAccountSid(e.target.value)}
                          placeholder="AC…"
                        />
                        <p className="text-xs text-muted-foreground">
                          Twilio Console → Account Info → Account SID.
                        </p>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label htmlFor="wa-api-key">{copy.secretLabel}</Label>
                      <Input
                        id="wa-api-key"
                        type="password"
                        autoComplete="off"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={
                          settings.has_api_key && !providerSwitched
                            ? `Saved (${settings.api_key_hint || "••••"}), leave blank to keep`
                            : copy.secretPlaceholder
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        {copy.secretHint}
                      </p>
                      {providerSwitched && settings.has_api_key && (
                        <p className="text-xs text-amber-700">
                          Switching provider removes the saved key for the
                          previous provider. Enter the {copy.secretLabel} before
                          saving.
                        </p>
                      )}
                    </div>
                    <div
                      className={`grid gap-4 ${copy.usesLanguage ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
                    >
                      <div className="space-y-1.5">
                        <Label htmlFor="wa-message-id">
                          {copy.templateLabel}
                        </Label>
                        <Input
                          id="wa-message-id"
                          value={settings.message_id}
                          onChange={(e) => update("message_id", e.target.value)}
                          placeholder={copy.templatePlaceholder}
                        />
                        <p className="text-xs text-muted-foreground">
                          {copy.templateHint}
                        </p>
                      </div>
                      {copy.usesLanguage && (
                        <div className="space-y-1.5">
                          <Label htmlFor="wa-language">Template language</Label>
                          <Input
                            id="wa-language"
                            value={settings.language_code}
                            onChange={(e) =>
                              update("language_code", e.target.value)
                            }
                            placeholder="en"
                          />
                          <p className="text-xs text-muted-foreground">
                            e.g. en, en_US or hi.
                          </p>
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <Label htmlFor="wa-phone-id">{copy.phoneIdLabel}</Label>
                        <div className="relative">
                          <Input
                            id="wa-phone-id"
                            type={showPhoneId ? "text" : "password"}
                            autoComplete="off"
                            className={
                              settings.can_view_phone_number_id &&
                              settings.has_phone_number_id
                                ? "pr-9"
                                : undefined
                            }
                            value={phoneNumberId}
                            onChange={(e) => setPhoneNumberId(e.target.value)}
                            placeholder={
                              settings.has_phone_number_id
                                ? showPhoneId && settings.phone_number_id
                                  ? `Saved (${settings.phone_number_id}), leave blank to keep`
                                  : `Saved (${settings.phone_number_id_hint || "••••"}), leave blank to keep`
                                : copy.phoneIdPlaceholder
                            }
                          />
                          {settings.can_view_phone_number_id &&
                            settings.has_phone_number_id && (
                              <button
                                type="button"
                                onClick={() => setShowPhoneId((v) => !v)}
                                className="absolute inset-y-0 right-0 flex items-center px-2.5 text-muted-foreground hover:text-foreground"
                                aria-label={
                                  showPhoneId
                                    ? `Hide ${copy.phoneIdLabel}`
                                    : `View ${copy.phoneIdLabel}`
                                }
                                title={
                                  showPhoneId ? "Hide" : "View (super admin)"
                                }
                              >
                                {showPhoneId ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </button>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {copy.phoneIdHint}
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="wa-cc">Default country code</Label>
                        <Input
                          id="wa-cc"
                          value={settings.country_code}
                          onChange={(e) =>
                            update("country_code", e.target.value)
                          }
                          placeholder="91"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="wa-store-name">
                          Store name in message
                        </Label>
                        <Input
                          id="wa-store-name"
                          value={settings.store_display_name}
                          onChange={(e) =>
                            update("store_display_name", e.target.value)
                          }
                          placeholder="Defaults to the store / business name"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Invoice PDF attachment
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">
                          Attach invoice PDF
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {copy.pdfHint}
                        </p>
                      </div>
                      <Switch
                        checked={settings.attach_pdf}
                        onCheckedChange={(v) => update("attach_pdf", v)}
                      />
                    </div>
                    {settings.attach_pdf && (
                      <div className="space-y-1.5">
                        <Label htmlFor="wa-base-url">Public API URL</Label>
                        <Input
                          id="wa-base-url"
                          value={settings.public_base_url}
                          onChange={(e) =>
                            update("public_base_url", e.target.value)
                          }
                          placeholder={
                            settings.env_public_base_url ||
                            "https://api.yourdomain.com"
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          Internet-reachable address of this backend. WhatsApp
                          downloads the PDF from a signed link; the PDF is never
                          stored on the server.
                          {settings.env_public_base_url &&
                            ` Leave blank to use ${settings.env_public_base_url}.`}
                        </p>
                      </div>
                    )}
                    {settings.attach_pdf && (
                      <div className="space-y-1.5">
                        <Label htmlFor="wa-link-ttl">
                          PDF link expiry (minutes)
                        </Label>
                        <Input
                          id="wa-link-ttl"
                          type="number"
                          min={settings.min_link_ttl_minutes ?? 5}
                          max={settings.max_link_ttl_minutes ?? 10080}
                          value={settings.pdf_link_ttl_minutes}
                          disabled={!settings.can_edit_link_ttl}
                          onChange={(e) =>
                            update(
                              "pdf_link_ttl_minutes",
                              Number(e.target.value) || 0,
                            )
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          {settings.can_edit_link_ttl
                            ? `How long WhatsApp can download the PDF after sending (${settings.min_link_ttl_minutes ?? 5} min to ${Math.round((settings.max_link_ttl_minutes ?? 10080) / 1440)} days). Raise it if attachments fail on delayed deliveries.`
                            : "Only a super admin can change this."}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">When to send</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>POS sales</Label>
                      <Switch
                        checked={settings.send_for_pos}
                        onCheckedChange={(v) => update("send_for_pos", v)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Sales invoices (non-POS)</Label>
                      <Switch
                        checked={settings.send_for_non_pos}
                        onCheckedChange={(v) => update("send_for_non_pos", v)}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                    <CardTitle className="text-base">
                      Template when loyalty program is off
                    </CardTitle>
                    <Badge
                      className={
                        settings.loyalty_enabled
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-700"
                      }
                    >
                      Loyalty {settings.loyalty_enabled ? "on" : "off"}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Sent instead of the main template while the loyalty
                      program is disabled, e.g. a template without the points
                      lines. Leave blank to always send the main template.
                      Language, sender and PDF settings are shared.
                    </p>
                    <div className="space-y-1.5">
                      <Label htmlFor="wa-nl-message-id">
                        {copy.templateLabel} (without loyalty)
                      </Label>
                      <Input
                        id="wa-nl-message-id"
                        value={settings.no_loyalty_message_id ?? ""}
                        onChange={(e) =>
                          update("no_loyalty_message_id", e.target.value)
                        }
                        placeholder={
                          isTwilio
                            ? "HX… (blank = use main template)"
                            : "e.g. purchase_summary_basic (blank = use main template)"
                        }
                      />
                    </div>
                    {settings.no_loyalty_message_id?.trim() && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setVariant("no_loyalty")}
                        disabled={isNoLoyalty}
                      >
                        Edit its variables and preview
                      </Button>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
                    <CardTitle className="text-base">
                      Template variables
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {templateSwitch}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setCurMapping(
                            ((isNoLoyalty
                              ? settings.default_no_loyalty_mapping
                              : settings.default_mapping) || "")
                              .split(",")
                              .filter(Boolean),
                          )
                        }
                      >
                        Reset to default
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Map each {"{{n}}"} placeholder in your approved WhatsApp
                      template to a value. The order must match the template.
                      {isTwilio &&
                        ' For Twilio media templates, also map the media URL variable to "Invoice PDF file".'}
                    </p>
                    {isNoLoyalty &&
                      !settings.no_loyalty_message_id?.trim() && (
                        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          No template set for when loyalty is off, so these
                          variables aren&apos;t used. Enter its{" "}
                          {copy.templateLabel.toLowerCase()} in &quot;Template
                          when loyalty program is off&quot;.
                        </p>
                      )}
                    {curMapping.map((key, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="w-12 shrink-0 font-mono text-sm text-muted-foreground">{`{{${idx + 1}}}`}</span>
                        <Select
                          value={key}
                          onValueChange={(v) =>
                            setCurMapping((m) =>
                              m.map((k, i) => (i === idx ? v : k)),
                            )
                          }
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue>{fieldLabel(key)}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {fields.map((f) => (
                              <SelectItem key={f.key} value={f.key}>
                                {f.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span
                          className="hidden w-24 shrink-0 truncate text-xs text-muted-foreground sm:inline"
                          title={sampleFieldValue(
                            key,
                            settings.store_display_name,
                          )}
                        >
                          e.g.{" "}
                          {sampleFieldValue(key, settings.store_display_name)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove variable ${idx + 1}`}
                          onClick={() =>
                            setCurMapping((m) =>
                              m.filter((_, i) => i !== idx),
                            )
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurMapping((m) => [
                          ...m,
                          fields[0]?.key ?? "invoice_number",
                        ])
                      }
                    >
                      <Plus className="mr-2 h-4 w-4" /> Add variable
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6 lg:col-span-2">
                <Card>
                  <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
                    <CardTitle className="text-base">
                      Preview (sample data)
                    </CardTitle>
                    {templateSwitch}
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-lg bg-[#e5ddd5] p-3">
                      <div className="rounded-lg bg-white p-3 shadow-sm">
                        {settings.attach_pdf && (
                          <div className="mb-2 rounded border bg-gray-50 px-3 py-2 text-xs text-gray-600">
                            📄 Invoice_INV-0042.pdf
                          </div>
                        )}
                        <p className="whitespace-pre-wrap break-words text-sm text-gray-900">
                          {preview.parts.map((part, i) =>
                            part.kind === "text" ? (
                              <span key={i}>{part.text}</span>
                            ) : part.key ? (
                              <span
                                key={i}
                                className="rounded bg-green-100 px-0.5 font-medium text-green-900"
                                title={`{{${part.n}}} = ${fieldLabel(part.key)}`}
                              >
                                {part.value}
                              </span>
                            ) : (
                              <span
                                key={i}
                                className="rounded bg-red-100 px-0.5 font-mono text-red-700"
                                title="Not mapped to any value"
                              >
                                {`{{${part.n}}}`}
                              </span>
                            ),
                          )}
                        </p>
                      </div>
                    </div>
                    {(unmappedVars.length > 0 || unusedVars.length > 0) && (
                      <div className="mt-2 space-y-1 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        {unmappedVars.length > 0 && (
                          <p>
                            {unmappedVars.map((n) => `{{${n}}}`).join(", ")}{" "}
                            {unmappedVars.length === 1 ? "is" : "are"} in the
                            template but not mapped. Add a variable for{" "}
                            {unmappedVars.length === 1 ? "it" : "them"}.
                          </p>
                        )}
                        {unusedVars.length > 0 && (
                          <p>
                            {unusedVars.map((n) => `{{${n}}}`).join(", ")}{" "}
                            {unusedVars.length === 1 ? "is" : "are"} mapped but
                            not in the template text. WhatsApp rejects the
                            message if the variable count doesn&apos;t match
                            your approved template.
                          </p>
                        )}
                      </div>
                    )}
                    <div className="mt-4 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="wa-template-body">Template text</Label>
                        {curBody !== curDefaultBody && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCurBody(curDefaultBody)}
                          >
                            Use sample
                          </Button>
                        )}
                      </div>
                      <Textarea
                        id="wa-template-body"
                        rows={8}
                        value={curBody}
                        onChange={(e) => setCurBody(e.target.value)}
                        className="font-mono text-xs"
                      />
                      <p className="text-xs text-muted-foreground">
                        Paste your approved template&apos;s body with its{" "}
                        {"{{1}}"}, {"{{2}}"}… placeholders to preview it. Used
                        for this preview only; WhatsApp always sends the
                        approved template&apos;s wording.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Send a test</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Input
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      placeholder="WhatsApp number, e.g. 9876543210"
                      inputMode="tel"
                    />
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => void handleTest()}
                      disabled={testing}
                    >
                      {testing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      Send test with latest invoice
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Uses saved settings. Save your changes first. Sends the{" "}
                      {settings.loyalty_enabled ||
                      !settings.no_loyalty_message_id?.trim()
                        ? "main"
                        : "without-loyalty"}{" "}
                      template, matching the current loyalty setting.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="messages" className="mt-0">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Recent messages</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void loadLogs()}
                  disabled={logsLoading}
                >
                  <RefreshCw
                    className={`mr-2 h-4 w-4 ${logsLoading ? "animate-spin" : ""}`}
                  />{" "}
                  Refresh
                </Button>
              </CardHeader>
              <CardContent>
                {logs.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No messages yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-2 pr-3 font-medium">Time</th>
                          <th className="py-2 pr-3 font-medium">Invoice</th>
                          <th className="py-2 pr-3 font-medium">Customer</th>
                          <th className="py-2 pr-3 font-medium">Number</th>
                          <th className="py-2 pr-3 font-medium">Type</th>
                          <th className="py-2 pr-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map((l) => (
                          <tr
                            key={l.id}
                            className="border-b align-top last:border-0"
                          >
                            <td className="whitespace-nowrap py-2 pr-3">
                              {formatDateTime(l.created_at)}
                            </td>
                            <td className="py-2 pr-3">
                              {l.invoice_id ? (
                                <Link
                                  className="text-blue-600 hover:underline"
                                  href={`/invoices/view?id=${l.invoice_id}`}
                                >
                                  {l.invoice_number || "—"}
                                </Link>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="py-2 pr-3">{l.party_name || "—"}</td>
                            <td className="py-2 pr-3 font-mono text-xs">
                              {l.phone || "—"}
                            </td>
                            <td className="py-2 pr-3 capitalize">
                              {l.trigger}
                            </td>
                            <td className="py-2 pr-3">
                              <Badge className={STATUS_CLASS[l.status] ?? ""}>
                                {l.status}
                              </Badge>
                              {l.error && (
                                <p className="mt-1 max-w-xs text-xs text-red-600">
                                  {l.error}
                                </p>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
