"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { ApiError } from "@/lib/api/client";
import {
  createShop,
  deleteProduct,
  fetchConversations,
  fetchLeads,
  fetchMe,
  fetchMessages,
  fetchProducts,
  fetchStats,
  fetchUnmetDemand,
  importProductFile,
  login,
  loginWithGoogle,
  patchProduct,
  registerMerchant,
  updateLeadStatus,
  type ConversationMessage,
  type ConversationSummary,
  type ImportResult,
  type Lead,
  type LeadStatus,
  type MerchantShop,
  type Page,
  type ProductListItem,
  type ShopStats,
  type UnmetDemandItem,
} from "@/lib/api/merchant";
import { ProductEditor } from "./ProductEditor";
import { SettingsTab } from "./SettingsTab";

const TOKEN_KEY = "smartsales.merchant.token";
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

const TABS: readonly [string, string, string][] = [
  ["overview", "Tổng quan", "analytics"],
  ["products", "Sản phẩm", "inventory_2"],
  ["conversations", "Hội thoại", "forum"],
  ["leads", "Khách chốt đơn (Leads)", "contact_phone"],
  ["unmet", "Nhu cầu chưa đáp ứng", "travel_explore"],
  ["settings", "Cài đặt", "tune"],
] as const;
type Tab = (typeof TABS)[number][0];

const LEAD_STATUS: Record<LeadStatus, string> = {
  new: "Mới",
  contacted: "Đã liên hệ",
  won: "Đã chốt đơn",
  lost: "Không chốt",
};

const LEAD_BADGE_CLASS: Record<LeadStatus, string> = {
  new: "bg-amber-100 text-amber-900 border-amber-300",
  contacted: "bg-sky-100 text-sky-900 border-sky-300",
  won: "bg-emerald-100 text-emerald-900 border-emerald-300",
  lost: "bg-stone-200 text-stone-700 border-stone-300",
};

const AVAILABILITY_LABEL: Record<string, { text: string; className: string }> = {
  in_stock: { text: "Còn hàng", className: "bg-emerald-100 text-emerald-800" },
  out_of_stock: { text: "Hết hàng", className: "bg-red-100 text-red-800" },
  preorder: { text: "Đặt trước", className: "bg-amber-100 text-amber-800" },
  unknown: { text: "Chưa rõ kho", className: "bg-stone-200 text-stone-700" },
};

const TOKEN_EVENT = "smartsales-token";
let memoryToken: string | null = null;

function readToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY) ?? memoryToken;
  } catch {
    return memoryToken;
  }
}

function writeToken(token: string | null) {
  memoryToken = token;
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Private mode fallback
  }
  window.dispatchEvent(new Event(TOKEN_EVENT));
}

