/**
 * SmartSales API Type Definitions
 * Source of truth: docs/backend-frontend-api-map.md & backend Pydantic schemas.
 */

export interface ApiErrorDetail {
  code: string;
  message: string;
}

/**
 * Standard Envelope Response format from FastAPI backend:
 * { "data": T | null, "error": { "code": string, "message": string } | null }
 */
export interface ApiResponse<T> {
  data: T | null;
  error: ApiErrorDetail | null;
}

/**
 * Shop public/resolved profile
 */
export interface ShopOut {
  id: string;
  name: string;
  slug: string;
  owner_email: string | null;
  created_at: string;
}

export type ConversationChannel =
  | "web"
  | "zalo"
  | "facebook"
  | "shopee"
  | "tiktok"
  | "manual";

export type StockStatus = "in_stock" | "out_of_stock" | "preorder" | "unknown";

export type IntentName =
  | "product_recommendation"
  | "product_info"
  | "policy_question"
  | "greeting"
  | "out_of_scope";

export interface ProductVariantPreview {
  attributes: Record<string, string>;
  price: string | null;
  stock_status: StockStatus;
  stock_quantity: number | null;
}

/**
 * Deterministic ProductCard returned by RAG grounded pipeline.
 * NOTE: min_price and max_price are strictly string | null (serialized Decimal), NEVER number.
 */
export interface ProductCard {
  id: string;
  name: string;
  image_url: string | null;
  url: string | null;
  currency: string;
  min_price: string | null;
  max_price: string | null;
  availability: StockStatus;
  variants_preview: ProductVariantPreview[];
  reason: string;
  score: number;
}

/**
 * Chat request payload for POST /api/v1/chat
 */
export interface ChatRequest {
  shop_id: string;
  conversation_id?: string | null;
  customer_id: string;
  channel?: ConversationChannel;
  message: string;
}

/**
 * Chat response data returned inside ApiResponse<ChatResponseData>
 */
export interface ChatResponseData {
  conversation_id: string;
  reply: string;
  intent: IntentName;
  needs_human: boolean;
  confidence: number;
  products: ProductCard[];
}

/**
 * Click tracking request payload for POST /api/v1/click
 */
export interface ClickRequest {
  shop_id: string;
  conversation_id?: string | null;
  product_id?: string | null;
  url: string;
}

/**
 * Click event response data
 */
export interface ClickEventOut {
  id: string;
  shop_id: string;
  conversation_id: string | null;
  product_id: string | null;
  url: string;
  metadata: Record<string, unknown>;
  created_at: string;
}
