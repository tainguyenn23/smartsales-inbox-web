"use client";

import { useState } from "react";
import Image from "next/image";
import type { StreamProductItem } from "@/types/api";

interface ChatProductCardProps {
  product: StreamProductItem;
  displayRank: number;
  formatCurrency: (price: number | string | null | undefined, currency?: string) => string;
  onProductClick: (product: StreamProductItem) => void;
}

function isRenderableImageUrl(url: string | null | undefined): string | null {
  const trimmed = (url ?? "").trim();
  if (!trimmed) return null;
  if (
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("/")
  ) {
    return trimmed;
  }
  return null;
}

function RankBadge({ rank }: { rank: number }) {
  const isFirst = rank === 1;
  return (
    <span
      className={
        isFirst
          ? "rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-amber-950 shadow-xs"
          : "rounded-full bg-surface-container-highest/95 px-2 py-0.5 text-[10px] font-semibold text-on-surface border border-outline-variant/60"
      }
    >
      #{rank}
    </span>
  );
}

export function ChatProductCard({
  product,
  displayRank,
  formatCurrency,
  onProductClick,
}: ChatProductCardProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const validImageUrl = isRenderableImageUrl(product.image_url);
  const showImage = Boolean(validImageUrl && failedSrc !== validImageUrl);
  const productUrl = product.affiliate_url ?? product.product_url;
  const firstVariantPrice = product.variants?.[0]?.price;

  return (
    <article className="snap-center shrink-0 w-[85%] max-w-70 bg-surface border border-outline-variant rounded-lg overflow-hidden flex flex-col shadow-[0px_2px_4px_rgba(28,25,23,0.04),0px_1px_2px_rgba(28,25,23,0.02)]">
      {showImage && validImageUrl ? (
        <div className="relative w-full aspect-4/3 bg-surface-container-high">
          <Image
            src={validImageUrl}
            alt={product.name}
            fill
            unoptimized
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover"
            onError={() => setFailedSrc(validImageUrl)}
          />
          <div className="absolute top-2 right-2">
            <RankBadge rank={displayRank} />
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 border-b border-outline-variant/60 bg-gradient-to-br from-surface-container-low via-surface-container to-surface-container-high px-3 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-outline-variant/70 bg-surface text-primary shadow-2xs">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-4"
                aria-hidden="true"
              >
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                <path d="M3 6h18" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
            </div>
            <span className="truncate text-[11px] font-medium text-on-surface-variant">
              {product.category?.trim() || "Sản phẩm tại shop"}
            </span>
          </div>
          <RankBadge rank={displayRank} />
        </div>
      )}

      <div className="p-3 flex flex-col gap-2 flex-1">
        <h3 className="text-sm font-bold text-on-surface line-clamp-2" title={product.name}>
          {product.name}
        </h3>

        {product.variants && product.variants.length > 0 && (
          <p className="text-sm text-primary font-bold">
            {formatCurrency(firstVariantPrice, product.currency)}
            {product.variants.length > 1 && (
              <span className="text-xs text-on-surface-variant font-normal ml-1">
                và {product.variants.length - 1} loại khác
              </span>
            )}
          </p>
        )}

        {product.variants && product.variants.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {product.variants.slice(0, 3).map((variant, vIdx) => (
              <div
                key={variant.id || vIdx}
                className="w-full rounded border border-outline-variant bg-surface-container px-2 py-1 text-[10px] text-on-surface-variant"
              >
                <span className="font-semibold">
                  {Object.entries(variant.attributes || {})
                    .map(([key, value]) => `${key}: ${value}`)
                    .join(" · ") || variant.name || `Loại ${vIdx + 1}`}
                </span>
                {variant.price && (
                  <span>
                    {" "}
                    · {formatCurrency(variant.price, product.currency)}
                  </span>
                )}
              </div>
            ))}
            {product.variants.length > 3 && (
              <span className="text-[10px] text-on-surface-variant">
                +{product.variants.length - 3} loại
              </span>
            )}
          </div>
        )}

        <div className="mt-auto pt-3 flex gap-2">
          <button
            type="button"
            onClick={() => onProductClick(product)}
            disabled={!productUrl}
            className="min-h-11 flex-1 rounded-lg border border-primary bg-surface px-2 text-center text-xs font-bold text-primary transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50"
          >
            Xem Chi Tiết
          </button>
          <button
            type="button"
            onClick={() => onProductClick(product)}
            disabled={!productUrl}
            className="min-h-11 flex-1 rounded-lg bg-primary-container px-2 text-center text-xs font-bold text-on-primary transition-colors hover:bg-[#053e2f] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Mua Ngay
          </button>
        </div>
      </div>
    </article>
  );
}
