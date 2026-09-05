"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ApiError, fetchShop, sendChatMessage, trackClick } from "@/lib/api";
import type { ShopOut, ChatRequest, ProductCard, ClickRequest } from "@/types/api";

const CUSTOMER_ID_KEY = "smartsales_customer_id";
const CONVERSATION_ID_PREFIX = "smartsales_conv_";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  products?: ProductCard[];
  createdAt: Date;
  intent?: string;
  confidence?: number;
  needsHuman?: boolean;
}

export function useChatDemo(shopSlug: string) {
  const [shop, setShop] = useState<ShopOut | null>(null);
  const [isShopLoading, setIsShopLoading] = useState<boolean>(true);
  const [shopError, setShopError] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState<string>("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [failedMessage, setFailedMessage] = useState<string | null>(null);

  // Reference to hold conversationId to avoid stale closures during rapid sends
  const conversationIdRef = useRef<string | null>(null);

  // 1. Tự động sinh và lưu customer_id vào localStorage để giữ phiên ổn định trên thiết bị
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

  // 2. Nhận shopSlug, gọi GET /shops/{slug}; hàm này cũng phục vụ nút retry.
  const loadShop = useCallback(async () => {
    if (!shopSlug) return;
    // Defer state changes so invoking from an effect does not cascade synchronously.
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

  // 3. Hàm sendMessage (API này không streaming, trả về full response)
  const sendMessage = useCallback(
    async (messageText: string, retry = false) => {
      const trimmedMessage = messageText.trim();
      if (!trimmedMessage) return;

      if (!shop?.id) {
        setError("Shop chưa sẵn sàng hoặc không tồn tại.");
        return;
      }

      setError(null);
      setFailedMessage(null);
      setIsLoading(true);

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

      // Optimistic UI update: thêm tin nhắn của user ngay lập tức
      if (!retry) setMessages((prev) => [...prev, userMessage]);

      try {
        const currentConvId = conversationIdRef.current;

        const payload: ChatRequest = {
          shop_id: shop.id,
          conversation_id: currentConvId || null,
          customer_id: customerId || "guest-user",
          channel: "web",
          message: trimmedMessage,
        };

        // Gửi POST /chat (Non-streaming: nhận về ChatResponseData hoàn chỉnh)
        const responseData = await sendChatMessage(payload);

        // Cập nhật lại conversation_id cho các lượt chat kế tiếp
        if (responseData.conversation_id) {
          setConversationId(responseData.conversation_id);
          conversationIdRef.current = responseData.conversation_id;

          if (typeof window !== "undefined") {
            localStorage.setItem(
              `${CONVERSATION_ID_PREFIX}${shop.id}`,
              responseData.conversation_id
            );
          }
        }

        const assistantMsgId =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `msg_ai_${Date.now()}`;

        const assistantMessage: ChatMessage = {
          id: assistantMsgId,
          role: "assistant",
          content: responseData.reply,
          products: responseData.products || [],
          createdAt: new Date(),
          intent: responseData.intent,
          confidence: responseData.confidence,
          needsHuman: responseData.needs_human,
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err) {
        const errorMessage =
          err instanceof ApiError
            ? err.message
            : "Không thể kết nối đến trợ lý ảo. Vui lòng thử lại.";

        setError(errorMessage);
        setFailedMessage(trimmedMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [shop, customerId]
  );

  const retryLastMessage = useCallback(() => {
    if (failedMessage && !isLoading) void sendMessage(failedMessage, true);
  }, [failedMessage, isLoading, sendMessage]);

  // 4. Hàm handleProductClick: gọi POST /click trước khi mở URL, lỗi tracking không làm gián đoạn chuyển trang
  const handleProductClick = useCallback(
    async (product: ProductCard) => {
      const targetUrl = product.url;
      if (!targetUrl) {
        console.warn("[Click Warning] Sản phẩm không có URL hợp lệ:", product);
        return;
      }

      // Gửi tracking bất đồng bộ, catch mọi lỗi để không gián đoạn người dùng
      if (shop?.id) {
        const clickPayload: ClickRequest = {
          shop_id: shop.id,
          conversation_id: conversationIdRef.current || null,
          product_id: product.id,
          url: targetUrl,
        };

        void trackClick(clickPayload).catch((err) => {
          // Lỗi tracking được ghi nhận nội bộ, tuyệt đối không chặn việc mở trang
          console.warn("[Click Tracking Non-blocking Error]", err);
        });
      }

      // Mở URL sản phẩm ra tab mới an toàn
      if (typeof window !== "undefined") {
        window.open(targetUrl, "_blank", "noopener,noreferrer");
      }
    },
    [shop]
  );

  const resetConversation = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    conversationIdRef.current = null;
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
    isLoading,
    error,
    failedMessage,
    sendMessage,
    retryLastMessage,
    retryShop: loadShop,
    handleProductClick,
    resetConversation,
  };
}
