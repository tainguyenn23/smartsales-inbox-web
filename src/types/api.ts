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

export type ShopOut = components["schemas"]["ShopOut"] & { categories?: string[] };
export type ChatRequest = components["schemas"]["ChatRequest"];
export type ChatResponse = components["schemas"]["ChatResponse"] & { suggestions?: string[] };
export type ChatResponseData = ChatResponse;
export type ProductCard = components["schemas"]["ProductCard"];
export type ProductVariantPreview = components["schemas"]["ProductVariantPreview"];
export type ClickRequest = components["schemas"]["ClickRequest"];
export type ClickEventOut = components["schemas"]["ClickEventOut"];
export type ConversationChannel = NonNullable<ChatRequest["channel"]>;
export type IntentName = ChatResponse["intent"];
export type StockStatus = ProductCard["availability"];

export interface StreamProductVariant {
  id: string;
  name: string;
  attributes: Record<string, string>;
  price: number | string | null;
  stock_status: string;
  image_url?: string | null;
}

export interface StreamProductItem {
  product_id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  currency: string;
  image_url?: string | null;
  product_url?: string | null;
  affiliate_url?: string | null;
  variants: StreamProductVariant[];
  cosine_similarity?: number | null;
  score: number;
  rank: number;
}

export interface StreamMetaEvent {
  conversation_id: string;
  message_id: string;
}

export interface StreamProductsEvent {
  products: StreamProductItem[];
}

export interface StreamSuggestionsEvent {
  suggestions: string[];
}

export interface StreamTokenEvent {
  text: string;
}

export interface StreamResetEvent {
  content?: string;
  reason?: string;
}

export interface StreamErrorEvent {
  code: string;
  message: string;
}

export type StreamActionEvent =
  | { type: "lead_form" }
  | {
      type: "open_store";
      total_matches?: number;
      store_links?: {
        shopee_url?: string;
        shopify_url?: string;
        catalog_url?: string;
      };
    }
  | {
      type: "human_handoff";
      locked?: boolean;
      reason?: string;
      zalo_url?: string | null;
      hotline?: string | null;
    };

export interface StreamDoneEvent {
  message_id: string;
  saved: boolean;
  status: string;
}
