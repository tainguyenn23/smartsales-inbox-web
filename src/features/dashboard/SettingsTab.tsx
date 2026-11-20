"use client";

import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { changePassword, fetchSettings, saveSettings, type ShopSettings } from "@/lib/api/merchant";

const POLICIES: [keyof ShopSettings["policies"], string, string, string][] = [
  ["shipping", "Chính sách Giao hàng", "local_shipping", "Ví dụ: Giao toàn quốc 2–4 ngày, miễn phí đơn từ 500k"],
  ["returns", "Chính sách Đổi trả", "assignment_return", "Ví dụ: Đổi mới trong 7 ngày nếu lỗi nhà sản xuất"],
  ["warranty", "Chính sách Bảo hành", "verified_user", "Ví dụ: Bảo hành chính hãng 12 tháng"],
  ["installation", "Hỗ trợ Lắp đặt", "build", "Ví dụ: Hỗ trợ hướng dẫn lắp đặt miễn phí tại nhà"],
];

const TIER_BADGE: Record<string, { label: string; className: string }> = {
  free: { label: "FREE TIER", className: "bg-stone-200 text-stone-800" },
  standard: { label: "STANDARD", className: "bg-sky-100 text-sky-900" },
  pro: { label: "PRO · BYOK", className: "bg-indigo-100 text-indigo-900" },
  enterprise: { label: "ENTERPRISE", className: "bg-amber-100 text-amber-900" },
};

const noSubscribe = () => () => {};

