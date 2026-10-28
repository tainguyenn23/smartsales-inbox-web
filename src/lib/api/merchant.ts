// Merchant dashboard API (Phase 4). Every call carries the bearer token.
import { API_BASE_URL, ApiError, apiClient } from "./client";

export interface MerchantShop {
  id: string;
  name: string;
  slug: string;
  role: string;
}

export interface LoginResult {
  access_token: string;
  merchant: { id: string; email: string; display_name: string | null };
  shops: MerchantShop[];
}

export interface Page<T> {
  items: T[];
  total: number;
}

export interface ShopStats {
  days: number;
  conversations: number;
  customer_messages: number;
  assistant_replies: number;
  replies_without_ai: number;
  ai_calls: number;
  no_result_replies: number;
  leads: number;
  top_products: { product_id: string; name: string; times_shown: number }[];
}

export interface ConversationSummary {
  id: string;
  customer_id: string;
  channel: string;
  status: string;
  message_count: number;
  last_message: string | null;
  last_message_at: string | null;
  has_lead: boolean;
  created_at: string;
}

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  action: string | null;
  empty_reason: string | null;
  ai_used: boolean;
  created_at: string;
}

export type LeadStatus = "new" | "contacted" | "won" | "lost";

export interface Lead {
  id: string;
  conversation_id: string | null;
  name: string | null;
  phone: string;
  note: string | null;
  product_id: string | null;
  product_name: string | null;
  source: string;
  status: LeadStatus;
  created_at: string;
}

export interface UnmetDemandItem {
  reason: string;
  label: string;
  count: number;
  last_asked_at: string;
  sample_message: string | null;
}

export interface ProductListItem {
  id: string;
  name: string;
  category: string | null;
  status: string;
  currency: string;
  min_price: string | number | null;
  max_price: string | number | null;
  availability: string;
}

export interface ImportResult {
  created: number;
  updated: number;
  failed: number;
  errors: { row_number: number; reason: string }[];
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

export function login(email: string, password: string): Promise<LoginResult> {
  return apiClient<LoginResult>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function fetchMe(token: string): Promise<{ shops: MerchantShop[] }> {
  return apiClient("/auth/me", { headers: auth(token) });
}

const shopPath = (shopId: string, path: string) => `/merchant/shops/${encodeURIComponent(shopId)}${path}`;

export function fetchStats(token: string, shopId: string, days = 30): Promise<ShopStats> {
  return apiClient(shopPath(shopId, "/stats"), { headers: auth(token), params: { days } });
}

export function fetchConversations(token: string, shopId: string, page = 1): Promise<Page<ConversationSummary>> {
  return apiClient(shopPath(shopId, "/conversations"), { headers: auth(token), params: { page } });
}

export function fetchMessages(token: string, shopId: string, conversationId: string): Promise<ConversationMessage[]> {
  return apiClient(shopPath(shopId, `/conversations/${encodeURIComponent(conversationId)}/messages`), {
    headers: auth(token),
  });
}

export function fetchLeads(token: string, shopId: string): Promise<Page<Lead>> {
  return apiClient(shopPath(shopId, "/leads"), { headers: auth(token) });
}

export function updateLeadStatus(token: string, shopId: string, leadId: string, status: LeadStatus): Promise<Lead> {
  return apiClient(shopPath(shopId, `/leads/${encodeURIComponent(leadId)}`), {
    method: "PATCH",
    headers: auth(token),
    body: JSON.stringify({ status }),
  });
}

export function fetchUnmetDemand(token: string, shopId: string, days = 30): Promise<UnmetDemandItem[]> {
  return apiClient(shopPath(shopId, "/unmet-demand"), { headers: auth(token), params: { days } });
}

export function fetchProducts(
  token: string,
  shopId: string,
  page: number,
  search?: string
): Promise<Page<ProductListItem> & { page: number; limit: number }> {
  return apiClient("/products", {
    headers: auth(token),
    params: { shop_id: shopId, page, limit: 20, search: search || undefined },
  });
}

/** Multipart upload; apiClient always sends JSON, so this uses fetch directly. */
export async function importProductFile(token: string, shopId: string, file: File): Promise<ImportResult> {
  const body = new FormData();
  body.append("shop_id", shopId);
  body.append("file", file);
  const response = await fetch(`${API_BASE_URL}/products/import/file`, {
    method: "POST",
    headers: auth(token),
    body,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || payload.error) {
    throw new ApiError(
      payload?.error?.message || `Import thất bại (HTTP ${response.status})`,
      response.status,
      payload?.error?.code || `HTTP_${response.status}`
    );
  }
  return payload.data as ImportResult;
}

export interface ProductVariantDetail {
  id: string;
  name: string | null;
  sku: string | null;
  attributes: Record<string, string>;
  price: string | number | null;
  stock_quantity: number | null;
  stock_status: "in_stock" | "out_of_stock" | "preorder" | "unknown";
}

export interface ProductDetail {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  status: string;
  currency: string;
  variants: ProductVariantDetail[];
}

export interface ProductPatch {
  name?: string;
  category?: string | null;
  description?: string | null;
  status?: string;
  variants?: {
    id: string;
    price?: number | null;
    stock_quantity?: number | null;
    stock_status?: ProductVariantDetail["stock_status"];
  }[];
}

export function fetchProduct(token: string, shopId: string, productId: string): Promise<ProductDetail> {
  return apiClient(`/products/${encodeURIComponent(productId)}`, { headers: auth(token), params: { shop_id: shopId } });
}

export function patchProduct(token: string, shopId: string, productId: string, patch: ProductPatch): Promise<ProductDetail> {
  return apiClient(`/products/${encodeURIComponent(productId)}`, {
    method: "PATCH",
    headers: auth(token),
    params: { shop_id: shopId },
    body: JSON.stringify(patch),
  });
}

export interface ShopSettings {
  ai_advice_enabled: boolean;
  greeting: string | null;
  policies: { shipping: string | null; returns: string | null; warranty: string | null; installation: string | null };
}

export function fetchSettings(token: string, shopId: string): Promise<ShopSettings> {
  return apiClient(shopPath(shopId, "/settings"), { headers: auth(token) });
}

export function saveSettings(token: string, shopId: string, settings: ShopSettings): Promise<ShopSettings> {
  return apiClient(shopPath(shopId, "/settings"), {
    method: "PUT",
    headers: auth(token),
    body: JSON.stringify(settings),
  });
}
