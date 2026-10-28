"use client";

import { useState, type FormEvent } from "react";

const PHONE = /^(?:\+?84|0)\d{8,10}$/;

/**
 * Name/phone form shown after the customer picks a product to buy.
 * It sends a normal chat message, so the backend links the lead to the
 * product/variant already in the conversation state.
 */
export function LeadForm({ onSubmit, disabled }: { onSubmit: (text: string) => void; disabled?: boolean }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    const digits = phone.replace(/[\s.-]/g, "");
    if (!PHONE.test(digits)) {
      setError("Số điện thoại chưa đúng (ví dụ 0912345678)");
      return;
    }
    setError(null);
    setSent(true);
    onSubmit(`${name.trim() ? `Tên mình là ${name.trim()}, ` : ""}SĐT ${digits}`);
  }

  if (sent) return <p className="pl-10 text-xs text-on-surface-variant">Đã gửi thông tin cho shop.</p>;

  return (
    <form
      onSubmit={submit}
      className="ml-10 mt-1 flex w-[85%] max-w-sm flex-col gap-2 rounded-lg border border-outline-variant bg-surface p-3"
    >
      <p className="text-xs font-semibold">Để lại thông tin, shop sẽ gọi xác nhận đơn</p>
      <input
        className="rounded-lg border border-outline-variant px-3 py-2 text-sm"
        placeholder="Tên của bạn"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={100}
        autoComplete="name"
      />
      <input
        className="rounded-lg border border-outline-variant px-3 py-2 text-sm"
        placeholder="Số điện thoại"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        inputMode="tel"
        autoComplete="tel"
        required
      />
      {error && <p className="text-xs text-red-700">{error}</p>}
      <button
        disabled={disabled}
        className="min-h-10 rounded-lg bg-primary text-sm font-bold text-on-primary disabled:opacity-50"
      >
        Gửi cho shop
      </button>
    </form>
  );
}
