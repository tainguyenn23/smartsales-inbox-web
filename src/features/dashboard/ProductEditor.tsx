"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  createProduct,
  fetchProduct,
  patchProduct,
  type ProductDetail,
  type ProductVariantDetail,
} from "@/lib/api/merchant";

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
  sku: string;
  color: string;
  size: string;
  price: string;
  quantity: string;
  status: StockStatus;
}

function toDraft(v: ProductVariantDetail): VariantDraft {
  return {
    id: v.id,
    label: Object.values(v.attributes).join(" / ") || v.name || v.sku || "Mặc định",
    sku: v.sku ?? "",
    color: v.attributes.color ?? "",
    size: v.attributes.size ?? "",
    price: v.price === null ? "" : String(Number(v.price)),
    quantity: v.stock_quantity === null ? "" : String(v.stock_quantity),
    status: v.stock_status,
  };
}

function createEmptyVariant(index: number): VariantDraft {
  return {
    id: `new-${Date.now()}-${index}`,
    label: `Phân loại ${index}`,
    sku: "",
    color: "",
    size: "",
    price: "",
    quantity: "10",
    status: "in_stock",
  };
}

/** Creates a new product (when productId is null) or edits an existing product and its variants. */
export function ProductEditor({
  token,
  shopId,
  productId,
  onClose,
  onSaved,
}: {
  token: string;
  shopId: string;
  productId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isCreate = productId === null;
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [variants, setVariants] = useState<VariantDraft[]>(() => (isCreate ? [createEmptyVariant(1)] : []));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isCreate || !productId) return;
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
  }, [token, shopId, productId, isCreate]);

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
        if (change.status === "out_of_stock" && next.quantity !== "" && Number(next.quantity) > 0) {
          next.quantity = "0";
        }
        return next;
      })
    );
  }

  function addVariant() {
    setVariants((prev) => [...prev, createEmptyVariant(prev.length + 1)]);
  }

  function removeVariant(id: string) {
    setVariants((prev) => (prev.length > 1 ? prev.filter((v) => v.id !== id) : prev));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (isCreate) {
        await createProduct(token, shopId, {
          name: name.trim(),
          category: category.trim() || null,
          description: description.trim() || null,
          image_url: imageUrl.trim() || null,
          product_url: productUrl.trim() || null,
          variants: variants.map((v) => {
            const attributes: Record<string, string> = {};
            if (v.color.trim()) attributes.color = v.color.trim();
            if (v.size.trim()) attributes.size = v.size.trim();
            return {
              name: v.label.trim() || "Mặc định",
              sku: v.sku.trim() || null,
              attributes,
              price: v.price === "" ? null : Number(v.price),
              stock_quantity: v.quantity === "" ? null : Number(v.quantity),
              stock_status: v.status,
            };
          }),
        });
      } else if (productId) {
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
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 backdrop-blur-xs p-0 sm:items-center sm:p-4">
      <form
        onSubmit={save}
        className="max-h-[92vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-t-3xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-xl sm:rounded-3xl"
      >
        <div className="flex items-center justify-between border-b border-outline-variant/40 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary-fixed text-primary">
              <span className="material-symbols-outlined text-[20px]">
                {isCreate ? "add_box" : "edit_square"}
              </span>
            </div>
            <h2 className="text-lg font-bold">
              {isCreate ? "Thêm sản phẩm mới" : "Chỉnh sửa sản phẩm"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {!isCreate && !product && !error && (
          <p className="py-6 text-center text-sm text-on-surface-variant">Đang tải thông tin sản phẩm…</p>
        )}

        {(isCreate || product) && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm sm:col-span-2">
                <span className="font-semibold">Tên sản phẩm *</span>
                <input
                  className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none"
                  placeholder="Ví dụ: Đèn bàn gốm sứ Bắc Âu"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </label>

              <label className="block text-sm">
                <span className="font-semibold">Danh mục / Nhóm hàng</span>
                <input
                  className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none"
                  placeholder="Ví dụ: Đèn bàn, Đèn ngủ..."
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </label>

              {isCreate && (
                <label className="block text-sm">
                  <span className="font-semibold">Link ảnh sản phẩm (URL)</span>
                  <input
                    type="url"
                    className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none"
                    placeholder="https://..."
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                  />
                </label>
              )}

              {isCreate && (
                <label className="block text-sm sm:col-span-2">
                  <span className="font-semibold">Link trang mua hàng / chi tiết sản phẩm (URL)</span>
                  <input
                    type="url"
                    className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none"
                    placeholder="https://shopee.vn/... hoặc link website"
                    value={productUrl}
                    onChange={(e) => setProductUrl(e.target.value)}
                  />
                </label>
              )}

              <label className="block text-sm sm:col-span-2">
                <span className="font-semibold">Mô tả chi tiết & thông số</span>
                <textarea
                  className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3.5 py-2 text-sm focus:border-primary focus:outline-none"
                  rows={3}
                  placeholder="Chất liệu, kích thước, công suất, không gian phù hợp..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
            </div>

            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">
                  Các phân loại / Biến thể ({variants.length})
                </p>
                {isCreate && (
                  <button
                    type="button"
                    onClick={addVariant}
                    className="inline-flex items-center gap-1 rounded-lg border border-primary px-2.5 py-1 text-xs font-semibold text-primary hover:bg-surface-container-low"
                  >
                    <span className="material-symbols-outlined text-[15px]">add</span>
                    Thêm phân loại
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {variants.map((v, idx) => (
                  <div
                    key={v.id}
                    className="space-y-2 rounded-2xl border border-outline-variant/50 bg-surface-container-low p-3"
                  >
                    {isCreate ? (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <input
                          className="rounded-lg border border-outline-variant bg-surface px-2.5 py-1.5 text-xs"
                          placeholder={`Tên loại (VD: Mẫu ${idx + 1})`}
                          value={v.label}
                          onChange={(e) => update(v.id, { label: e.target.value })}
                        />
                        <input
                          className="rounded-lg border border-outline-variant bg-surface px-2.5 py-1.5 text-xs"
                          placeholder="Màu sắc (VD: Kem, Đen)"
                          value={v.color}
                          onChange={(e) => update(v.id, { color: e.target.value })}
                        />
                        <input
                          className="rounded-lg border border-outline-variant bg-surface px-2.5 py-1.5 text-xs"
                          placeholder="Kích cỡ (VD: Lớn, 40cm)"
                          value={v.size}
                          onChange={(e) => update(v.id, { size: e.target.value })}
                        />
                        <div className="flex gap-1">
                          <input
                            className="w-full rounded-lg border border-outline-variant bg-surface px-2.5 py-1.5 text-xs"
                            placeholder="Mã SKU"
                            value={v.sku}
                            onChange={(e) => update(v.id, { sku: e.target.value })}
                          />
                          {variants.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeVariant(v.id)}
                              className="rounded-lg px-2 text-red-600 hover:bg-red-50"
                              title="Xóa phân loại"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>
                    ) : null}

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {!isCreate && (
                        <span className="col-span-2 self-center text-sm font-semibold sm:col-span-1">
                          {v.label}
                        </span>
                      )}
                      <label className="block text-[11px] text-on-surface-variant">
                        Giá bán (VNĐ)
                        <input
                          className="mt-0.5 w-full rounded-lg border border-outline-variant bg-surface px-2.5 py-1.5 text-sm text-on-surface"
                          type="number"
                          min={0}
                          placeholder="Trống = liên hệ"
                          value={v.price}
                          onChange={(e) => update(v.id, { price: e.target.value })}
                        />
                      </label>
                      <label className="block text-[11px] text-on-surface-variant">
                        Tồn kho
                        <input
                          className="mt-0.5 w-full rounded-lg border border-outline-variant bg-surface px-2.5 py-1.5 text-sm text-on-surface"
                          type="number"
                          min={0}
                          placeholder="Số lượng"
                          value={v.quantity}
                          onChange={(e) => update(v.id, { quantity: e.target.value })}
                        />
                      </label>
                      <label className={`block text-[11px] text-on-surface-variant ${isCreate ? "sm:col-span-2" : ""}`}>
                        Trạng thái kho
                        <select
                          className="mt-0.5 w-full rounded-lg border border-outline-variant bg-surface px-2.5 py-1.5 text-sm text-on-surface"
                          value={v.status}
                          onChange={(e) => update(v.id, { status: e.target.value as StockStatus })}
                        >
                          {Object.entries(STOCK).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-outline-variant px-4 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container"
          >
            Hủy
          </button>
          <button
            disabled={(!isCreate && !product) || saving}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-on-primary shadow-sm transition hover:bg-primary-container disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">check</span>
            {saving ? "Đang lưu…" : isCreate ? "Tạo sản phẩm" : "Lưu thay đổi"}
          </button>
        </div>
      </form>
    </div>
  );
}
