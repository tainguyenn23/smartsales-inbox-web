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
