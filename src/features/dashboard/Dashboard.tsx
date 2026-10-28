"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { ApiError } from "@/lib/api/client";
import {
  fetchConversations,
  fetchLeads,
  fetchMe,
  fetchMessages,
  fetchProducts,
  fetchStats,
  fetchUnmetDemand,
  importProductFile,
  login,
  patchProduct,
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
const TABS = [
  ["overview", "Tổng quan"],
  ["products", "Sản phẩm"],
  ["conversations", "Hội thoại"],
  ["leads", "Leads"],
  ["unmet", "Nhu cầu chưa đáp ứng"],
  ["settings", "Cài đặt"],
] as const;
type Tab = (typeof TABS)[number][0];

const LEAD_STATUS: Record<LeadStatus, string> = {
  new: "Mới",
  contacted: "Đã liên hệ",
  won: "Chốt được",
  lost: "Không chốt",
};

// Token lives in localStorage; useSyncExternalStore keeps SSR (no token) and client in sync.
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
    // Private mode: the session simply won't survive a reload.
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

function money(value: string | number | null, currency = "VND") {
  if (value === null || value === "") return "—";
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

/** Loads data for the active shop; a 401 logs the merchant out. */
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

function Card({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-3xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Status({ loading, error, empty }: { loading: boolean; error: string | null; empty?: boolean }) {
  if (loading) return <p className="text-sm text-on-surface-variant">Đang tải…</p>;
  if (error) return <p className="text-sm text-red-700">{error}</p>;
  if (empty) return <p className="text-sm text-on-surface-variant">Chưa có dữ liệu.</p>;
  return null;
}

function LoginForm({ onLogin }: { onLogin: (token: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await login(email, password);
      onLogin(result.access_token);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? "Sai email hoặc mật khẩu" : errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 text-on-surface">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-3xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-sm"
      >
        <h1 className="text-2xl font-bold">Đăng nhập chủ shop</h1>
        <input
          className="w-full rounded-xl border border-outline-variant px-4 py-3"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="username"
        />
        <input
          className="w-full rounded-xl border border-outline-variant px-4 py-3"
          type="password"
          placeholder="Mật khẩu"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button
          className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-on-primary disabled:opacity-60"
          disabled={busy}
        >
          {busy ? "Đang đăng nhập…" : "Đăng nhập"}
        </button>
      </form>
    </main>
  );
}

function Overview({ token, shopId, logout }: TabProps) {
  const { data, error, loading } = useLoad<ShopStats>(() => fetchStats(token, shopId), logout, [token, shopId]);
  const tiles: [string, number | string][] = data
    ? [
        ["Hội thoại", data.conversations],
        ["Tin nhắn khách", data.customer_messages],
        [
          "Trả lời không cần AI",
          data.assistant_replies
            ? `${Math.round((data.replies_without_ai / data.assistant_replies) * 100)}%`
            : "—",
        ],
        ["Lượt gọi AI", data.ai_calls],
        ["Câu không có kết quả", data.no_result_replies],
        ["Leads", data.leads],
      ]
    : [];
  return (
    <Card title={`Tổng quan ${data ? `${data.days} ngày` : ""}`}>
      <Status loading={loading} error={error} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-surface-container-low p-4">
            <p className="text-xs text-on-surface-variant">{label}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>
      {data && data.top_products.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 font-semibold">Sản phẩm được giới thiệu nhiều nhất</h3>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {data.top_products.map((p) => (
              <li key={p.product_id}>
                {p.name} — {p.times_shown} lần
              </li>
            ))}
          </ol>
        </div>
      )}
    </Card>
  );
}

function Products({ token, shopId, logout }: TabProps) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const { data, error, loading, reload } = useLoad(
    () => fetchProducts(token, shopId, page, query),
    logout,
    [token, shopId, page, query]
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

  const pages = data ? Math.max(1, Math.ceil(data.total / 20)) : 1;
  return (
    <Card
      title={`Sản phẩm${data ? ` (${data.total})` : ""}`}
      action={
        <label className="cursor-pointer rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary">
          {importing ? "Đang import…" : "Import CSV/XLSX"}
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
      }
    >
      {result && (
        <div className="mb-4 rounded-2xl bg-surface-container-low p-3 text-sm">
          Tạo mới {result.created}, cập nhật {result.updated}, lỗi {result.failed}.
          {result.errors.slice(0, 5).map((e) => (
            <p key={`${e.row_number}-${e.reason}`} className="text-red-700">
              Dòng {e.row_number}: {e.reason}
            </p>
          ))}
        </div>
      )}
      {importError && <p className="mb-4 text-sm text-red-700">{importError}</p>}
      <p className="mb-4 text-xs text-on-surface-variant">
        Chưa biết định dạng?{" "}
        <a className="text-primary underline" href="/templates/san-pham-mau.csv" download>
          Tải file CSV mẫu
        </a>{" "}
        — mỗi dòng là một lựa chọn (màu/size); các dòng cùng <code>product_group_key</code> là một sản phẩm.
      </p>
      {editing && (
        <ProductEditor
          token={token}
          shopId={shopId}
          productId={editing}
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
          className="flex-1 rounded-xl border border-outline-variant px-3 py-2"
          placeholder="Tìm theo tên…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="rounded-xl border border-outline-variant px-4 py-2">Tìm</button>
      </form>
      <Status loading={loading} error={error} empty={data?.items.length === 0} />
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <tbody>
            {data?.items.map((p: ProductListItem) => (
              <tr key={p.id} className="border-t border-outline-variant/40">
                <td className="py-2 pr-3 font-medium">{p.name}</td>
                <td className="py-2 pr-3 text-on-surface-variant">{p.category ?? "—"}</td>
                <td className="py-2 pr-3 whitespace-nowrap">
                  {money(p.min_price, p.currency)}
                  {p.max_price !== p.min_price ? ` – ${money(p.max_price, p.currency)}` : ""}
                </td>
                <td className="py-2 pr-3">{p.availability}</td>
                <td className="py-2 pr-3">{p.status === "active" ? "Đang bán" : "Đã ẩn"}</td>
                <td className="py-2 whitespace-nowrap text-right">
                  <button onClick={() => setEditing(p.id)} className="mr-3 text-primary underline">
                    Sửa
                  </button>
                  <button onClick={() => toggleVisible(p)} className="text-on-surface-variant underline">
                    {p.status === "active" ? "Ẩn" : "Hiện"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="mt-4 flex items-center gap-3 text-sm">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="disabled:opacity-40">
            ← Trước
          </button>
          <span>
            Trang {page}/{pages}
          </span>
          <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="disabled:opacity-40">
            Sau →
          </button>
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
      <Card title={`Hội thoại${list.data ? ` (${list.data.total})` : ""}`}>
        <Status loading={list.loading} error={list.error} empty={list.data?.items.length === 0} />
        <ul className="space-y-2">
          {list.data?.items.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => setSelected(c)}
                className={`w-full rounded-2xl p-3 text-left text-sm ${
                  selected?.id === c.id ? "bg-primary-fixed" : "bg-surface-container-low"
                }`}
              >
                <div className="flex justify-between gap-2">
                  <span className="font-semibold">{c.customer_id}</span>
                  <span className="text-xs text-on-surface-variant">{when(c.last_message_at)}</span>
                </div>
                <p className="mt-1 line-clamp-1 text-on-surface-variant">{c.last_message ?? "—"}</p>
                <p className="mt-1 text-xs">
                  {c.message_count} tin · {c.status}
                  {c.has_lead && " · có lead"}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </Card>
      <Card title={selected ? `Khách ${selected.customer_id}` : "Chọn một hội thoại"}>
        {selected && !messages && <p className="text-sm">Đang tải…</p>}
        <div className="space-y-3">
          {messages?.map((m) => (
            <div
              key={m.id}
              className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2 text-sm ${
                m.role === "user" ? "ml-auto bg-primary text-on-primary" : "bg-surface-container-low"
              }`}
            >
              {m.content}
              {m.role === "assistant" && (m.empty_reason || m.ai_used) && (
                <p className="mt-1 text-xs opacity-70">
                  {m.ai_used ? "AI tư vấn" : ""}
                  {m.empty_reason ? ` · không có kết quả (${m.empty_reason})` : ""}
                </p>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Leads({ token, shopId, logout }: TabProps) {
  const { data, error, loading, reload } = useLoad<Page<Lead>>(() => fetchLeads(token, shopId), logout, [
    token,
    shopId,
  ]);
  async function change(lead: Lead, status: LeadStatus) {
    await updateLeadStatus(token, shopId, lead.id, status).catch(() => undefined);
    reload();
  }
  return (
    <Card title={`Leads${data ? ` (${data.total})` : ""}`}>
      <Status loading={loading} error={error} empty={data?.items.length === 0} />
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <tbody>
            {data?.items.map((lead) => (
              <tr key={lead.id} className="border-t border-outline-variant/40 align-top">
                <td className="py-2 pr-3">
                  <p className="font-semibold">{lead.name ?? "(chưa có tên)"}</p>
                  <a className="text-primary underline" href={`tel:${lead.phone}`}>
                    {lead.phone}
                  </a>
                </td>
                <td className="py-2 pr-3">{lead.product_name ?? "—"}</td>
                <td className="py-2 pr-3 text-xs text-on-surface-variant">
                  {when(lead.created_at)} · {lead.source}
                </td>
                <td className="py-2">
                  <select
                    className="rounded-lg border border-outline-variant px-2 py-1"
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
    </Card>
  );
}

function Unmet({ token, shopId, logout }: TabProps) {
  const { data, error, loading } = useLoad<UnmetDemandItem[]>(() => fetchUnmetDemand(token, shopId), logout, [
    token,
    shopId,
  ]);
  return (
    <Card title="Khách hỏi nhưng shop chưa đáp ứng (30 ngày)">
      <Status loading={loading} error={error} empty={data?.length === 0} />
      <ul className="space-y-2">
        {data?.map((item) => (
          <li key={`${item.reason}-${item.label}`} className="rounded-2xl bg-surface-container-low p-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="font-semibold">{item.label}</span>
              <span className="whitespace-nowrap font-bold">{item.count} lần</span>
            </div>
            <p className="mt-1 text-xs text-on-surface-variant">
              {item.reason} · gần nhất {when(item.last_asked_at)}
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
  // undefined during SSR/hydration, then the stored token (or null).
  const stored = useSyncExternalStore(subscribeToken, readToken, () => undefined);
  const token = stored ?? null;
  const [shops, setShops] = useState<MerchantShop[]>([]);
  const [shopId, setShopId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");

  const logout = useCallback(() => {
    writeToken(null);
    setShops([]);
    setShopId(null);
  }, []);

  useEffect(() => {
    if (!token) return;
    fetchMe(token)
      .then((me) => {
        setShops(me.shops);
        setShopId((current) => current ?? me.shops[0]?.id ?? null);
      })
      .catch(logout);
  }, [token, logout]);

  if (stored === undefined) return null;
  if (!token) return <LoginForm onLogin={writeToken} />;

  const props = shopId ? { token, shopId, logout } : null;
  return (
    <main className="min-h-screen bg-surface px-4 py-6 text-on-surface sm:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">SmartSales · Quản lý shop</h1>
          <div className="flex items-center gap-2">
            {shops.length > 1 && (
              <select
                className="rounded-xl border border-outline-variant px-3 py-2"
                value={shopId ?? ""}
                onChange={(e) => setShopId(e.target.value)}
              >
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
            {shops.length === 1 && <span className="font-semibold">{shops[0].name}</span>}
            <button onClick={logout} className="rounded-xl border border-outline-variant px-3 py-2 text-sm">
              Đăng xuất
            </button>
          </div>
        </header>
        <nav className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${
                tab === value ? "bg-primary text-on-primary" : "bg-surface-container"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
        {!props && <p>Tài khoản chưa được gắn shop nào. Liên hệ quản trị để được cấp quyền.</p>}
        {props && tab === "overview" && <Overview {...props} />}
        {props && tab === "products" && <Products {...props} />}
        {props && tab === "conversations" && <Conversations key={props.shopId} {...props} />}
        {props && tab === "leads" && <Leads {...props} />}
        {props && tab === "unmet" && <Unmet {...props} />}
        {props && tab === "settings" && <SettingsTab key={props.shopId} token={props.token} shopId={props.shopId} />}
      </div>
    </main>
  );
}
