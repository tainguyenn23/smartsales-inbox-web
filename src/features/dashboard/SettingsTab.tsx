"use client";

import { useEffect, useState, type FormEvent } from "react";
import { fetchSettings, saveSettings, type ShopSettings } from "@/lib/api/merchant";

const POLICIES: [keyof ShopSettings["policies"], string, string][] = [
  ["shipping", "Giao hàng", "Ví dụ: Giao toàn quốc 2–4 ngày, phí theo đơn vị vận chuyển"],
  ["returns", "Đổi trả", "Ví dụ: Đổi trong 7 ngày nếu lỗi nhà sản xuất"],
  ["warranty", "Bảo hành", "Ví dụ: Bảo hành 12 tháng"],
  ["installation", "Lắp đặt", "Ví dụ: Hỗ trợ lắp đặt nội thành"],
];

/** Shop settings used by the bot: greeting, policies and the AI advice switch. */
export function SettingsTab({ token, shopId }: { token: string; shopId: string }) {
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    fetchSettings(token, shopId)
      .then((value) => active && setSettings(value))
      .catch(() => active && setMessage("Không tải được cài đặt"));
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
      setMessage("Đã lưu.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }

  if (!settings) return <p className="text-sm">{message ?? "Đang tải…"}</p>;

  return (
    <form
      onSubmit={save}
      className="space-y-4 rounded-3xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-sm"
    >
      <h2 className="text-lg font-bold">Cài đặt bot</h2>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={settings.ai_advice_enabled}
          onChange={(e) => setSettings({ ...settings, ai_advice_enabled: e.target.checked })}
        />
        <span>
          <span className="font-semibold">Bật AI tư vấn</span>
          <br />
          <span className="text-on-surface-variant">
            Chỉ dùng khi khách xin tư vấn/so sánh. Tắt thì bot trả lời bằng dữ liệu shop, không tốn lượt AI.
          </span>
        </span>
      </label>
      <label className="block text-sm">
        <span className="font-semibold">Lời chào</span>
        <input
          className="mt-1 w-full rounded-xl border border-outline-variant px-3 py-2"
          maxLength={300}
          placeholder="Để trống để dùng lời chào mặc định"
          value={settings.greeting ?? ""}
          onChange={(e) => setSettings({ ...settings, greeting: e.target.value })}
        />
      </label>
      <div className="space-y-3">
        <p className="text-sm font-semibold">Chính sách (bot trả lời đúng nội dung này, để trống nếu chưa có)</p>
        {POLICIES.map(([key, label, placeholder]) => (
          <label key={key} className="block text-sm">
            {label}
            <textarea
              className="mt-1 w-full rounded-xl border border-outline-variant px-3 py-2"
              rows={2}
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
      {message && <p className="text-sm">{message}</p>}
      <button
        disabled={saving}
        className="rounded-xl bg-primary px-5 py-3 font-semibold text-on-primary disabled:opacity-50"
      >
        {saving ? "Đang lưu…" : "Lưu cài đặt"}
      </button>
    </form>
  );
}
