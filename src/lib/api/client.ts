import type {
  ApiResponse,
  ChatRequest,
  ChatResponse,
  ClickEventOut,
  ClickRequest,
  ShopOut,
  StreamMetaEvent,
  StreamProductsEvent,
  StreamTokenEvent,
  StreamErrorEvent,
  StreamDoneEvent,
  StreamActionEvent,
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
  retryAfter: number | null;

  constructor(
    message: string,
    status: number,
    code: string,
    requestId: string | null = null,
    retryAfter: number | null = null
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.retryAfter = retryAfter;
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
  const retryAfterHeader = response.headers.get("retry-after");
  const parsedRetryAfter = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : Number.NaN;
  const retryAfter = Number.isFinite(parsedRetryAfter) ? parsedRetryAfter : null;

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

    throw new ApiError(errorMessage, response.status, errorCode, requestId, retryAfter);
  }

  if (payload.data === null || payload.data === undefined) {
    return null as unknown as T;
  }

  return payload.data;
}

export function fetchShop(slug: string, signal?: AbortSignal): Promise<ShopOut> {
  return apiClient<ShopOut>(`/shops/${encodeURIComponent(slug)}`, { signal });
}

/**
 * Fallback JSON chat — giữ lại để test và tương thích client chưa hỗ trợ SSE.
 * UI mới nên dùng streamChat() thay thế.
 */
export function sendChatMessage(request: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
  return apiClient<ChatResponse>("/chat", {
    method: "POST",
    body: JSON.stringify(request),
    signal,
  });
}

// ---------------------------------------------------------------------------
// SSE streaming chat — POST /api/v1/chat/stream
// ---------------------------------------------------------------------------

export interface StreamChatCallbacks {
  onMeta: (event: StreamMetaEvent) => void;
  onProducts: (event: StreamProductsEvent) => void;
  onToken: (event: StreamTokenEvent) => void;
  /** SSE error event — tiếp tục đọc tới done, không throw */
  onError: (event: StreamErrorEvent) => void;
  onDone: (event: StreamDoneEvent) => void;
  /** Optional UI hint, e.g. show the name/phone form after an order. */
  onAction?: (event: StreamActionEvent) => void;
}

/**
 * Parse một SSE frame (văn bản giữa hai \n\n).
 * Trả về { eventType, data } hoặc null nếu là keep-alive comment.
 */
function parseSseFrame(frame: string): { eventType: string; data: unknown } | null {
  const lines = frame.split("\n");
  let eventType = "message";
  let dataLine = "";

  for (const line of lines) {
    if (line.startsWith(":")) {
      // keep-alive comment — bỏ qua
      continue;
    }
    if (line.startsWith("event:")) {
      eventType = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataLine = line.slice("data:".length).trim();
    }
  }

  if (!dataLine) return null;

  try {
    return { eventType, data: JSON.parse(dataLine) };
  } catch {
    console.warn("[SSE] Failed to parse data JSON:", dataLine);
    return null;
  }
}

/**
 * Gọi POST /api/v1/chat/stream, đọc SSE và dispatch callbacks theo event type.
 *
 * Thứ tự event backend đảm bảo: meta → products → token… → done
 * - Lỗi trước stream (non-2xx) → throw ApiError (decode JSON error envelope)
 * - SSE `error` event → gọi onError, tiếp tục đọc tới done
 * - `done` event → gọi onDone rồi return
 * - AbortError được re-throw để caller có thể phân biệt cancel vs lỗi thật
 */
export async function streamChat(
  request: ChatRequest,
  callbacks: StreamChatCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const url = `${API_BASE_URL}/chat/stream`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(request),
      signal,
      cache: "no-store",
    });
  } catch (networkError) {
    // Re-throw AbortError nguyên vẹn để caller biết đây là cancel chủ động
    if (networkError instanceof DOMException && networkError.name === "AbortError") {
      throw networkError;
    }
    console.error("[SSE Network Error]", networkError);
    throw new Error(
      `Network request failed: ${
        networkError instanceof Error ? networkError.message : "Unknown error"
      }`
    );
  }

  // Lỗi trước khi stream bắt đầu — backend trả JSON error envelope
  if (!response.ok) {
    const requestId =
      response.headers.get("x-request-id") || response.headers.get("X-Request-ID");
    const retryAfterHeader = response.headers.get("retry-after");
    const parsedRetryAfter = retryAfterHeader
      ? Number.parseInt(retryAfterHeader, 10)
      : Number.NaN;
    const retryAfter = Number.isFinite(parsedRetryAfter) ? parsedRetryAfter : null;

    let errorCode = `HTTP_${response.status}`;
    let errorMessage = `Request failed with status ${response.status}`;
    try {
      const errPayload = (await response.json()) as ApiResponse<null>;
      if (errPayload.error) {
        errorCode = errPayload.error.code || errorCode;
        errorMessage = errPayload.error.message || errorMessage;
      }
    } catch {
      // không parse được JSON — giữ default
    }

    throw new ApiError(errorMessage, response.status, errorCode, requestId, retryAfter);
  }

  if (!response.body) {
    throw new Error("Streaming body is unavailable");
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";

  try {
    for (;;) {
      const { value = "", done } = await reader.read();
      buffer += value;

      // Split theo double newline — mỗi SSE frame kết thúc bằng \n\n
      const frames = buffer.split("\n\n");
      // Phần cuối chưa hoàn chỉnh (chưa có \n\n) — giữ lại trong buffer
      buffer = frames.pop() ?? "";

      for (const frame of frames) {
        if (!frame.trim()) continue;
        const parsed = parseSseFrame(frame);
        if (!parsed) continue;

        const { eventType, data } = parsed;

        switch (eventType) {
          case "meta":
            callbacks.onMeta(data as StreamMetaEvent);
            break;
          case "products":
            callbacks.onProducts(data as StreamProductsEvent);
            break;
          case "token":
            callbacks.onToken(data as StreamTokenEvent);
            break;
          case "action":
            callbacks.onAction?.(data as StreamActionEvent);
            break;
          case "error":
            // SSE-level error — báo cáo nhưng tiếp tục đọc tới done
            callbacks.onError(data as StreamErrorEvent);
            break;
          case "done":
            callbacks.onDone(data as StreamDoneEvent);
            // done là event cuối cùng — dừng ngay
            reader.cancel().catch(() => undefined);
            return;
          default:
            console.debug("[SSE] Unknown event type:", eventType, data);
        }
      }

      if (done) break;
    }
  } finally {
    reader.cancel().catch(() => undefined);
  }
}

export function trackClick(request: ClickRequest): Promise<ClickEventOut> {
  return apiClient<ClickEventOut>("/click", {
    method: "POST",
    body: JSON.stringify(request),
    keepalive: true,
  });
}
