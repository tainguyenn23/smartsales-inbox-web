"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ApiError, fetchShop, streamChat, trackClick } from "@/lib/api";
import type {
  ShopOut,
  ChatRequest,
  StreamProductItem,
  ClickRequest,
} from "@/types/api";

const CUSTOMER_ID_KEY = "smartsales_customer_id";
const CONVERSATION_ID_PREFIX = "smartsales_conv_";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Danh sách sản phẩm từ SSE `products` event — contract stream, không phải ProductCard JSON */
  products?: StreamProductItem[];
  createdAt: Date;
  /** true khi đang nhận tokens (chỉ có ý nghĩa với message role=assistant) */
  isStreaming?: boolean;
  /** true nếu backend xác nhận đã lưu (done.saved=true) */
  saved?: boolean;
  /** Trạng thái cuối từ done.status */
  status?: string;
  /** Backend yêu cầu hiện form tên/SĐT (SSE `action` lead_form) */
  leadForm?: boolean;
}

export function useChatDemo(shopSlug: string) {
  const [shop, setShop] = useState<ShopOut | null>(null);
  const [isShopLoading, setIsShopLoading] = useState<boolean>(true);
  const [shopError, setShopError] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState<string>("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  /** true khi đang chờ event `meta` đầu tiên từ backend */
  const [isLoading, setIsLoading] = useState<boolean>(false);
  /** true sau khi nhận `meta`, đang nhận tokens */
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [failedMessage, setFailedMessage] = useState<string | null>(null);

  // Refs để tránh stale closure trong callbacks SSE
  const conversationIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  /** ID của assistant message đang được build trong stream */
  const streamingMsgIdRef = useRef<string | null>(null);

  // -------------------------------------------------------------------------
  // 1. Tự động sinh và lưu customer_id vào localStorage
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;
    let isMounted = true;

    async function initializeCustomerId() {
      await Promise.resolve();
      if (!isMounted) return;

      let existingCustomerId = localStorage.getItem(CUSTOMER_ID_KEY);
      if (!existingCustomerId) {
        existingCustomerId =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `cust_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        localStorage.setItem(CUSTOMER_ID_KEY, existingCustomerId);
      }

      setCustomerId(existingCustomerId);
    }

    void initializeCustomerId();

    return () => {
      isMounted = false;
    };
  }, []);

  // -------------------------------------------------------------------------
  // 2. Resolve shop từ slug — cũng phục vụ nút retry
  // -------------------------------------------------------------------------
  const loadShop = useCallback(async () => {
    if (!shopSlug) return;
    await Promise.resolve();
    setIsShopLoading(true);
    setShopError(null);

    try {
      const data = await fetchShop(shopSlug);
      setShop(data);
      const cachedConvId = localStorage.getItem(`${CONVERSATION_ID_PREFIX}${data.id}`);
      setConversationId(cachedConvId);
      conversationIdRef.current = cachedConvId;
    } catch (err) {
      setShop(null);
      setShopError(
        err instanceof ApiError
          ? `Không thể tải cửa hàng: ${err.message}`
          : "Lỗi kết nối khi tải thông tin shop."
      );
    } finally {
      setIsShopLoading(false);
    }
  }, [shopSlug]);

  useEffect(() => {
    queueMicrotask(() => void loadShop());
  }, [loadShop]);

  // Huỷ stream khi unmount component
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // -------------------------------------------------------------------------
  // 3. sendMessage — gọi POST /api/v1/chat/stream (SSE)
  // -------------------------------------------------------------------------
  const sendMessage = useCallback(
    async (messageText: string, retry = false) => {
      const trimmedMessage = messageText.trim();
      if (!trimmedMessage) return;

      if (!shop?.id) {
        setError("Shop chưa sẵn sàng hoặc không tồn tại.");
        return;
      }

      // Huỷ stream cũ nếu đang chạy (user gửi tin nhắn mới)
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setError(null);
      setFailedMessage(null);
      setIsLoading(true);
      setIsStreaming(false);

      const userMsgId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `msg_${Date.now()}`;

      const userMessage: ChatMessage = {
        id: userMsgId,
        role: "user",
        content: trimmedMessage,
        createdAt: new Date(),
      };

      // Optimistic UI: thêm tin nhắn của user ngay lập tức
      if (!retry) setMessages((prev) => [...prev, userMessage]);

      const payload: ChatRequest = {
        shop_id: shop.id,
        conversation_id: conversationIdRef.current || null,
        customer_id: customerId || "guest-user",
        channel: "web",
        message: trimmedMessage,
      };

      try {
        await streamChat(
          payload,
          {
            // --- meta: backend confirm conversation, tạo placeholder message ---
            onMeta: (meta) => {
              // Lưu conversation_id cho lượt kế tiếp
              setConversationId(meta.conversation_id);
              conversationIdRef.current = meta.conversation_id;
              if (typeof window !== "undefined") {
                localStorage.setItem(
                  `${CONVERSATION_ID_PREFIX}${shop.id}`,
                  meta.conversation_id
                );
              }

              // Tạo assistant message placeholder bằng message_id từ backend
              streamingMsgIdRef.current = meta.message_id;
              const placeholderMsg: ChatMessage = {
                id: meta.message_id,
                role: "assistant",
                content: "",
                products: [],
                createdAt: new Date(),
                isStreaming: true,
                saved: false,
              };
              setMessages((prev) => [...prev, placeholderMsg]);
              setIsLoading(false);
              setIsStreaming(true);
            },

            // --- products: thay thế danh sách card của lượt này ---
            onProducts: (event) => {
              const msgId = streamingMsgIdRef.current;
              if (!msgId) return;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === msgId ? { ...m, products: event.products } : m
                )
              );
            },

            // --- token: nối text vào content của assistant message ---
            onToken: (event) => {
              const msgId = streamingMsgIdRef.current;
              if (!msgId) return;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === msgId ? { ...m, content: m.content + event.text } : m
                )
              );
            },

            // --- action: hiện form để lại tên/SĐT dưới tin nhắn này ---
            onAction: (event) => {
              const msgId = streamingMsgIdRef.current;
              if (!msgId || event.type !== "lead_form") return;
              setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, leadForm: true } : m)));
            },

            // --- error SSE event: hiển thị warning, tiếp tục đọc đến done ---
            onError: (event) => {
              console.warn("[SSE Error Event]", event.code, event.message);
              // Không setError ở đây để không ngắt UX; backend vẫn phát done
            },

            // --- done: kết thúc stream, cập nhật trạng thái lưu ---
            onDone: (event) => {
              const msgId = streamingMsgIdRef.current;
              if (msgId) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === msgId
                      ? {
                          ...m,
                          isStreaming: false,
                          saved: event.saved,
                          status: event.status,
                        }
                      : m
                  )
                );
              }
              streamingMsgIdRef.current = null;
              setIsStreaming(false);
              setIsLoading(false);
            },
          },
          controller.signal
        );
      } catch (err) {
        // AbortError = user huỷ chủ động (component unmount, gửi tin mới) — không báo lỗi
        if (err instanceof DOMException && err.name === "AbortError") {
          setIsLoading(false);
          setIsStreaming(false);
          return;
        }

        const errorMessage =
          err instanceof ApiError
            ? err.status === 429 && err.retryAfter
              ? `Bạn gửi yêu cầu quá nhanh. Vui lòng thử lại sau ${err.retryAfter} giây.`
              : err.message
            : "Không thể kết nối đến trợ lý ảo. Vui lòng thử lại.";

        setError(errorMessage);
        setFailedMessage(trimmedMessage);

        // Nếu lỗi xảy ra sau khi đã nhận meta (đang stream) — đánh dấu message thất bại
        const currentMsgId = streamingMsgIdRef.current;
        if (currentMsgId) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === currentMsgId
                ? { ...m, isStreaming: false, status: "error" }
                : m
            )
          );
          streamingMsgIdRef.current = null;
        }

        setIsLoading(false);
        setIsStreaming(false);
      }
    },
    [shop, customerId]
  );

  const retryLastMessage = useCallback(() => {
    if (failedMessage && !isLoading && !isStreaming) void sendMessage(failedMessage, true);
  }, [failedMessage, isLoading, isStreaming, sendMessage]);

  // -------------------------------------------------------------------------
  // 4. handleProductClick — gọi POST /click trước khi mở URL
  // -------------------------------------------------------------------------
  const handleProductClick = useCallback(
    async (product: StreamProductItem) => {
      // Ưu tiên affiliate_url theo spec, fallback product_url
      const targetUrl = product.affiliate_url ?? product.product_url;
      if (!targetUrl) {
        console.warn("[Click Warning] Sản phẩm không có URL hợp lệ:", product);
        return;
      }

      if (shop?.id) {
        const clickPayload: ClickRequest = {
          shop_id: shop.id,
          conversation_id: conversationIdRef.current || null,
          product_id: product.product_id,
          url: targetUrl,
        };

        void trackClick(clickPayload).catch((err) => {
          // Lỗi tracking không chặn việc mở trang
          console.warn("[Click Tracking Non-blocking Error]", err);
        });
      }

      if (typeof window !== "undefined") {
        window.open(targetUrl, "_blank", "noopener,noreferrer");
      }
    },
    [shop]
  );

  const resetConversation = useCallback(() => {
    abortControllerRef.current?.abort();
    setMessages([]);
    setConversationId(null);
    conversationIdRef.current = null;
    streamingMsgIdRef.current = null;
    setIsLoading(false);
    setIsStreaming(false);
    if (shop?.id && typeof window !== "undefined") {
      localStorage.removeItem(`${CONVERSATION_ID_PREFIX}${shop.id}`);
    }
  }, [shop]);

  return {
    shop,
    isShopLoading,
    shopError,
    customerId,
    conversationId,
    messages,
    /** true khi đang chờ event meta (giai đoạn trước khi stream bắt đầu) */
    isLoading,
    /** true khi đang nhận tokens từ stream */
    isStreaming,
    error,
    failedMessage,
    sendMessage,
    retryLastMessage,
    retryShop: loadShop,
    handleProductClick,
    resetConversation,
  };
}
