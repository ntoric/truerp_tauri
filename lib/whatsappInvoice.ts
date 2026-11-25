import { apiFetch } from "@/hooks/useAuth";

/** Per-store WhatsApp invoice message settings (Meta WhatsApp Cloud API, Fast2SMS or Twilio) + API helpers. */

export type WhatsAppProvider = "whatsapp_cloud" | "fast2sms" | "twilio";

export interface WhatsAppInvoiceField {
  key: string;
  label: string;
}

export interface WhatsAppInvoiceSettings {
  enabled: boolean;
  provider: WhatsAppProvider;
  message_id: string;
  phone_number_id: string;
  /** Twilio Account SID (AC...); unused by other providers. */
  account_sid: string;
  language_code: string;
  /** Comma-separated field keys; position N fills template variable {{N}}. */
  variable_mapping: string;
  store_display_name: string;
  /** Copy of the approved template body, used only for the preview. */
  template_body?: string;
  /** Template sent while the loyalty program is off; empty = use message_id. */
  no_loyalty_message_id: string;
  /** Variable mapping for the no-loyalty template (same format as variable_mapping). */
  no_loyalty_variable_mapping: string;
  /** Preview-only body of the no-loyalty template. */
  no_loyalty_template_body?: string;
  attach_pdf: boolean;
  public_base_url: string;
  country_code: string;
  send_for_pos: boolean;
  send_for_non_pos: boolean;
  /** Signed PDF link lifetime. Only super admins can change it. */
  pdf_link_ttl_minutes: number;
  // read-only
  has_api_key?: boolean;
  api_key_hint?: string;
  has_phone_number_id?: boolean;
  phone_number_id_hint?: string;
  /** Super admin only: phone_number_id carries the full saved value. */
  can_view_phone_number_id?: boolean;
  available_fields?: WhatsAppInvoiceField[];
  providers?: { key: WhatsAppProvider; label: string }[];
  default_mapping?: string;
  default_no_loyalty_mapping?: string;
  /** Whether the store's loyalty program is currently on. */
  loyalty_enabled?: boolean;
  env_public_base_url?: string;
  can_edit_link_ttl?: boolean;
  min_link_ttl_minutes?: number;
  max_link_ttl_minutes?: number;
}

// Gateway credentials (provider, key, sender, Account SID) are edited only
// in Developer Settings → Integrations; the save endpoint ignores them.
export interface WhatsAppInvoiceSettingsPayload extends Omit<
  WhatsAppInvoiceSettings,
  | "provider"
  | "phone_number_id"
  | "account_sid"
  | "has_api_key"
  | "api_key_hint"
  | "has_phone_number_id"
  | "phone_number_id_hint"
  | "can_view_phone_number_id"
  | "available_fields"
  | "providers"
  | "default_mapping"
  | "default_no_loyalty_mapping"
  | "loyalty_enabled"
  | "env_public_base_url"
  | "can_edit_link_ttl"
  | "min_link_ttl_minutes"
  | "max_link_ttl_minutes"
> {}

export interface WhatsAppInvoiceLog {
  id: string;
  invoice_id: string;
  invoice_number: string;
  party_name: string;
  phone: string;
  trigger: "auto" | "manual" | "test";
  status: "sent" | "failed" | "skipped";
  request_id: string;
  error: string;
  created_at: string;
}

async function readJson<T>(res: Response, fallback: string): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || fallback);
  return data as T;
}

export async function fetchWhatsAppInvoiceSettings(): Promise<WhatsAppInvoiceSettings> {
  return readJson(
    await apiFetch("/settings/whatsapp-invoice"),
    "Failed to load WhatsApp invoice settings",
  );
}