function subscribeToken(onChange: () => void) {
  window.addEventListener(TOKEN_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(TOKEN_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function slugifyVietnamese(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function money(value: string | number | null, currency = "VND") {
  if (value === null || value === "") return "Liên hệ";
  const amount = Number(value);
  if (Number.isNaN(amount)) return String(value);
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

function when(value: string | null) {
  return value ? new Date(value).toLocaleString("vi-VN") : "—";
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Đã có lỗi xảy ra";
}

function useLoad<T>(load: () => Promise<T>, onUnauthorized: () => void, deps: unknown[]) {
  const [version, setVersion] = useState(0);
  const key = JSON.stringify([...deps, version]);
  const [state, setState] = useState<{ key: string | null; data: T | null; error: string | null }>({
    key: null,
    data: null,
    error: null,
  });
  useEffect(() => {
    let active = true;
    load()
      .then((data) => active && setState({ key, data, error: null }))
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiError && err.status === 401) onUnauthorized();
        else setState({ key, data: null, error: errorText(err) });
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return {
    data: state.data,
    error: state.key === key ? state.error : null,
    loading: state.key !== key,
    reload,
  };
}

function Card({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-on-surface">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-on-surface-variant">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Status({ loading, error, empty, emptyText }: { loading: boolean; error: string | null; empty?: boolean; emptyText?: string }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-on-surface-variant">
        <span className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        Đang tải dữ liệu…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-700">
        {error}
      </div>
    );
  }
  if (empty) {
    return (
      <div className="rounded-2xl border border-dashed border-outline-variant/60 py-10 text-center text-sm text-on-surface-variant">
        {emptyText ?? "Chưa có dữ liệu."}
      </div>
    );
  }
  return null;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

function AuthScreen({ onLogin }: { onLogin: (token: string) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [shopName, setShopName] = useState("");
  const [shopSlug, setShopSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const scriptId = "google-gsi-client";
    const initGoogle = () => {
      const container = document.getElementById("google-signin-button");
      if (!window.google || !container) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          if (!response.credential) return;
          setBusy(true);
          setError(null);
          try {
            const res = await loginWithGoogle({
              id_token: response.credential,
              shop_name: shopName.trim() || undefined,
              shop_slug: shopSlug.trim() || undefined,
            });
            onLogin(res.access_token);
          } catch (err) {
            setError(errorText(err));
          } finally {
            setBusy(false);
          }
        },
      });
      window.google.accounts.id.renderButton(container, {
        theme: "outline",
        size: "large",
        width: 340,
        text: "continue_with",
        shape: "pill",
      });
    };

    if (document.getElementById(scriptId)) {
      initGoogle();
      return;
    }
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = initGoogle;
    document.head.appendChild(script);
  }, [onLogin, shopName, shopSlug]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") {
        const result = await login(email, password);
        onLogin(result.access_token);
      } else {
        const result = await registerMerchant({
          email,
          password,
          display_name: displayName.trim() || null,
          shop_name: shopName.trim() || null,
          shop_slug: shopSlug.trim() || null,
        });
        onLogin(result.access_token);
      }
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? "Sai email hoặc mật khẩu"
          : errorText(err)
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col justify-center bg-surface px-4 py-10 text-on-surface">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Về trang chủ
          </Link>
          <span className="rounded-full bg-primary-fixed px-3 py-1 text-xs font-bold text-primary">
            SmartSales Portal
          </span>
        </div>

        <div className="overflow-hidden rounded-3xl border border-outline-variant/60 bg-surface-container-lowest shadow-[0_20px_60px_rgba(0,53,39,0.08)]">
          {/* Chuyển đổi Đăng nhập / Đăng ký */}
          <div className="grid grid-cols-2 border-b border-outline-variant/40 bg-surface-container-low p-1.5">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={`rounded-2xl py-2.5 text-sm font-bold transition ${
                mode === "login"
                  ? "bg-surface-container-lowest text-primary shadow-xs"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError(null);
              }}
              className={`rounded-2xl py-2.5 text-sm font-bold transition ${
                mode === "register"
                  ? "bg-surface-container-lowest text-primary shadow-xs"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Đăng ký mở Shop
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4 p-6 sm:p-7">
            <div>
              <h1 className="text-2xl font-bold text-on-surface">
                {mode === "login" ? "Chào mừng chủ shop trở lại" : "Tạo tài khoản & Mở Shop mới"}
              </h1>
              <p className="mt-1 text-xs text-on-surface-variant">
                {mode === "login"
                  ? "Đăng nhập để quản lý catalog sản phẩm, xem hội thoại và khách chốt đơn."
                  : "Chỉ mất 30 giây để khởi tạo trợ lý bán hàng theo danh mục sản phẩm riêng của bạn."}
              </p>
            </div>

            {mode === "register" && (
              <label className="block text-xs font-semibold text-on-surface">
                Họ tên của bạn
                <input
                  className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3.5 py-2.5 text-sm font-normal focus:border-primary focus:outline-none"
                  placeholder="Ví dụ: Nguyễn Tài"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </label>
            )}

            <label className="block text-xs font-semibold text-on-surface">
              Địa chỉ Email *
              <input
                className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3.5 py-2.5 text-sm font-normal focus:border-primary focus:outline-none"
                type="email"
                placeholder="you@shop.vn"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
              />
            </label>

            <label className="block text-xs font-semibold text-on-surface">
              Mật khẩu {mode === "register" ? "(tối thiểu 8 ký tự) *" : "*"}
              <input
                className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3.5 py-2.5 text-sm font-normal focus:border-primary focus:outline-none"
                type="password"
                minLength={mode === "register" ? 8 : 1}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </label>

            {mode === "register" && (
              <div className="space-y-3 rounded-2xl border border-outline-variant/50 bg-surface-container-low p-3.5">
                <p className="text-xs font-bold text-primary">
                  Thông tin Shop đầu tiên (tùy chọn, có thể tạo sau)
                </p>
                <label className="block text-xs font-semibold text-on-surface">
                  Tên cửa hàng
                  <input
                    className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm font-normal focus:border-primary focus:outline-none"
                    placeholder="Ví dụ: Thời Trang Minh Anh"
                    value={shopName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setShopName(val);
                      if (!slugTouched) setShopSlug(slugifyVietnamese(val));
                    }}
                  />
                </label>
                {shopName.trim() && (
                  <label className="block text-xs font-semibold text-on-surface">
                    Đường dẫn trang Chat (`slug`)
                    <input
                      className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 font-mono text-xs font-normal focus:border-primary focus:outline-none"
                      pattern="^[a-z0-9-]+$"
                      placeholder="thoi-trang-minh-anh"
                      value={shopSlug}
                      onChange={(e) => {
                        setSlugTouched(true);
                        setShopSlug(e.target.value.toLowerCase());
                      }}
                    />
                  </label>
                )}
              </div>
            )}

            {error && (
              <div className="rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
                {error}
              </div>
            )}

            <button
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-on-primary shadow-sm transition hover:bg-primary-container disabled:opacity-60"
              disabled={busy}
            >
              {busy
                ? "Đang xử lý…"
                : mode === "login"
                  ? "Đăng nhập vào Dashboard"
                  : "Đăng ký & Bắt đầu ngay"}
            </button>

            <div className="relative flex items-center py-1">
              <div className="grow border-t border-outline-variant/50" />
              <span className="mx-3 shrink text-[11px] uppercase tracking-wider text-on-surface-variant">
                Hoặc tiếp tục với
              </span>
              <div className="grow border-t border-outline-variant/50" />
            </div>

            {GOOGLE_CLIENT_ID ? (
              <div id="google-signin-button" className="flex justify-center" />
            ) : (
              <button
                type="button"
                onClick={() =>
                  setError(
                    "Để bật đăng nhập Google 1-chạm, hãy thêm biến NEXT_PUBLIC_GOOGLE_CLIENT_ID trên Vercel và GOOGLE_CLIENT_ID trên Render."
                  )
                }
                className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-outline-variant bg-surface px-4 py-2.5 text-sm font-semibold text-on-surface transition hover:bg-surface-container-low"
              >
                <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.3 0 6.08-1.09 8.1-2.96l-3.88-3.05c-1.1.74-2.5 1.18-4.22 1.18-3.25 0-6-2.19-6.98-5.14H1.01v3.14C3.02 21.16 7.21 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.02 14.03c-.25-.74-.39-1.54-.39-2.36s.14-1.62.39-2.36V6.17H1.01A11.99 11.99 0 0 0 0 11.67c0 1.93.46 3.75 1.01 5.5l4.01-3.14Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.8 0 3.41.62 4.68 1.84l3.51-3.51C18.07 1.19 15.3 0 12 0 7.21 0 3.02 2.84 1.01 6.83l4.01 3.14c.98-2.95 3.73-5.22 6.98-5.22Z"
                  />
                </svg>
                Đăng nhập bằng Google
              </button>
            )}
          </form>
        </div>
      </div>
    </main>
  );
}

function CreateShopModal({
  token,
  onClose,
  onCreated,
}: {
  token: string;
  onClose?: () => void;
  onCreated: (shop: { id: string; name: string; slug: string }) => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await createShop(token, { name: name.trim(), slug: slug.trim() });
      onCreated(created);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs">
      <form
        onSubmit={submit}
        className="w-full max-w-md space-y-4 rounded-3xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-outline-variant/40 pb-3">
          <h2 className="text-lg font-bold">Khởi tạo Cửa hàng mới</h2>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          )}
        </div>

        <label className="block text-sm">
          <span className="font-semibold">Tên cửa hàng *</span>
          <input
            required
            className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none"
            placeholder="Ví dụ: Đèn Decor Yuki"
            value={name}
            onChange={(e) => {
              const val = e.target.value;
              setName(val);
              if (!slugTouched) setSlug(slugifyVietnamese(val));
            }}
          />
        </label>

        <label className="block text-sm">
          <span className="font-semibold">Mã đường dẫn (Slug) *</span>
          <input
            required
            pattern="^[a-z0-9-]+$"
            className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3.5 py-2.5 font-mono text-sm focus:border-primary focus:outline-none"
            placeholder="den-decor-yuki"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value.toLowerCase());
            }}
          />
          <span className="mt-1 block text-xs text-on-surface-variant">
            Khách hàng sẽ chat tại: <code>/chat/{slug || "ten-shop"}</code>
          </span>
        </label>

        {error && <p className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-outline-variant px-4 py-2.5 text-sm font-semibold"
            >
              Hủy
            </button>
          )}
          <button
            disabled={busy || !name.trim() || !slug.trim()}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary disabled:opacity-50"
          >
            {busy ? "Đang tạo…" : "Tạo cửa hàng"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Overview({ token, shopId, logout }: TabProps) {
  const { data, error, loading } = useLoad<ShopStats>(() => fetchStats(token, shopId), logout, [token, shopId]);
  const tiles: { label: string; value: number | string; icon: string; desc: string }[] = data
    ? [
        { label: "Tổng hội thoại", value: data.conversations, icon: "forum", desc: "Khách đã nhắn tin" },
        { label: "Tin nhắn khách", value: data.customer_messages, icon: "chat_bubble", desc: "Lượt câu hỏi nhận vào" },
        {
          label: "Xử lý bằng SQL (0 tốn AI)",
          value: data.assistant_replies
            ? `${Math.round((data.replies_without_ai / data.assistant_replies) * 100)}%`
            : "100%",
          icon: "bolt",
          desc: `${data.replies_without_ai}/${data.assistant_replies} câu trả lời tức thì`,
        },
        { label: "Lượt gọi Gemini AI", value: data.ai_calls, icon: "auto_awesome", desc: "Chỉ dùng khi tư vấn/so sánh" },
        { label: "Câu hỏi chưa có SP", value: data.no_result_replies, icon: "search_off", desc: "Xem chi tiết ở tab Nhu cầu" },
        { label: "Khách để lại SĐT (Leads)", value: data.leads, icon: "contact_phone", desc: "Cơ hội chốt đơn" },
      ]
    : [];
  return (
    <Card
      title={`Báo cáo hoạt động ${data ? `(${data.days} ngày gần nhất)` : ""}`}
      subtitle="Theo dõi hiệu quả tư vấn tự động của trợ lý bán hàng Catalog-First"
    >
      <Status loading={loading} error={error} />
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="flex items-start justify-between rounded-2xl border border-outline-variant/40 bg-surface-container-low p-4"
          >
            <div>
              <p className="text-xs font-semibold text-on-surface-variant">{t.label}</p>
              <p className="mt-1.5 text-2xl font-bold text-on-surface">{t.value}</p>
              <p className="mt-1 text-[11px] text-on-surface-variant">{t.desc}</p>
            </div>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-fixed text-primary">
              <span className="material-symbols-outlined text-[20px]">{t.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {data && data.top_products.length > 0 && (
        <div className="mt-6 rounded-2xl border border-outline-variant/40 bg-surface p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
            <span className="material-symbols-outlined text-[18px] text-primary">workspace_premium</span>
            Top sản phẩm được khách hỏi & giới thiệu nhiều nhất
          </h3>
          <div className="divide-y divide-outline-variant/30">
            {data.top_products.map((p, idx) => (
              <div key={p.product_id} className="flex items-center justify-between py-2.5 text-sm">
                <div className="flex items-center gap-3">
                  <span className="flex size-6 items-center justify-center rounded-full bg-primary-fixed text-xs font-bold text-primary">
                    {idx + 1}
                  </span>
                  <span className="font-medium">{p.name}</span>
                </div>
                <span className="rounded-full bg-surface-container-high px-3 py-0.5 text-xs font-semibold">
                  {p.times_shown} lần hiển thị
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function Products({ token, shopId, logout }: TabProps) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [activeOnly, setActiveOnly] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | "create" | null>(null);

  const { data, error, loading, reload } = useLoad(
    () => fetchProducts(token, shopId, page, query, { inStock: inStockOnly, activeOnly }),
    logout,
    [token, shopId, page, query, inStockOnly, activeOnly]
  );

  async function upload(file: File | undefined) {
    if (!file) return;
    setImporting(true);
    setImportError(null);
    setResult(null);
    try {
      setResult(await importProductFile(token, shopId, file));
      reload();
    } catch (err) {
      setImportError(errorText(err));
    } finally {
      setImporting(false);
    }
  }

  async function toggleVisible(product: ProductListItem) {
    const status = product.status === "active" ? "inactive" : "active";
    await patchProduct(token, shopId, product.id, { status }).catch((err) => setImportError(errorText(err)));
    reload();
  }

  async function handleDelete(product: ProductListItem) {
    if (!window.confirm(`Bạn có chắc muốn xóa hẳn sản phẩm "${product.name}"?`)) return;
    try {
      await deleteProduct(token, shopId, product.id);
      reload();
    } catch (err) {
      setImportError(errorText(err));
    }
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / 20)) : 1;
  return (
    <Card
      title={`Danh mục Sản phẩm${data ? ` (${data.total})` : ""}`}
      subtitle="Dữ liệu gốc để trợ lý báo giá, kiểm tra tồn kho và hiển thị thẻ mua hàng"
      action={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setEditing("create")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-primary bg-surface px-3.5 py-2 text-xs font-bold text-primary transition hover:bg-surface-container-low"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Thêm sản phẩm
          </button>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-on-primary shadow-xs transition hover:bg-primary-container">
            <span className="material-symbols-outlined text-[16px]">upload_file</span>
            {importing ? "Đang import…" : "Import CSV / Excel"}
            <input
              type="file"
              accept=".csv,.xlsx"
              className="hidden"
              disabled={importing}
              onChange={(e) => {
                upload(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      }
    >
      {result && (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-sm">
          <p className="font-semibold text-emerald-900">
            Import hoàn tất: Tạo mới {result.created} · Cập nhật {result.updated} · Lỗi {result.failed}
          </p>
          {result.errors.slice(0, 5).map((e) => (
            <p key={`${e.row_number}-${e.reason}`} className="mt-1 text-xs text-red-700">
              • Dòng {e.row_number}: {e.reason}
            </p>
          ))}
        </div>
      )}
      {importError && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{importError}</div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-surface-container-low px-4 py-2.5 text-xs text-on-surface-variant">
        <span>
          Mẹo: Tải{" "}
          <a className="font-semibold text-primary underline" href="/templates/san-pham-mau.csv" download>
            file CSV mẫu chuẩn
          </a>{" "}
          để nhập nhanh hàng trăm sản phẩm & biến thể màu/size.
        </span>
        <div className="flex items-center gap-4">
          <label className="flex cursor-pointer items-center gap-1.5 font-medium text-on-surface">
            <input
              type="checkbox"
              className="accent-primary"
              checked={inStockOnly}
              onChange={(e) => {
                setPage(1);
                setInStockOnly(e.target.checked);
              }}
            />
            Chỉ còn hàng
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 font-medium text-on-surface">
            <input
              type="checkbox"
              className="accent-primary"
              checked={activeOnly}
              onChange={(e) => {
                setPage(1);
                setActiveOnly(e.target.checked);
              }}
            />
            Chỉ đang bán
          </label>
        </div>
      </div>

      {editing && (
        <ProductEditor
          token={token}
          shopId={shopId}
          productId={editing === "create" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={reload}
        />
      )}

      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQuery(search.trim());
        }}
      >
        <input
          className="flex-1 rounded-xl border border-outline-variant bg-surface px-3.5 py-2 text-sm focus:border-primary focus:outline-none"
          placeholder="Tìm theo tên sản phẩm, mô tả hoặc từ khóa…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant bg-surface px-4 py-2 text-sm font-semibold hover:bg-surface-container-low">
          <span className="material-symbols-outlined text-[18px]">search</span>
          Tìm kiếm
        </button>
      </form>

      <Status
        loading={loading}
        error={error}
        empty={data?.items.length === 0}
        emptyText="Chưa có sản phẩm nào trong shop. Hãy bấm '+ Thêm sản phẩm' hoặc 'Import CSV / Excel'."
      />

      {data && data.items.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-outline-variant/50">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-container-low text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              <tr>
                <th className="px-4 py-3">Sản phẩm</th>
                <th className="px-4 py-3">Danh mục</th>
                <th className="px-4 py-3">Giá bán</th>
                <th className="px-4 py-3">Kho hàng</th>
                <th className="px-4 py-3">Hiển thị</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/40">
              {data.items.map((p: ProductListItem) => {
                const avail = AVAILABILITY_LABEL[p.availability] ?? {
                  text: p.availability,
                  className: "bg-stone-100 text-stone-700",
                };
                return (
                  <tr key={p.id} className="transition hover:bg-surface-container-low/50">
                    <td className="px-4 py-3 font-semibold text-on-surface">{p.name}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{p.category ?? "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium">
                      {money(p.min_price, p.currency)}
                      {p.max_price !== p.min_price ? ` – ${money(p.max_price, p.currency)}` : ""}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${avail.className}`}>
                        {avail.text}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          p.status === "active"
                            ? "bg-primary-fixed text-primary"
                            : "bg-stone-200 text-stone-600"
                        }`}
                      >
                        {p.status === "active" ? "Đang bán" : "Đã ẩn"}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => setEditing(p.id)}
                        className="mr-3 text-primary hover:underline"
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleVisible(p)}
                        className="mr-3 text-on-surface-variant hover:underline"
                      >
                        {p.status === "active" ? "Ẩn" : "Hiện"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(p)}
                        className="text-red-600 hover:underline"
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-xs text-on-surface-variant">
            Trang {page} / {pages} (Tổng {data?.total} sản phẩm)
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="rounded-xl border border-outline-variant px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
            >
              ← Trang trước
            </button>
            <button
              disabled={page >= pages}
              onClick={() => setPage(page + 1)}
              className="rounded-xl border border-outline-variant px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
            >
              Trang sau →
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

function Conversations({ token, shopId, logout }: TabProps) {
  const [selected, setSelected] = useState<ConversationSummary | null>(null);
  const list = useLoad<Page<ConversationSummary>>(() => fetchConversations(token, shopId), logout, [token, shopId]);
  const thread = useLoad<ConversationMessage[]>(
    () => (selected ? fetchMessages(token, shopId, selected.id) : Promise.resolve([])),
    logout,
    [token, shopId, selected?.id]
  );
  const messages = thread.loading ? null : thread.data;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <Card
        title={`Danh sách Hội thoại${list.data ? ` (${list.data.total})` : ""}`}
        subtitle="Bấm vào từng khách để xem chi tiết nội dung bot đã tư vấn"
      >
        <Status
          loading={list.loading}
          error={list.error}
          empty={list.data?.items.length === 0}
          emptyText="Chưa có cuộc trò chuyện nào từ khách hàng."
        />
        <ul className="space-y-2">
          {list.data?.items.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => setSelected(c)}
                className={`w-full rounded-2xl border p-3.5 text-left text-sm transition ${
                  selected?.id === c.id
                    ? "border-primary bg-primary-fixed/60"
                    : "border-outline-variant/40 bg-surface-container-low hover:border-primary/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-on-surface">Khách: {c.customer_id}</span>
                  <span className="text-[11px] text-on-surface-variant">{when(c.last_message_at)}</span>
                </div>
                <p className="mt-1 line-clamp-1 text-xs text-on-surface-variant">{c.last_message ?? "—"}</p>
                <div className="mt-2 flex items-center gap-2 text-[11px]">
                  <span className="rounded-full bg-surface px-2.5 py-0.5 font-medium">
                    {c.message_count} tin nhắn
                  </span>
                  {c.has_lead && (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-bold text-emerald-800">
                      ✓ Đã để lại SĐT
                    </span>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card
        title={selected ? `Chi tiết hội thoại · ${selected.customer_id}` : "Nội dung cuộc trò chuyện"}
        subtitle={selected ? `Bắt đầu lúc ${when(selected.created_at)}` : "Chọn một hội thoại bên trái để xem"}
      >
        {!selected && (
          <div className="py-12 text-center text-sm text-on-surface-variant">
            Hãy chọn một cuộc trò chuyện ở danh sách bên trái.
          </div>
        )}
        {selected && !messages && <p className="py-8 text-center text-sm text-on-surface-variant">Đang tải tin nhắn…</p>}
        <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
          {messages?.map((m) => (
            <div
              key={m.id}
              className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm ${
                m.role === "user"
                  ? "ml-auto bg-primary text-on-primary"
                  : "border border-outline-variant/40 bg-surface-container-low text-on-surface"
              }`}
            >
              {m.content}
              {m.role === "assistant" && (m.empty_reason || m.ai_used) && (
                <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                  {m.ai_used && (
                    <span className="rounded-md bg-primary-fixed px-2 py-0.5 font-semibold text-primary">
                      ✨ Gemini AI tư vấn
                    </span>
                  )}
                  {m.empty_reason && (
                    <span className="rounded-md bg-amber-100 px-2 py-0.5 font-semibold text-amber-900">
                      Không khớp kho ({m.empty_reason})
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Leads({ token, shopId, logout }: TabProps) {
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "">("");
  const { data, error, loading, reload } = useLoad<Page<Lead>>(
    () => fetchLeads(token, shopId, statusFilter),
    logout,
    [token, shopId, statusFilter]
  );

  async function change(lead: Lead, status: LeadStatus) {
    await updateLeadStatus(token, shopId, lead.id, status).catch(() => undefined);
    reload();
  }

  return (
    <Card
      title={`Danh sách Khách chốt đơn (Leads)${data ? ` (${data.total})` : ""}`}
      subtitle="Khách hàng để lại SĐT qua form hoặc tin nhắn trực tiếp trong phòng chat"
      action={
        <select
          className="rounded-xl border border-outline-variant bg-surface px-3 py-2 text-xs font-semibold"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as LeadStatus | "")}
        >
          <option value="">Tất cả trạng thái</option>
          {Object.entries(LEAD_STATUS).map(([val, label]) => (
            <option key={val} value={val}>
              {label}
            </option>
          ))}
        </select>
      }
    >
      <Status
        loading={loading}
        error={error}
        empty={data?.items.length === 0}
        emptyText="Chưa có khách hàng nào để lại số điện thoại."
      />
      {data && data.items.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-outline-variant/50">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-container-low text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              <tr>
                <th className="px-4 py-3">Khách hàng & SĐT</th>
                <th className="px-4 py-3">Sản phẩm quan tâm</th>
                <th className="px-4 py-3">Ghi chú</th>
                <th className="px-4 py-3">Thời gian</th>
                <th className="px-4 py-3">Trạng thái xử lý</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/40">
              {data.items.map((lead) => (
                <tr key={lead.id} className="align-top transition hover:bg-surface-container-low/50">
                  <td className="px-4 py-3">
                    <p className="font-bold text-on-surface">{lead.name ?? "Khách vãng lai"}</p>
                    <a
                      className="mt-0.5 inline-flex items-center gap-1 font-mono text-xs font-semibold text-primary underline"
                      href={`tel:${lead.phone}`}
                    >
                      📞 {lead.phone}
                    </a>
                  </td>
                  <td className="px-4 py-3 font-medium">{lead.product_name ?? "Tư vấn chung"}</td>
                  <td className="px-4 py-3 text-xs text-on-surface-variant">{lead.note ?? "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-on-surface-variant">
                    {when(lead.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className={`rounded-xl border px-3 py-1.5 text-xs font-bold ${LEAD_BADGE_CLASS[lead.status]}`}
                      value={lead.status}
                      onChange={(e) => change(lead, e.target.value as LeadStatus)}
                    >
                      {Object.entries(LEAD_STATUS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function Unmet({ token, shopId, logout }: TabProps) {
  const { data, error, loading } = useLoad<UnmetDemandItem[]>(() => fetchUnmetDemand(token, shopId), logout, [
    token,
    shopId,
  ]);
  return (
    <Card
      title="Nhu cầu khách hỏi nhưng Shop chưa có hoặc hết hàng (30 ngày)"
      subtitle="Giúp chủ shop nắm bắt xu hướng mặt hàng khách đang tìm mua nhiều để nhập thêm về kho"
    >
      <Status
        loading={loading}
        error={error}
        empty={data?.length === 0}
        emptyText="Tuyệt vời! Mọi câu hỏi của khách đều tìm được sản phẩm phù hợp."
      />
      <ul className="grid gap-3 sm:grid-cols-2">
        {data?.map((item) => (
          <li
            key={`${item.reason}-${item.label}`}
            className="rounded-2xl border border-outline-variant/40 bg-surface-container-low p-4 text-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="font-bold text-on-surface">{item.label}</span>
              <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">
                {item.count} lượt hỏi
              </span>
            </div>
            {item.sample_message && (
              <p className="mt-2 rounded-xl bg-surface p-2.5 text-xs italic text-on-surface-variant">
                “{item.sample_message}”
              </p>
            )}
            <p className="mt-2 text-[11px] text-on-surface-variant">
              Lý do: <code>{item.reason}</code> · Gần nhất: {when(item.last_asked_at)}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

interface TabProps {
  token: string;
  shopId: string;
  logout: () => void;
}

export default function Dashboard() {
  const stored = useSyncExternalStore(subscribeToken, readToken, () => undefined);
  const token = stored ?? null;
  const [merchantInfo, setMerchantInfo] = useState<{ email: string; display_name: string | null } | null>(null);
  const [shops, setShops] = useState<MerchantShop[]>([]);
  const [shopId, setShopId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [showCreateShop, setShowCreateShop] = useState(false);
  const [copied, setCopied] = useState(false);

  const logout = useCallback(() => {
    writeToken(null);
    setShops([]);
    setShopId(null);
    setMerchantInfo(null);
  }, []);

  const loadProfile = useCallback(() => {
    if (!token) return;
    fetchMe(token)
      .then((me) => {
        setMerchantInfo(me.merchant);
        setShops(me.shops);
        setShopId((current) => current ?? me.shops[0]?.id ?? null);
      })
      .catch(logout);
  }, [token, logout]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  if (stored === undefined) return null;
  if (!token) return <AuthScreen onLogin={writeToken} />;

  const activeShop = shops.find((s) => s.id === shopId) ?? shops[0] ?? null;
  const props = activeShop ? { token, shopId: activeShop.id, logout } : null;

  function copyChatLink() {
    if (!activeShop) return;
    const url = `${window.location.origin}/chat/${activeShop.slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <main className="min-h-screen bg-surface px-4 py-6 text-on-surface sm:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        {/* Top Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-outline-variant/60 bg-surface-container-lowest px-5 py-4 shadow-xs">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex size-10 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-xs"
              title="Về trang chủ"
            >
              <span className="material-symbols-outlined text-[22px]">support_agent</span>
            </Link>
            <div>
              <h1 className="text-lg font-bold leading-tight sm:text-xl">SmartSales · Quản lý Shop</h1>
              <p className="text-xs text-on-surface-variant">
                {merchantInfo ? `Tài khoản: ${merchantInfo.display_name || merchantInfo.email}` : "Đang tải hồ sơ…"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {shops.length > 0 && (
              <select
                className="rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm font-bold text-primary focus:border-primary focus:outline-none"
                value={activeShop?.id ?? ""}
                onChange={(e) => setShopId(e.target.value)}
              >
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>
                    🏪 {s.name} ({s.slug})
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={() => setShowCreateShop(true)}
              className="inline-flex items-center gap-1 rounded-xl border border-outline-variant bg-surface px-3 py-2 text-xs font-semibold hover:bg-surface-container-low"
            >
              <span className="material-symbols-outlined text-[16px]">add_business</span>
              Tạo shop mới
            </button>

            {activeShop && (
              <>
                <button
                  type="button"
                  onClick={copyChatLink}
                  className="inline-flex items-center gap-1 rounded-xl border border-primary/40 bg-primary-fixed/40 px-3 py-2 text-xs font-bold text-primary hover:bg-primary-fixed"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {copied ? "check" : "content_copy"}
                  </span>
                  {copied ? "Đã copy link!" : "Copy link Chat"}
                </button>
                <Link
                  href={`/chat/${activeShop.slug}`}
                  target="_blank"
                  className="inline-flex items-center gap-1 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-on-primary shadow-xs hover:bg-primary-container"
                >
                  <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                  Mở trang Chat
                </Link>
              </>
            )}

            <button
              onClick={logout}
              className="inline-flex items-center gap-1 rounded-xl border border-outline-variant px-3 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container-low hover:text-red-700"
            >
              <span className="material-symbols-outlined text-[16px]">logout</span>
              Đăng xuất
            </button>
          </div>
        </header>

        {showCreateShop && (
          <CreateShopModal
            token={token}
            onClose={() => setShowCreateShop(false)}
            onCreated={(created) => {
              setShowCreateShop(false);
              setShops((prev) => [...prev, { ...created, role: "owner" }]);
              setShopId(created.id);
            }}
          />
        )}

        {/* Navigation Tabs */}
        {props && (
          <nav className="flex gap-2 overflow-x-auto pb-1">
            {TABS.map(([value, label, icon]) => (
              <button
                key={value}
                onClick={() => setTab(value)}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2.5 text-xs font-bold transition sm:text-sm ${
                  tab === value
                    ? "bg-primary text-on-primary shadow-xs"
                    : "border border-outline-variant/40 bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">{icon}</span>
                {label}
              </button>
            ))}
          </nav>
        )}

        {/* Empty Shop Onboarding */}
        {!props && (
          <div className="rounded-3xl border border-outline-variant/60 bg-surface-container-lowest p-8 text-center shadow-sm">
            <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-primary-fixed text-primary">
              <span className="material-symbols-outlined text-3xl">storefront</span>
            </div>
            <h2 className="text-xl font-bold">Chào mừng bạn! Hãy tạo Cửa hàng đầu tiên</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-on-surface-variant">
              Tài khoản của bạn đã sẵn sàng. Chỉ cần đặt tên shop để bắt đầu đăng tải sản phẩm và nhận link chat tư vấn khách hàng.
            </p>
            <button
              type="button"
              onClick={() => setShowCreateShop(true)}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-on-primary shadow-sm hover:bg-primary-container"
            >
              <span className="material-symbols-outlined text-[20px]">add_business</span>
              Tạo cửa hàng ngay
            </button>
          </div>
        )}

        {props && tab === "overview" && <Overview {...props} />}
        {props && tab === "products" && <Products {...props} />}
        {props && tab === "conversations" && <Conversations key={props.shopId} {...props} />}
        {props && tab === "leads" && <Leads {...props} />}
        {props && tab === "unmet" && <Unmet {...props} />}
        {props && tab === "settings" && (
          <SettingsTab
            key={props.shopId}
            token={props.token}
            shopId={props.shopId}
            onTokenUpdated={writeToken}
          />
        )}
      </div>
    </main>
  );
}
