"use client";

import { use, useState, useRef, useEffect, useSyncExternalStore, type FormEvent } from "react";
import { ChatProductCard, useChatDemo } from "@/features/chat";
import { ChatMarkdown } from "@/features/chat/ChatMarkdown";
import { LeadForm } from "@/features/chat/LeadForm";
import type { StreamProductItem } from "@/types/api";

interface ChatPageProps {
  params: Promise<{ slug: string }>;
}

const noSubscribe = () => () => {};

/**
 * Định dạng tiền tệ an toàn từ chuỗi hoặc số Decimal.
 * Backend có thể trả price dạng number hoặc string trong giai đoạn chuyển tiếp.
 */
function formatCurrency(price: number | string | null | undefined, currency = "VND"): string {
  if (price === null || price === undefined || price === "") return "";
  const numericPrice = typeof price === "number" ? price : parseFloat(String(price));
  if (isNaN(numericPrice)) return String(price);

  try {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: currency || "VND",
      maximumFractionDigits: 0,
    }).format(numericPrice);
  } catch {
    return `${numericPrice.toLocaleString("vi-VN")} ${currency}`;
  }
}

export default function ChatPage({ params }: ChatPageProps) {
  const unwrappedParams = use(params);
  const shopSlug = unwrappedParams.slug;

  const {
    shop,
    isShopLoading,
    shopError,
    messages,
    isLoading,
    isStreaming,
    error,
    sendMessage,
    retryLastMessage,
    retryShop,
    handleProductClick,
  } = useChatDemo(shopSlug);

  const [inputMessage, setInputMessage] = useState("");
  const embedded = useSyncExternalStore(
    noSubscribe,
    () => new URLSearchParams(window.location.search).get("embed") === "true",
    () => false,
  );
  const quickReplies = [
    ...(shop?.categories ?? []).map((category) => ({ label: `🔎 ${category}`, message: category })),
    { label: "💰 Mẫu dưới 1 triệu", message: "Mẫu dưới 1 triệu" },
    { label: "🛡️ Chính sách bảo hành", message: "Chính sách bảo hành" },
  ];
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Tự động cuộn xuống dưới cùng khi có tin nhắn mới hoặc đang stream
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, isStreaming]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = inputMessage.trim();
    if (!trimmed || isLoading || isStreaming || isShopLoading) return;

    sendMessage(trimmed);
    setInputMessage("");
  };

  return (
    <div className="bg-background text-on-background antialiased flex min-h-dvh flex-col">
      {/* TopAppBar */}
      {!embedded && <header className="sticky top-0 z-50 flex min-h-16 w-full items-center justify-between border-b border-outline-variant bg-surface px-4 pt-[env(safe-area-inset-top)] dark:border-outline dark:bg-surface-container-low">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="material-symbols-outlined flex size-11 items-center justify-center text-primary transition-opacity hover:opacity-80 dark:text-primary-fixed-dim"
            aria-label="Quay lại"
          >
            arrow_back
          </button>
          <h1 className="text-lg font-bold text-primary dark:text-primary-fixed-dim">
            {shop?.name || (isShopLoading ? "Đang tải shop..." : shopSlug)}
          </h1>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-primary font-bold text-sm">
            {shop?.slug ? `Shop: ${shop.slug}` : "Cuộc trò chuyện mới"}
          </span>
          <span className="text-on-surface-variant text-xs flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block animate-pulse"></span>
            Đang trực tuyến
          </span>
        </div>
      </header>}

      {/* Main Chat Canvas */}
      <main className={`flex flex-1 flex-col gap-4 overflow-y-auto bg-background p-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] ${embedded ? "text-sm" : ""}`}>
        {shopError && (
          <div
            role="alert"
            className="rounded-lg border border-error bg-error-container p-4 text-sm text-on-error-container"
          >
            <p className="font-bold">Lỗi cửa hàng:</p>
            <p>{shopError}</p>
            <button
              type="button"
              onClick={() => void retryShop()}
              disabled={isShopLoading}
              className="mt-3 min-h-11 rounded-lg border border-error px-4 font-bold disabled:opacity-50"
            >
              {isShopLoading ? "Đang thử lại..." : "Thử tải lại"}
            </button>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="ml-10 rounded-lg border border-error bg-error-container p-3 text-sm text-on-error-container"
          >
            <p>{error}</p>
            <button
              type="button"
              onClick={retryLastMessage}
              disabled={isLoading || isStreaming}
              className="mt-2 min-h-11 rounded-lg border border-error px-4 font-bold disabled:opacity-50"
            >
              {isLoading || isStreaming ? "Đang gửi lại..." : "Gửi lại tin nhắn"}
            </button>
          </div>
        )}

        {/* Trạng thái ban đầu khi chưa có tin nhắn nào */}
        {messages.length === 0 && !isShopLoading && (
          <div className="flex flex-col items-center justify-center py-12 text-center text-on-surface-variant">
            <div className="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center mb-3 border border-outline-variant">
              <span className="material-symbols-outlined text-primary text-2xl">support_agent</span>
            </div>
            <h2 className="font-bold text-base text-primary mb-1">
              Chào mừng bạn đến với {shop?.name || "SmartSales"}!
            </h2>
            <p className="text-xs max-w-xs text-on-surface-variant">
              Hãy hỏi bất kỳ thông tin nào về sản phẩm, giá bán, hoặc tư vấn mua sắm.
            </p>
          </div>
        )}

        {messages.length === 0 && shop && (
          <div className="mx-auto flex w-full max-w-3xl flex-wrap justify-center gap-2" aria-label="Gợi ý câu hỏi">
            {quickReplies.map((reply) => (
              <button
                key={reply.message}
                type="button"
                onClick={() => void sendMessage(reply.message)}
                disabled={isLoading || isStreaming}
                className="min-h-11 rounded-full border border-outline-variant bg-surface px-4 py-2 text-sm text-on-surface hover:bg-surface-container disabled:opacity-50"
              >
                {reply.label}
              </button>
            ))}
          </div>
        )}

        {/* Danh sách tin nhắn */}
        {messages.map((msg) => (
          <div key={msg.id} className="w-full flex flex-col gap-2">
            {msg.role === "user" ? (
              /* User Message Bubble */
              <div className="flex flex-col items-end gap-1 w-full">
                <div className="bg-primary-container text-on-primary p-3 rounded-lg rounded-br-none max-w-[85%] shadow-sm">
                  <p className="text-sm">{msg.content}</p>
                </div>
                <span className="text-on-surface-variant text-[10px] pr-1">
                  {new Date(msg.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ) : (
              /* Assistant Message Bubble */
              <div className="flex flex-col items-start gap-1 w-full">
                <div className="flex items-end gap-2 max-w-[85%]">
                  <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center shrink-0 border border-outline-variant">
                    <span className="material-symbols-outlined text-primary text-[18px]">
                      support_agent
                    </span>
                  </div>
                  <div className="bg-surface text-on-surface p-3 rounded-lg rounded-bl-none border border-outline-variant shadow-[0px_2px_4px_rgba(28,25,23,0.04),0px_1px_2px_rgba(28,25,23,0.02)]">
                    <ChatMarkdown content={msg.content} isStreaming={msg.isStreaming} />
                  </div>
                </div>
                <span className="text-on-surface-variant text-[10px] pl-10">
                  {new Date(msg.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>

                {/* Product Carousel — dùng StreamProductItem từ SSE, sắp đúng thứ tự nhắc tới */}
                {msg.products && msg.products.length > 0 && (
                  <div className="w-full pl-10 -mr-4 overflow-x-auto hide-scrollbar snap-x snap-mandatory flex gap-4 pb-4 pt-2">
                    {[...msg.products]
                      .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
                      .map((product: StreamProductItem, idx: number) => (
                        <ChatProductCard
                          key={product.product_id}
                          product={product}
                          displayRank={idx + 1}
                          formatCurrency={formatCurrency}
                          onProductClick={handleProductClick}
                        />
                      ))}
                  </div>
                )}

                {/* Form để lại tên/SĐT khi khách đã chọn mẫu muốn mua */}
                {msg.leadForm && !msg.isStreaming && (
                  <LeadForm onSubmit={sendMessage} disabled={isLoading || isStreaming} />
                )}

                {/* Thẻ Điều hướng Gian hàng khi có > 20 kết quả khớp */}
                {msg.openStore && !msg.isStreaming && (
                  <div className="ml-10 max-w-md rounded-xl border border-primary/40 bg-surface p-3.5 shadow-xs">
                    <p className="text-xs font-bold text-primary">
                      🛍️ Có tới {msg.openStore.totalMatches} sản phẩm phù hợp tại cửa hàng!
                    </p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      Mở gian hàng chính thức để lọc và xem trọn bộ mẫu mã đầy đủ nhất:
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {msg.openStore.links.shopee_url && (
                        <a
                          href={msg.openStore.links.shopee_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-bold text-white transition hover:opacity-90"
                        >
                          Xem trên Shopee ↗
                        </a>
                      )}
                      {msg.openStore.links.shopify_url && (
                        <a
                          href={msg.openStore.links.shopify_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white transition hover:opacity-90"
                        >
                          Xem Website / Shopify ↗
                        </a>
                      )}
                      {msg.openStore.links.catalog_url && (
                        <a
                          href={msg.openStore.links.catalog_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-primary px-3 py-1.5 text-xs font-bold text-primary transition hover:bg-surface-container-low"
                        >
                          Mở Catalog đầy đủ ↗
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Thẻ Chuyển giao Nhân viên / Chủ shop (Human Handoff) */}
                {msg.humanHandoff && !msg.isStreaming && (
                  <div className="ml-10 max-w-md rounded-xl border border-amber-300 bg-amber-50/80 p-3.5 text-amber-950 shadow-xs">
                    <p className="text-xs font-bold">
                      {msg.humanHandoff.locked
                        ? "👩‍💼 Đã kết nối trực tiếp tới Chủ Shop / Nhân viên tư vấn"
                        : "💬 Bạn cần nhân viên kiểm tra kho hoặc tư vấn riêng?"}
                    </p>
                    <p className="mt-1 text-xs text-amber-900/90">
                      {msg.humanHandoff.locked
                        ? "Thông tin hội thoại đã được gửi tới nhân viên hỗ trợ. Bạn cũng có thể nhắn trực tiếp qua kênh bên dưới:"
                        : "Bạn có thể thử gõ lại tên mẫu khác, hoặc bấm liên hệ trực tiếp với shop:"}
                    </p>
                    {(msg.humanHandoff.zaloUrl || msg.humanHandoff.hotline) && (
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {msg.humanHandoff.zaloUrl && (
                          <a
                            href={msg.humanHandoff.zaloUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-bold text-white transition hover:opacity-90"
                          >
                            Chat Zalo ngay ↗
                          </a>
                        )}
                        {msg.humanHandoff.hotline && (
                          <a
                            href={`tel:${msg.humanHandoff.hotline.replace(/\s+/g, "")}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-700 bg-white px-3 py-1.5 text-xs font-bold text-amber-900 transition hover:bg-amber-100/50"
                          >
                            📞 Gọi {msg.humanHandoff.hotline}
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Gợi ý câu hỏi tiếp nối (Suggestions) */}
                {!msg.isStreaming && msg.suggestions && msg.suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pl-10 pt-1" aria-label="Gợi ý hỏi tiếp">
                    {msg.suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => void sendMessage(suggestion)}
                        disabled={isLoading || isStreaming}
                        className="rounded-full border border-primary/40 bg-surface-container-lowest px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary-fixed/40 disabled:opacity-50"
                      >
                        ✨ {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Loading dots — khi đang chờ event meta từ backend */}
        {isLoading && (
          <div className="flex items-end gap-2 max-w-[85%]">
            <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center shrink-0 border border-outline-variant">
              <span className="material-symbols-outlined text-primary text-[18px]">
                support_agent
              </span>
            </div>
            <div className="bg-surface text-on-surface p-3 rounded-lg rounded-bl-none border border-outline-variant shadow-sm flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary animate-bounce"></span>
              <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:0.2s]"></span>
              <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:0.4s]"></span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* BottomNavBar / Composer */}
      <form
        onSubmit={handleSubmit}
        className="fixed bottom-0 z-50 flex w-full items-center justify-center border-t border-outline-variant bg-surface px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-sm dark:border-outline dark:bg-surface-container-low"
      >
        <div className="flex items-center gap-2 w-full max-w-3xl">
          <div className="relative flex-1">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              disabled={isLoading || isStreaming || isShopLoading || !shop}
              enterKeyHint="send"
              autoComplete="off"
              aria-label="Tin nhắn"
              placeholder={
                isShopLoading
                  ? "Đang kết nối shop..."
                  : isStreaming
                    ? "Đang nhận trả lời..."
                    : "Nhập tin nhắn tìm kiếm sản phẩm..."
              }
              className="min-h-11 w-full rounded-full border border-outline-variant bg-surface py-2 pl-4 pr-10 text-base text-on-surface transition-shadow focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
            />
          </div>
          <button
            type="submit"
            disabled={!inputMessage.trim() || isLoading || isStreaming || isShopLoading || !shop}
            className="flex size-11 shrink-0 flex-col items-center justify-center rounded-full bg-primary-container p-2 text-on-primary transition-transform hover:scale-95 disabled:opacity-40 disabled:hover:scale-100"
          >
            <span
              className="material-symbols-outlined text-on-primary font-bold text-[20px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              send
            </span>
            <span className="sr-only">Gửi</span>
          </button>
        </div>
      </form>
    </div>
  );
}
