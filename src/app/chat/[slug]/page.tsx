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

  const { shop, isShopLoading, shopError, messages, isLoading, sendMessage, handleProductClick } =
    useChatDemo(shopSlug);

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
    <div className="bg-background text-on-background antialiased flex flex-col min-h-screen">
      {/* TopAppBar */}
      <header className="flex justify-between items-center w-full px-4 h-16 sticky top-0 z-50 bg-surface dark:bg-surface-container-low border-b border-outline-variant dark:border-outline">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="material-symbols-outlined text-primary dark:text-primary-fixed-dim hover:opacity-80 transition-opacity"
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
      <main className="flex-1 p-4 flex flex-col gap-4 bg-background overflow-y-auto pb-24">
        {shopError && (
          <div className="p-4 bg-error-container text-on-error-container rounded-lg text-sm border border-error">
            <p className="font-bold">Lỗi cửa hàng:</p>
            <p>{shopError}</p>
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
                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                className="object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-outline">
                              <span className="material-symbols-outlined text-4xl">image</span>
                            </div>
                          )}
                          <div className="absolute top-2 left-2 bg-[#dcfce7] text-[#166534] px-2 py-1 rounded-full border border-[#bbf7d0] flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">
                              {product.availability === "in_stock" ? "check_circle" : "inventory_2"}
                            </span>
                            <span className="text-[10px] font-bold uppercase">
                              {product.availability === "in_stock"
                                ? "Sẵn Hàng"
                                : product.availability === "preorder"
                                  ? "Đặt Trước"
                                  : "Hết Hàng"}
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
                              {product.variants_preview.slice(0, 3).map((v, vIdx) => (
                                <span
                                  key={vIdx}
                                  className="text-[10px] bg-surface-container border border-outline-variant px-1.5 py-0.5 rounded text-on-surface-variant"
                                >
                                  {Object.values(v.attributes || {}).join(" - ") ||
                                    `Loại ${vIdx + 1}`}
                                </span>
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
                              className="flex-1 bg-surface border border-primary text-primary font-bold text-xs py-2 rounded-lg hover:bg-surface-container-low transition-colors text-center"
                            >
                              Xem Chi Tiết
                            </button>
                            <button
                              type="button"
                              onClick={() => handleProductClick(product)}
                              className="flex-1 bg-primary-container text-on-primary font-bold text-xs py-2 rounded-lg hover:bg-[#053e2f] transition-colors text-center"
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
        className="fixed bottom-0 w-full z-50 flex items-center justify-center p-3 bg-surface dark:bg-surface-container-low border-t border-outline-variant dark:border-outline shadow-sm"
      >
        <div className="flex items-center gap-2 w-full max-w-3xl">
          <div className="relative flex-1">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              disabled={isLoading || isShopLoading}
              placeholder={
                isShopLoading ? "Đang kết nối shop..." : "Nhập tin nhắn tìm kiếm sản phẩm..."
              }
              className="w-full bg-surface border border-outline-variant rounded-full py-2 pl-4 pr-10 text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-shadow disabled:opacity-50"
            />
          </div>
          <button
            type="submit"
            disabled={!inputMessage.trim() || isLoading || isShopLoading}
            className="p-2 bg-primary-container text-on-primary rounded-full flex shrink-0 hover:scale-95 transition-transform flex-col items-center justify-center h-10 w-10 disabled:opacity-40 disabled:hover:scale-100"
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