/** Shop settings used by the bot: greeting, policies, AI advice switch, tier/BYOK config, plus password change. */
export function SettingsTab({
  token,
  shopId,
  shopSlug,
  onTokenUpdated,
}: {
  token: string;
  shopId: string;
  shopSlug: string;
  onTokenUpdated?: (newToken: string) => void;
}) {
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [message, setMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [telegramToken, setTelegramToken] = useState("");
  const [clearTelegram, setClearTelegram] = useState(false);
  const [customApiKey, setCustomApiKey] = useState("");
  const [clearCustomKey, setClearCustomKey] = useState(false);
  const [customChatModel, setCustomChatModel] = useState("");
  const widgetOrigin = useSyncExternalStore(noSubscribe, () => window.location.origin, () => "");
  const [copied, setCopied] = useState(false);

  const embedCode = `<script src="${widgetOrigin}/widget.js" data-shop="${shopSlug}"></script>`;

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  useEffect(() => {
    let active = true;
    fetchSettings(token, shopId)
      .then((value) => {
        if (!active) return;
        setSettings(value);
        setCustomChatModel(value.quota?.custom_chat_model ?? "");
      })
      .catch(() => active && setMessage({ text: "Không tải được cài đặt", isError: true }));
    return () => {
      active = false;
    };
  }, [token, shopId]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!settings) return;
    const tier = settings.quota?.plan_tier ?? "free";
    const canEditCustomLlm = tier === "pro" || tier === "enterprise";
    setSaving(true);
    setMessage(null);
    try {
      const updated = await saveSettings(token, shopId, {
        ...settings,
        telegram_bot_token: telegramToken || undefined,
        clear_telegram: clearTelegram,
        ...(canEditCustomLlm
          ? {
              custom_api_key: customApiKey.trim() || undefined,
              clear_custom_api_key: clearCustomKey,
              custom_chat_model: customChatModel.trim(),
            }
          : {}),
      });
      setSettings(updated);
      setCustomChatModel(updated.quota?.custom_chat_model ?? "");
      setTelegramToken("");
      setClearTelegram(false);
      setCustomApiKey("");
      setClearCustomKey(false);
      setMessage({ text: "Đã lưu cấu hình trợ lý bán hàng thành công!" });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Lưu thất bại", isError: true });
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(event: FormEvent) {
    event.preventDefault();
    if (newPassword.length < 8) {
      setPwMessage({ text: "Mật khẩu mới phải có ít nhất 8 ký tự", isError: true });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMessage({ text: "Mật khẩu xác nhận không khớp", isError: true });
      return;
    }
    setPwSaving(true);
    setPwMessage(null);
    try {
      const res = await changePassword(token, {
        current_password: currentPassword,
        new_password: newPassword,
      });
      onTokenUpdated?.(res.access_token);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPwMessage({ text: "Đã đổi mật khẩu thành công và thu hồi các phiên đăng nhập cũ!" });
    } catch (err) {
      setPwMessage({ text: err instanceof Error ? err.message : "Đổi mật khẩu thất bại", isError: true });
    } finally {
      setPwSaving(false);
    }
  }

  if (!settings) {
    return (
      <div className="rounded-3xl border border-outline-variant/60 bg-surface-container-lowest p-6 text-sm text-on-surface-variant">
        {message?.text ?? "Đang tải cài đặt cửa hàng…"}
      </div>
    );
  }

  const quota = settings.quota;
  const tierKey = quota?.plan_tier ?? "free";
  const tierBadge = TIER_BADGE[tierKey] ?? TIER_BADGE.free;
  const canCustomLlm = tierKey === "pro" || tierKey === "enterprise";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      {/* Cài đặt Bot */}
      <form
        onSubmit={save}
        className="space-y-5 rounded-3xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-sm"
      >
        <div className="flex items-center gap-3 border-b border-outline-variant/40 pb-4">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-primary-fixed text-primary">
            <span className="material-symbols-outlined text-[22px]">smart_toy</span>
          </div>
          <div>
            <h2 className="text-lg font-bold">Cấu hình Trợ lý Bán hàng RAG</h2>
            <p className="text-xs text-on-surface-variant">
              Tuỳ chỉnh chế độ AI Hybrid RAG, gói cước, lời chào và chính sách chuẩn của cửa hàng
            </p>
          </div>
        </div>

        {/* Thông tin Gói cước & Hạn mức Quota */}
        {quota && (
          <div className="space-y-3 rounded-2xl border border-outline-variant/60 bg-surface-container-low p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-on-surface">Gói dịch vụ hiện tại:</span>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${tierBadge.className}`}>
                  {tierBadge.label}
                </span>
                {quota.bypass_quota && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                    Admin Bypass
                  </span>
                )}
              </div>
              <span className="text-xs text-on-surface-variant">
                Tối đa {quota.max_products_limit > 0 ? `${quota.max_products_limit.toLocaleString("vi-VN")} SP` : "Không giới hạn SP"}
              </span>
            </div>

            <div className="grid gap-2.5 text-xs sm:grid-cols-3">
              <div className="rounded-xl border border-outline-variant/40 bg-surface p-2.5">
                <p className="text-on-surface-variant">Chat hôm nay</p>
                <p className="mt-0.5 font-bold text-on-surface">
                  {quota.daily_chats_used.toLocaleString("vi-VN")} /{" "}
                  {quota.daily_chat_limit > 0 ? quota.daily_chat_limit.toLocaleString("vi-VN") : "∞"}
                </p>
              </div>
              <div className="rounded-xl border border-outline-variant/40 bg-surface p-2.5">
                <p className="text-on-surface-variant">Chat trong tháng</p>
                <p className="mt-0.5 font-bold text-on-surface">
                  {quota.monthly_chats_used.toLocaleString("vi-VN")} /{" "}
                  {quota.monthly_chat_limit > 0 ? quota.monthly_chat_limit.toLocaleString("vi-VN") : "∞"}
                </p>
              </div>
              <div className="rounded-xl border border-outline-variant/40 bg-surface p-2.5">
                <p className="text-on-surface-variant">Tokens tháng này</p>
                <p className="mt-0.5 font-bold text-on-surface">
                  {quota.monthly_tokens_used.toLocaleString("vi-VN")} /{" "}
                  {quota.monthly_token_limit > 0 ? quota.monthly_token_limit.toLocaleString("vi-VN") : "∞"}
                </p>
              </div>
            </div>

            {canCustomLlm && (
              <div className="space-y-2.5 border-t border-outline-variant/40 pt-3">
                <p className="text-xs font-bold text-primary">
                  Cấu hình Gemini Engine riêng (Gói Pro / Enterprise BYOK)
                </p>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <label className="block text-xs">
                    <span className="font-semibold text-on-surface">Tên Model Gemini tùy chỉnh</span>
                    <input
                      type="text"
                      value={customChatModel}
                      onChange={(e) => setCustomChatModel(e.target.value)}
                      placeholder="VD: gemini-2.5-flash hoặc gemini-2.5-pro"
                      className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-xs focus:border-primary focus:outline-none"
                    />
                  </label>
                  <label className="block text-xs">
                    <span className="font-semibold text-on-surface">Custom Gemini API Key</span>
                    <input
                      type="password"
                      autoComplete="off"
                      value={customApiKey}
                      onChange={(e) => setCustomApiKey(e.target.value)}
                      placeholder={
                        quota.custom_api_key_configured
                          ? `Đã lưu (${quota.custom_api_key_masked ?? "••••"})`
                          : "AIzaSy..."
                      }
                      className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-xs focus:border-primary focus:outline-none"
                    />
                  </label>
                </div>
                {quota.custom_api_key_configured && (
                  <label className="flex items-center gap-2 text-xs text-on-surface-variant">
                    <input
                      type="checkbox"
                      checked={clearCustomKey}
                      onChange={(e) => setClearCustomKey(e.target.checked)}
                    />
                    Xóa Custom API Key hiện tại và quay về dùng Key hệ thống
                  </label>
                )}
              </div>
            )}
          </div>
        )}

        <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-outline-variant/50 bg-surface-container-low p-4 transition hover:border-primary/40">
          <div className="space-y-1">
            <span className="flex items-center gap-2 text-sm font-bold text-on-surface">
              Bật AI Tư vấn Hybrid RAG (Gemini Streaming)
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  settings.ai_advice_enabled
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-stone-200 text-stone-700"
                }`}
              >
                {settings.ai_advice_enabled ? "Đang bật" : "Đang tắt"}
              </span>
            </span>
            <p className="text-xs leading-relaxed text-on-surface-variant">
              Kết hợp tìm kiếm SQL Variant + Keyword + Vector pgvector và tư vấn thời gian thực qua Gemini
              (tự động kích hoạt Context Caching tối ưu chi phí). Khi tắt sẽ trả lời bằng mẫu SQL thuần.
            </p>
          </div>
          <input
            type="checkbox"
            className="mt-1 size-5 accent-primary"
            checked={settings.ai_advice_enabled}
            onChange={(e) => setSettings({ ...settings, ai_advice_enabled: e.target.checked })}
          />
        </label>

        <label className="block text-sm">
          <span className="font-semibold text-on-surface">Lời chào mở đầu khi khách vào chat</span>
          <input
            className="mt-1.5 w-full rounded-xl border border-outline-variant bg-surface px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none"
            maxLength={300}
            placeholder="Để trống để dùng lời chào mặc định của hệ thống"
            value={settings.greeting ?? ""}
            onChange={(e) => setSettings({ ...settings, greeting: e.target.value })}
          />
        </label>

        <div className="space-y-3 pt-1">
          <div>
            <p className="text-sm font-semibold text-on-surface">Chính sách chuẩn của Shop</p>
            <p className="text-xs text-on-surface-variant">
              Bot sẽ nạp vào Context Cache và trả lời đúng nguyên văn nội dung dưới đây, không tự bịa chính sách.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {POLICIES.map(([key, label, icon, placeholder]) => (
              <label key={key} className="block rounded-2xl border border-outline-variant/40 bg-surface p-3 text-sm">
                <span className="flex items-center gap-1.5 font-semibold text-on-surface">
                  <span className="material-symbols-outlined text-[18px] text-primary">{icon}</span>
                  {label}
                </span>
                <textarea
                  className="mt-2 w-full rounded-xl border border-outline-variant/60 bg-surface-container-lowest px-3 py-2 text-xs leading-relaxed focus:border-primary focus:outline-none"
                  rows={3}
                  maxLength={1000}
                  placeholder={placeholder}
                  value={settings.policies[key] ?? ""}
                  onChange={(e) =>
                    setSettings({ ...settings, policies: { ...settings.policies, [key]: e.target.value } })
                  }
                />
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-outline-variant/50 bg-surface-container-low p-4">
          <div>
            <p className="text-sm font-semibold text-on-surface">
              Điều hướng Gian hàng & Kênh Chuyển giao Nhân viên (Handoff)
            </p>
            <p className="text-xs text-on-surface-variant">
              Khi có trên 20 sản phẩm khớp, bot sẽ kèm nút mở gian hàng. Khi khách cần nhân viên, bot gửi nút Zalo/Hotline.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs">
              <span className="font-semibold text-on-surface">Shopee Store URL</span>
              <input
                type="url"
                value={settings.shopee_url ?? ""}
                onChange={(e) => setSettings({ ...settings, shopee_url: e.target.value })}
                placeholder="https://shopee.vn/ten-shop"
                className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-xs focus:border-primary focus:outline-none"
              />
            </label>
            <label className="block text-xs">
              <span className="font-semibold text-on-surface">Shopify / Website URL</span>
              <input
                type="url"
                value={settings.shopify_url ?? ""}
                onChange={(e) => setSettings({ ...settings, shopify_url: e.target.value })}
                placeholder="https://yourstore.myshopify.com"
                className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-xs focus:border-primary focus:outline-none"
              />
            </label>
            <label className="block text-xs">
              <span className="font-semibold text-on-surface">Link Catalog đầy đủ</span>
              <input
                type="url"
                value={settings.catalog_url ?? ""}
                onChange={(e) => setSettings({ ...settings, catalog_url: e.target.value })}
                placeholder="https://..."
                className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-xs focus:border-primary focus:outline-none"
              />
            </label>
            <label className="block text-xs">
              <span className="font-semibold text-on-surface">Zalo OA / Liên hệ trực tiếp</span>
              <input
                type="url"
                value={settings.zalo_contact_url ?? ""}
                onChange={(e) => setSettings({ ...settings, zalo_contact_url: e.target.value })}
                placeholder="https://zalo.me/0912345678"
                className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-xs focus:border-primary focus:outline-none"
              />
            </label>
            <label className="block text-xs sm:col-span-2">
              <span className="font-semibold text-on-surface">Số Hotline hỗ trợ nhanh</span>
              <input
                type="tel"
                value={settings.hotline ?? ""}
                onChange={(e) => setSettings({ ...settings, hotline: e.target.value })}
                placeholder="VD: 0912 345 678"
                className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-xs focus:border-primary focus:outline-none"
              />
            </label>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-outline-variant/50 bg-surface-container-low p-4">
          <div>
            <p className="text-sm font-semibold">Báo lead mới qua Telegram</p>
            <p className="text-xs text-on-surface-variant">
              {settings.telegram_configured
                ? "Đã kết nối. Để trống token nếu không đổi bot."
                : "Nhập Bot Token và Chat ID để nhận thông báo khi có khách để lại SĐT."}
            </p>
            <p className="mt-1 text-xs text-on-surface-variant">
              Hãy nhắn /start cho bot từ tài khoản Telegram nhận thông báo trước.
            </p>
          </div>
          <label className="block text-sm">
            <span>Telegram Bot Token</span>
            <input
              type="password"
              autoComplete="off"
              value={telegramToken}
              onChange={(e) => setTelegramToken(e.target.value)}
              placeholder={settings.telegram_configured ? "Đã lưu token" : "123456:AA..."}
              className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span>Telegram Chat ID</span>
            <input
              type="text"
              inputMode="numeric"
              value={settings.telegram_chat_id ?? ""}
              onChange={(e) => setSettings({ ...settings, telegram_chat_id: e.target.value })}
              placeholder="Ví dụ: 123456789"
              className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3 py-2"
            />
          </label>
          {settings.telegram_configured && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={clearTelegram}
                onChange={(e) => setClearTelegram(e.target.checked)}
              />
              Tắt và xóa kết nối Telegram
            </label>
          )}
        </div>

        {message && (
          <div
            className={`rounded-xl px-4 py-2.5 text-sm font-medium ${
              message.isError ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"
            }`}
          >
            {message.text}
          </div>
        )}

        <button
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-on-primary shadow-sm transition hover:bg-primary-container disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[18px]">save</span>
          {saving ? "Đang lưu cài đặt…" : "Lưu cài đặt Bot"}
        </button>
      </form>

      <div className="h-fit space-y-3 rounded-3xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-sm lg:col-start-2">
        <h2 className="text-lg font-bold">Lấy mã nhúng Website / Shopify</h2>
        <p className="text-sm text-on-surface-variant">
          Dán dòng này trước thẻ đóng body trong giao diện website của bạn.
        </p>
        <textarea
          readOnly
          rows={3}
          value={widgetOrigin ? embedCode : "Đang tạo mã nhúng…"}
          aria-label="Mã nhúng chat"
          className="w-full rounded-xl border border-outline-variant bg-surface p-3 font-mono text-xs"
        />
        <button
          type="button"
          disabled={!widgetOrigin}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(embedCode);
              setCopied(true);
            } catch {
              setMessage({
                text: "Không sao chép được. Hãy chọn mã nhúng trong ô và sao chép thủ công.",
                isError: true,
              });
            }
          }}
          className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-50"
        >
          {copied ? "Đã sao chép" : "Sao chép mã nhúng"}
        </button>
      </div>

      {/* Đổi mật khẩu tài khoản */}
      <form
        onSubmit={handleChangePassword}
        className="h-fit space-y-4 rounded-3xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-sm"
      >
        <div className="flex items-center gap-3 border-b border-outline-variant/40 pb-4">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-surface-container-high text-primary">
            <span className="material-symbols-outlined text-[22px]">lock_reset</span>
          </div>
          <div>
            <h2 className="text-lg font-bold">Bảo mật & Đổi mật khẩu</h2>
            <p className="text-xs text-on-surface-variant">
              Khi đổi mật khẩu, mọi thiết bị đã đăng nhập trước đó sẽ tự động đăng xuất
            </p>
          </div>
        </div>

        <label className="block text-sm">
          <span className="font-medium">Mật khẩu hiện tại</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none"
            placeholder="Nhập mật khẩu đang dùng"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </label>

        <label className="block text-sm">
          <span className="font-medium">Mật khẩu mới (tối thiểu 8 ký tự)</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none"
            placeholder="Ít nhất 8 ký tự"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </label>

        <label className="block text-sm">
          <span className="font-medium">Nhập lại mật khẩu mới</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none"
            placeholder="Xác nhận mật khẩu mới"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </label>

        {pwMessage && (
          <div
            className={`rounded-xl px-4 py-2.5 text-xs font-medium ${
              pwMessage.isError ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"
            }`}
          >
            {pwMessage.text}
          </div>
        )}

        <button
          disabled={pwSaving}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary bg-surface px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-surface-container-low disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[18px]">key</span>
          {pwSaving ? "Đang cập nhật…" : "Cập nhật mật khẩu"}
        </button>
      </form>
    </div>
  );
}
