"use client";

import { use, useState, useRef, useEffect, type FormEvent } from "react";
import { useChatDemo } from "@/features/chat/hooks/useChatDemo";
import type { ProductCard } from "@/types/api";
import Image from "next/image";

interface ChatPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Helper định dạng tiền tệ an toàn từ chuỗi Decimal
 */
function formatCurrency(priceStr: string | null | undefined, currency = "VND"): string {
  if (!priceStr) return "";
  const numericPrice = parseFloat(priceStr);
  if (isNaN(numericPrice)) return priceStr;

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
    error,
    sendMessage,
    retryLastMessage,
    retryShop,
    handleProductClick,
  } = useChatDemo(shopSlug);

  const [inputMessage, setInputMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Tự động cuộn xuống dưới cùng khi có tin nhắn mới hoặc đang chờ câu trả lời
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = inputMessage.trim();
    if (!trimmed || isLoading || isShopLoading) return;

    sendMessage(trimmed);
    setInputMessage("");
  };

  return (
    <div className="bg-background text-on-background antialiased flex min-h-dvh flex-col">
      {/* TopAppBar */}
      <header className="sticky top-0 z-50 flex min-h-16 w-full items-center justify-between border-b border-outline-variant bg-surface px-4 pt-[env(safe-area-inset-top)] dark:border-outline dark:bg-surface-container-low">
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
      </header>

      {/* Main Chat Canvas */}
      <main className="flex flex-1 flex-col gap-4 overflow-y-auto bg-background p-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
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
              disabled={isLoading}
              className="mt-2 min-h-11 rounded-lg border border-error px-4 font-bold disabled:opacity-50"
            >
              {isLoading ? "Đang gửi lại..." : "Gửi lại tin nhắn"}
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

        {/* Danh sách tin nhắn động từ hook */}
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
                  <div className="bg-surface text-on-surface p-3 rounded-lg rounded-bl-none border border-outline-variant shadow-[0px_2px_4px_rgba(28,25,23,0.04),_0px_1px_2px_rgba(28,25,23,0.02)]">
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
                <span className="text-on-surface-variant text-[10px] pl-10">
                  {new Date(msg.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>

                {/* Product Carousel (nếu AI trả lời kèm danh sách sản phẩm) */}
                {msg.products && msg.products.length > 0 && (
                  <div className="w-full pl-10 -mr-4 overflow-x-auto hide-scrollbar snap-x snap-mandatory flex gap-4 pb-4 pt-2">
                    {msg.products.map((product: ProductCard) => (
                      <article
                        key={product.id}
                        className="snap-center shrink-0 w-[85%] max-w-[280px] bg-surface border border-outline-variant rounded-lg overflow-hidden flex flex-col shadow-[0px_2px_4px_rgba(28,25,23,0.04),_0px_1px_2px_rgba(28,25,23,0.02)]"
                      >
                        <div className="relative w-full aspect-[4/3] bg-surface-container-high">
                          {product.image_url ? (
                            <div className="relative w-full h-full">
                              <Image
                                src={product.image_url}
                                alt={product.name}
                                fill
                                unoptimized
                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                className="object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-outline">
                              <span className="material-symbols-outlined text-4xl">image</span>
                            </div>
                          )}
                          <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full border border-[#bbf7d0] bg-[#dcfce7] px-2 py-1 text-[#166534]">
                            <span className="material-symbols-outlined text-[14px]">
                              {product.availability === "in_stock" ? "check_circle" : "inventory_2"}
                            </span>
                            <span className="text-[10px] font-bold uppercase">
                              {product.availability === "in_stock"
                                ? "Sẵn Hàng"
                                : product.availability === "preorder"
                                  ? "Đặt Trước"
                                  : product.availability === "out_of_stock"
                                    ? "Hết Hàng"
                                    : "Chưa rõ tồn kho"}
                            </span>
                          </div>
                        </div>

                        <div className="p-3 flex flex-col gap-2 flex-1">
                          <h3 className="text-sm font-bold text-on-surface line-clamp-1">
                            {product.name}
                          </h3>
                          <p className="text-sm text-primary font-bold">
                            {formatCurrency(product.min_price, product.currency)}
                            {product.max_price && product.max_price !== product.min_price && (
                              <span className="text-xs text-on-surface-variant font-normal ml-1">
                                - {formatCurrency(product.max_price, product.currency)}
                              </span>
                            )}
                          </p>

                          {/* Preview các thuộc tính biến thể nếu có */}
                          {product.variants_preview && product.variants_preview.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap">
                              {product.variants_preview.slice(0, 3).map((variant, vIdx) => (
                                <div
                                  key={vIdx}
                                  className="w-full rounded border border-outline-variant bg-surface-container px-2 py-1 text-[10px] text-on-surface-variant"
                                >
                                  <span className="font-semibold">
                                    {Object.entries(variant.attributes || {})
                                      .map(([key, value]) => `${key}: ${value}`)
                                      .join(" · ") || `Loại ${vIdx + 1}`}
                                  </span>
                                  {variant.price && (
                                    <span>
                                      {" "}
                                      · {formatCurrency(variant.price, product.currency)}
                                    </span>
                                  )}
                                </div>
                              ))}
                              {product.variants_preview.length > 3 && (
                                <span className="text-[10px] text-on-surface-variant">
                                  +{product.variants_preview.length - 3} loại
                                </span>
                              )}
                            </div>
                          )}

                          {product.reason && (
                            <div className="mt-1 bg-surface-container-low p-2 rounded border border-outline-variant border-dashed">
                              <p className="text-on-surface-variant text-[11px] leading-tight">
                                <span className="font-bold text-primary">Lý do gợi ý:</span>{" "}
                                {product.reason}
                              </p>
                            </div>
                          )}

                          <div className="mt-auto pt-3 flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleProductClick(product)}
                              disabled={!product.url}
                              className="min-h-11 flex-1 rounded-lg border border-primary bg-surface px-2 text-center text-xs font-bold text-primary transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Xem Chi Tiết
                            </button>
                            <button
                              type="button"
                              onClick={() => handleProductClick(product)}
                              disabled={!product.url}
                              className="min-h-11 flex-1 rounded-lg bg-primary-container px-2 text-center text-xs font-bold text-on-primary transition-colors hover:bg-[#053e2f] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Mua Ngay
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Loading Indicator khi trợ lý đang sinh câu trả lời */}
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
              disabled={isLoading || isShopLoading || !shop}
              enterKeyHint="send"
              autoComplete="off"
              aria-label="Tin nhắn"
              placeholder={
                isShopLoading ? "Đang kết nối shop..." : "Nhập tin nhắn tìm kiếm sản phẩm..."
              }
              className="min-h-11 w-full rounded-full border border-outline-variant bg-surface py-2 pl-4 pr-10 text-base text-on-surface transition-shadow focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
            />
          </div>
          <button
            type="submit"
            disabled={!inputMessage.trim() || isLoading || isShopLoading || !shop}
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
