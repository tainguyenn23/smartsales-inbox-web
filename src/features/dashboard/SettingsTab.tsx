"use client";

import { useEffect, useState, type FormEvent } from "react";
import { changePassword, fetchSettings, saveSettings, type ShopSettings } from "@/lib/api/merchant";

const POLICIES: [keyof ShopSettings["policies"], string, string, string][] = [
  ["shipping", "Chính sách Giao hàng", "local_shipping", "Ví dụ: Giao toàn quốc 2–4 ngày, miễn phí đơn từ 500k"],
  ["returns", "Chính sách Đổi trả", "assignment_return", "Ví dụ: Đổi mới trong 7 ngày nếu lỗi nhà sản xuất"],
  ["warranty", "Chính sách Bảo hành", "verified_user", "Ví dụ: Bảo hành chính hãng 12 tháng"],
  ["installation", "Hỗ trợ Lắp đặt", "build", "Ví dụ: Hỗ trợ hướng dẫn lắp đặt miễn phí tại nhà"],
];

/** Shop settings used by the bot: greeting, policies, AI advice switch, plus account password change. */
export function SettingsTab({
  token,
  shopId,
  onTokenUpdated,
}: {
  token: string;
  shopId: string;
  onTokenUpdated?: (newToken: string) => void;
}) {
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [message, setMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  useEffect(() => {
    let active = true;
    fetchSettings(token, shopId)
      .then((value) => active && setSettings(value))
      .catch(() => active && setMessage({ text: "Không tải được cài đặt", isError: true }));
    return () => {
      active = false;
    };
  }, [token, shopId]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!settings) return;
    setSaving(true);
    setMessage(null);
    try {
      setSettings(await saveSettings(token, shopId, settings));
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
            <h2 className="text-lg font-bold">Cấu hình Trợ lý Bán hàng</h2>
            <p className="text-xs text-on-surface-variant">
              Tuỳ chỉnh lời chào, chế độ AI và các chính sách cửa hàng để bot trả lời chính xác 100%
            </p>
          </div>
        </div>

        <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-outline-variant/50 bg-surface-container-low p-4 transition hover:border-primary/40">
          <div className="space-y-1">
            <span className="flex items-center gap-2 text-sm font-bold text-on-surface">
              Bật AI tư vấn chuyên sâu (Gemini)
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
              Các câu hỏi giá, tồn kho, màu/size luôn trả lời trực tiếp từ SQL (0 tốn AI). Khi bật mục này,
              bot sẽ dùng thêm Gemini khi khách nhờ tư vấn chọn mẫu hoặc so sánh sản phẩm.
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
              Bot sẽ trả lời đúng nguyên văn nội dung bạn nhập dưới đây, tuyệt đối không tự bịa chính sách.
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
