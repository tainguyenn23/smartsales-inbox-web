import type {
  ApiResponse,
  ChatRequest,
  ChatResponse,
  ClickEventOut,
  ClickRequest,
  ShopOut,
} from "@/types/api";

const DEFAULT_BASE_URL = "http://localhost:8000/api/v1";

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_BASE_URL).replace(
  /\/+$/,
  ""
);

/**
 * Custom error class containing HTTP status, backend error code, and X-Request-ID
 */
export class ApiError extends Error {
  status: number;
  code: string;
  requestId: string | null;

  constructor(message: string, status: number, code: string, requestId: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

export interface ApiClientOptions extends RequestInit {
  params?: Record<string, string | number | boolean | null | undefined>;
}

/**
 * Typed HTTP client wrapper for SmartSales FastAPI backend
 * Decodes standard envelope ApiResponse<T> -> returns T
 */
export async function apiClient<T>(endpoint: string, options: ApiClientOptions = {}): Promise<T> {
  const { params, headers, ...customConfig } = options;

  const normalizedPath = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  let url = `${API_BASE_URL}${normalizedPath}`;

  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined) {
        searchParams.append(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes("?") ? "&" : "?") + queryString;
    }
  }

  const defaultHeaders: HeadersInit = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  let response: Response;
  try {
    response = await fetch(url, {
      ...customConfig,
      cache: customConfig.cache ?? "no-store",
      headers: {
        ...defaultHeaders,
        ...headers,
      },
    });
  } catch (networkError) {
    console.error(`[API Network Error] URL: ${url}`, networkError);
    throw new Error(
      `Network request failed for ${url}: ${
        networkError instanceof Error ? networkError.message : "Unknown error"
      }`
    );
  }

  const requestId = response.headers.get("x-request-id") || response.headers.get("X-Request-ID");

  let payload: ApiResponse<T> | null = null;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch (parseError) {
    console.error(
      `[API Error] Failed to parse JSON response. Status: ${response.status}, X-Request-ID: ${requestId}`,
      parseError
    );
    throw new ApiError(
      `Invalid JSON response from server (HTTP ${response.status})`,
      response.status,
      "INVALID_JSON",
      requestId
    );
  }

  // Handle envelope errors or non-2xx status
  if (!response.ok || payload.error) {
    const errorCode = payload.error?.code || `HTTP_${response.status}`;
    const errorMessage = payload.error?.message || `Request failed with status ${response.status}`;

    console.error(`[API Error] [${response.status}] [${errorCode}] X-Request-ID: ${requestId}`, {
      url,
      status: response.status,
      code: errorCode,
      message: errorMessage,
      requestId,
    });

    throw new ApiError(errorMessage, response.status, errorCode, requestId);
  }

  if (payload.data === null || payload.data === undefined) {
    return null as unknown as T;
  }

  return payload.data;
}

export function fetchShop(slug: string, signal?: AbortSignal): Promise<ShopOut> {
  return apiClient<ShopOut>(`/shops/${encodeURIComponent(slug)}`, { signal });
}

export function sendChatMessage(request: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
  return apiClient<ChatResponse>("/chat", {
    method: "POST",
    body: JSON.stringify(request),
    signal,
  });
}

export function trackClick(request: ClickRequest): Promise<ClickEventOut> {
  return apiClient<ClickEventOut>("/click", {
    method: "POST",
    body: JSON.stringify(request),
    keepalive: true,
  });
}