export async function saveWhatsAppInvoiceSettings(
  payload: WhatsAppInvoiceSettingsPayload,
): Promise<WhatsAppInvoiceSettings> {
  return readJson(
    await apiFetch("/settings/whatsapp-invoice", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
    "Failed to save WhatsApp invoice settings",
  );
}

/** Turns automatic WhatsApp invoice messages on/off without changing other settings. */
export async function setWhatsAppInvoiceEnabled(
  enabled: boolean,
): Promise<WhatsAppInvoiceSettings> {
  return readJson(
    await apiFetch("/settings/whatsapp-invoice/enabled", {
      method: "PUT",
      body: JSON.stringify({ enabled }),
    }),
    `Failed to ${enabled ? "enable" : "disable"} WhatsApp invoice messages`,
  );
}

export async function sendWhatsAppInvoiceTest(
  phone: string,
  invoiceId?: string,
) {
  return readJson<{ message: string; log: WhatsAppInvoiceLog }>(
    await apiFetch("/settings/whatsapp-invoice/test", {
      method: "POST",
      body: JSON.stringify({ phone, invoice_id: invoiceId || "" }),
    }),
    "Failed to send test message",
  );
}

export async function fetchWhatsAppInvoiceLogs(
  limit = 50,
  invoiceId?: string,
): Promise<WhatsAppInvoiceLog[]> {
  const qs = new URLSearchParams({ limit: String(limit) });
  if (invoiceId) qs.set("invoice_id", invoiceId);
  return readJson(
    await apiFetch(`/settings/whatsapp-invoice/logs?${qs}`),
    "Failed to load message log",
  );
}

/** Manually (re)send an invoice on WhatsApp; phone overrides the party's number. */
export async function sendInvoiceOnWhatsApp(invoiceId: string, phone?: string) {
  return readJson<{ message: string; log: WhatsAppInvoiceLog }>(
    await apiFetch(`/invoices/${invoiceId}/whatsapp`, {
      method: "POST",
      body: JSON.stringify({ phone: phone || "" }),
    }),
    "Failed to send WhatsApp message",
  );
}

/** Sample text matching the default WhatsApp template, for the preview. */
export const DEFAULT_TEMPLATE_PREVIEW = `Hello,

Thank you for shopping with {{7}}!

Purchase Summary.
-----------------------
- Invoice: {{1}}
- Amount: ₹ {{2}}
- Date: {{3}}
-----------------------
- Points credited : {{4}}
- Points Balance : {{5}}
- Points Redeemed : {{6}}

Please find your invoice attached.

Thank you for choosing {{7}}!`;

/** Sample text for the template used while the loyalty program is off. */
export const DEFAULT_NO_LOYALTY_TEMPLATE_PREVIEW = `Hello,

Thank you for shopping with {{4}}!

Purchase Summary.
-----------------------
- Invoice: {{1}}
- Amount: ₹ {{2}}
- Date: {{3}}
-----------------------

Please find your invoice attached.

Thank you for choosing {{4}}!`;

export const SAMPLE_FIELD_VALUES: Record<string, string> = {
  invoice_number: "INV-0042",
  total_amount: "1,250.00",
  invoice_date: "15-11-2026",
  points_earned: "12",
  points_balance: "148",
  points_redeemed: "0",
  store_name: "Your Store",
  customer_name: "Rahul",
  amount_paid: "1,250.00",
  balance_due: "0.00",
  loyalty_discount: "0.00",
  store_phone: "9876543210",
  invoice_pdf_url: "https://api.example.com/api/v1/public/invoice-pdf/…pdf",
  invoice_pdf_file: "…pdf",
};

export type TemplatePreviewPart =
  | { kind: "text"; text: string }
  | { kind: "var"; n: number; key?: string; value?: string };

/** Splits a template body into text and {{n}} parts, filling each from the mapping. */
export function buildTemplatePreview(
  body: string,
  mapping: string[],
  storeName?: string,
): { parts: TemplatePreviewPart[]; used: number[] } {
  const parts: TemplatePreviewPart[] = [];
  const used = new Set<number>();
  const re = /\{\{\s*(\d+)\s*\}\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    if (m.index > last)
      parts.push({ kind: "text", text: body.slice(last, m.index) });
    const n = Number(m[1]);
    used.add(n);
    const key = mapping[n - 1];
    const value = key ? sampleFieldValue(key, storeName) : undefined;
    parts.push({ kind: "var", n, key, value });
    last = re.lastIndex;
  }
  if (last < body.length) parts.push({ kind: "text", text: body.slice(last) });
  return { parts, used: Array.from(used).sort((a, b) => a - b) };
}

export function sampleFieldValue(key: string, storeName?: string): string {
  if (key === "store_name" && storeName?.trim()) return storeName.trim();
  return SAMPLE_FIELD_VALUES[key] ?? key;
}

/** Provider-specific labels and hints for the settings page. */
export const WHATSAPP_PROVIDER_COPY: Record<
  WhatsAppProvider,
  {
    label: string;
    secretLabel: string;
    secretPlaceholder: string;
    secretHint: string;
    templateLabel: string;
    templatePlaceholder: string;
    templateHint: string;
    phoneIdLabel: string;
    phoneIdPlaceholder: string;
    phoneIdHint: string;
    /** Language is part of a Twilio Content template, not sent per message. */
    usesLanguage: boolean;
    pdfHint: string;
  }
> = {
  whatsapp_cloud: {
    label: "WhatsApp Cloud API (Meta)",
    secretLabel: "Access token",
    secretPlaceholder: "Permanent access token",
    secretHint:
      "Meta → WhatsApp → API Setup → permanent token. Stored encrypted.",
    templateLabel: "Template name",
    templatePlaceholder: "e.g. purchase_summary",
    templateHint: "Name of the approved template in WhatsApp Manager.",
    phoneIdLabel: "Phone Number ID",
    phoneIdPlaceholder: "e.g. 123456789012345",
    phoneIdHint: "From Meta → WhatsApp → API Setup.",
    usesLanguage: true,
    pdfHint: "Turn on if your template has a Document header.",
  },
  fast2sms: {
    label: "Fast2SMS",
    secretLabel: "Fast2SMS API key",
    secretPlaceholder: "Fast2SMS API authorization key",
    secretHint: "Fast2SMS dashboard → Dev API → API key. Stored encrypted.",
    templateLabel: "Template name",
    templatePlaceholder: "e.g. purchase_summary",
    templateHint:
      "Exact approved template name (not the numeric message ID) from Fast2SMS → WhatsApp Manager.",
    phoneIdLabel: "Phone Number ID",
    phoneIdPlaceholder: "e.g. 123456789012345",
    phoneIdHint:
      "Phone Number ID (not the mobile number) from Fast2SMS → WhatsApp Manager.",
    usesLanguage: true,
    pdfHint: "Turn on if your template has a Document header.",
  },
  twilio: {
    label: "Twilio",
    secretLabel: "Auth Token",
    secretPlaceholder: "Twilio Auth Token",
    secretHint: "Twilio Console → Account Info → Auth Token. Stored encrypted.",
    templateLabel: "Content SID",
    templatePlaceholder: "HX…",
    templateHint:
      "SID of the WhatsApp-approved template in Twilio → Messaging → Content Template Builder.",
    phoneIdLabel: "WhatsApp sender",
    phoneIdPlaceholder: "+14155238886 or MG…",
    phoneIdHint:
      "Your WhatsApp-enabled Twilio number, or a Messaging Service SID (MG…).",
    usesLanguage: false,
    pdfHint:
      'Use a Twilio media template whose media URL is <Public API URL>/api/v1/public/invoice-pdf/{{n}}, and map {{n}} to "Invoice PDF file".',
  },
};
