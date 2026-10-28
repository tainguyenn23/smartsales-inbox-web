"use client";

import { useEffect, useState, type FormEvent } from "react";
import { fetchProduct, patchProduct, type ProductDetail, type ProductVariantDetail } from "@/lib/api/merchant";

type StockStatus = ProductVariantDetail["stock_status"];
const STOCK: Record<StockStatus, string> = {
  in_stock: "Còn hàng",
  out_of_stock: "Hết hàng",
  preorder: "Đặt trước",
  unknown: "Chưa rõ",
};

interface VariantDraft {
  id: string;
  label: string;
  price: string;
  quantity: string;
  status: StockStatus;
}

function toDraft(v: ProductVariantDetail): VariantDraft {
  return {
    id: v.id,
    label: Object.values(v.attributes).join(" / ") || v.name || v.sku || "Mặc định",
    price: v.price === null ? "" : String(Number(v.price)),
    quantity: v.stock_quantity === null ? "" : String(v.stock_quantity),
    status: v.stock_status,
  };
}

/** Edits product fields and per-variant price/stock; variants are matched by ID. */
export function ProductEditor({
  token,
  shopId,
  productId,
  onClose,
  onSaved,
}: {
  token: string;
  shopId: string;
  productId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    fetchProduct(token, shopId, productId)
      .then((p) => {
        if (!active) return;
        setProduct(p);
        setName(p.name);
        setCategory(p.category ?? "");
        setDescription(p.description ?? "");
        setVariants(p.variants.map(toDraft));
      })
      .catch((err) => active && setError(err instanceof Error ? err.message : "Không tải được sản phẩm"));
    return () => {
      active = false;
    };
  }, [token, shopId, productId]);

  function update(id: string, change: Partial<VariantDraft>) {
    setVariants((prev) =>
      prev.map((v) => {
        if (v.id !== id) return v;
        const next = { ...v, ...change };
        // Keep quantity and status consistent, as the database requires.
        if (change.quantity !== undefined && next.quantity !== "") {
          const qty = Number(next.quantity);
          if (qty === 0 && next.status === "in_stock") next.status = "out_of_stock";
          if (qty > 0 && next.status === "out_of_stock") next.status = "in_stock";
        }
        return next;
      })
    );
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await patchProduct(token, shopId, productId, {
        name: name.trim(),
        category: category.trim() || null,
        description: description.trim() || null,
        variants: variants.map((v) => ({
          id: v.id,
          price: v.price === "" ? null : Number(v.price),
          stock_quantity: v.quantity === "" ? null : Number(v.quantity),
          stock_status: v.status,
        })),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={save}
        className="max-h-[90vh] w-full max-w-2xl space-y-3 overflow-y-auto rounded-t-3xl bg-surface-container-lowest p-5 sm:rounded-3xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Sửa sản phẩm</h2>
          <button type="button" onClick={onClose} className="text-sm text-on-surface-variant">
            Đóng
          </button>
        </div>
        {!product && !error && <p className="text-sm">Đang tải…</p>}
        {product && (
          <>
            <label className="block text-sm">
              Tên
              <input
                className="mt-1 w-full rounded-xl border border-outline-variant px-3 py-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
            <label className="block text-sm">
              Nhóm
              <input
                className="mt-1 w-full rounded-xl border border-outline-variant px-3 py-2"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Mô tả
              <textarea
                className="mt-1 w-full rounded-xl border border-outline-variant px-3 py-2"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <div className="space-y-2">
              <p className="text-sm font-semibold">Lựa chọn (giá / số lượng / tình trạng)</p>
              {variants.map((v) => (
                <div key={v.id} className="grid grid-cols-2 gap-2 rounded-2xl bg-surface-container-low p-3 sm:grid-cols-4">
                  <span className="col-span-2 self-center text-sm font-medium sm:col-span-1">{v.label}</span>
                  <input
                    className="rounded-lg border border-outline-variant px-2 py-1 text-sm"
                    type="number"
                    min={0}
                    placeholder="Giá (trống = chưa có)"
                    value={v.price}
                    onChange={(e) => update(v.id, { price: e.target.value })}
                  />
                  <input
                    className="rounded-lg border border-outline-variant px-2 py-1 text-sm"
                    type="number"
                    min={0}
                    placeholder="Số lượng"
                    value={v.quantity}
                    onChange={(e) => update(v.id, { quantity: e.target.value })}
                  />
                  <select
                    className="rounded-lg border border-outline-variant px-2 py-1 text-sm"
                    value={v.status}
                    onChange={(e) => update(v.id, { status: e.target.value as StockStatus })}
                  >
                    {Object.entries(STOCK).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </>
        )}
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button
          disabled={!product || saving}
          className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-on-primary disabled:opacity-50"
        >
          {saving ? "Đang lưu…" : "Lưu thay đổi"}
        </button>
      </form>
    </div>
  );
}
