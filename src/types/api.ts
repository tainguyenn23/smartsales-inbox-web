/**
 * Public aliases over the generated OpenAPI contract.
 * Regenerate with `npm run generate:api` after replacing openapi.json with the
 * backend's current /openapi.json. Never copy Python schemas into this project.
 */
import type { components } from "./generated/api";

export type ApiErrorDetail = components["schemas"]["ErrorDetail"];

export interface ApiResponse<T> {
  data: T | null;
  error: ApiErrorDetail | null;
}

export type ShopOut = components["schemas"]["ShopOut"];
export type ChatRequest = components["schemas"]["ChatRequest"];
export type ChatResponse = components["schemas"]["ChatResponse"];
export type ChatResponseData = ChatResponse;
export type ProductCard = components["schemas"]["ProductCard"];
export type ProductVariantPreview = components["schemas"]["ProductVariantPreview"];
export type ClickRequest = components["schemas"]["ClickRequest"];
export type ClickEventOut = components["schemas"]["ClickEventOut"];
export type ConversationChannel = NonNullable<ChatRequest["channel"]>;
export type IntentName = ChatResponse["intent"];
export type StockStatus = ProductCard["availability"];

// ---------------------------------------------------------------------------
// SSE streaming contract — POST /api/v1/chat/stream
// Các type dưới đây khớp với contract trong backend-frontend-api-map.md.
// price chấp nhận number | string | null trong giai đoạn chuyển tiếp (NUMERIC
// từ SQLAlchemy có thể được JSON encode thành số hoặc chuỗi).
// ---------------------------------------------------------------------------

/** Một variant in-stock được trả về trong stream products event */
export interface StreamProductVariant {
  id: string;
  name: string;
  attributes: Record<string, string>;
  /** Decimal-safe: có thể là số hoặc chuỗi số tuỳ version backend */
  price: number | string | null;
  stock_status: string;
  image_url?: string | null;
}

/** Product object trong stream — khác ProductCard ở JSON endpoint */
export interface StreamProductItem {
  product_id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  currency: string;
  image_url?: string | null;
  product_url?: string | null;
  affiliate_url?: string | null;
  /** Chỉ chứa variant in-stock khớp filter */
  variants: StreamProductVariant[];
  cosine_similarity?: number | null;
  score: number;
  rank: number;
}

// --- SSE event payload types ---

export interface StreamMetaEvent {
  conversation_id: string;
  message_id: string;
}

export interface StreamProductsEvent {
  products: StreamProductItem[];
}

export interface StreamTokenEvent {
  text: string;
}

export interface StreamErrorEvent {
  code: string;
  message: string;
}

export interface StreamDoneEvent {
  message_id: string;
  saved: boolean;
  status: string;
}

