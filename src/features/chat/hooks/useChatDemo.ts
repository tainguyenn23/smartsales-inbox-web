"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { apiClient, ApiError } from "@/lib/api";
import type {
  ShopOut,
  ChatRequest,
  ChatResponseData,
  ProductCard,
  ClickRequest,
} from "@/types/api";

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

  // 2. Nhận vào shopSlug, gọi GET /shops/{slug} để lấy shop.id
  useEffect(() => {
    if (!shopSlug) return;

    let isMounted = true;
    async function fetchShop() {
      // Keep effect setup free of synchronous state updates.
      await Promise.resolve();
      if (!isMounted) return;

      setIsShopLoading(true);
      setShopError(null);

      try {
        const data = await apiClient<ShopOut>(`/shops/${encodeURIComponent(shopSlug)}`);
        if (!isMounted) return;

        setShop(data);

        // Khôi phục conversation_id của shop này từ localStorage nếu có
        if (typeof window !== "undefined") {
          const cachedConvId = localStorage.getItem(`${CONVERSATION_ID_PREFIX}${data.id}`);
          if (cachedConvId) {
            setConversationId(cachedConvId);
            conversationIdRef.current = cachedConvId;
          }
        }
      } catch (err) {
        if (!isMounted) return;
        const msg =
          err instanceof ApiError
            ? `Không tìm thấy shop: ${err.message}`
            : "Lỗi kết nối khi tải thông tin shop.";
        setShopError(msg);
      } finally {
        if (isMounted) {
          setIsShopLoading(false);
        }
      }
    }

    fetchShop();

    return () => {
      isMounted = false;
    };
  }, [shopSlug]);

  // 3. Hàm sendMessage (API này không streaming, trả về full response)
  const sendMessage = useCallback(
    async (messageText: string) => {
      const trimmedMessage = messageText.trim();
      if (!trimmedMessage) return;

      if (!shop?.id) {
        setError("Shop chưa sẵn sàng hoặc không tồn tại.");
        return;
      }

      setError(null);
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
      setMessages((prev) => [...prev, userMessage]);

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
        const responseData = await apiClient<ChatResponseData>("/chat", {
          method: "POST",
          body: JSON.stringify(payload),
        });

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

        // Hiển thị thông báo lỗi ngay trong luồng chat
        const errorMsgId =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `msg_err_${Date.now()}`;

        setMessages((prev) => [
          ...prev,
          {
            id: errorMsgId,
            role: "assistant",
            content: `⚠️ ${errorMessage}`,
            createdAt: new Date(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [shop, customerId]
  );

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

        apiClient("/click", {
          method: "POST",
          body: JSON.stringify(clickPayload),
        }).catch((err) => {
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
    sendMessage,
    handleProductClick,
    resetConversation,
  };
}
