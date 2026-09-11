import Link from "next/link";

const DEMO_SHOP = {
  name: "Đèn Decor Yuki",
  slug: "den-decor-yuki",
} as const;

export default function Home() {
  return (
    <main className="min-h-screen bg-surface px-5 py-10 text-on-surface sm:px-8">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl items-center">
        <div className="w-full overflow-hidden rounded-[2rem] border border-outline-variant/60 bg-surface-container-lowest shadow-[0_24px_80px_rgba(0,53,39,0.12)]">
          <div className="bg-primary px-6 py-8 text-on-primary sm:px-10 sm:py-10">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-fixed text-primary">
              <span className="material-symbols-outlined text-[26px]" aria-hidden="true">
                support_agent
              </span>
            </div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-primary-fixed-dim">
              SmartSales Inbox Assistant
            </p>
            <h1 className="max-w-xl text-3xl font-bold leading-tight sm:text-4xl">
              Chat thử với cửa hàng demo
            </h1>
            <p className="mt-4 max-w-xl leading-7 text-primary-fixed">
              Kiểm tra tư vấn sản phẩm, bộ lọc giá, màu sắc, kích thước và phản hồi
              streaming trực tiếp trên giao diện khách hàng.
            </p>
          </div>

          <div className="px-6 py-7 sm:px-10 sm:py-9">
            <div className="flex flex-col gap-5 rounded-3xl bg-surface-container-low p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
                  Shop đang dùng để test
                </p>
                <h2 className="mt-2 text-xl font-bold">{DEMO_SHOP.name}</h2>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Slug: <code>{DEMO_SHOP.slug}</code>
                </p>
              </div>

              <Link
                href={`/chat/${DEMO_SHOP.slug}`}
                className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-on-primary shadow-sm transition hover:bg-primary-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Mở trang chat
                <span className="material-symbols-outlined" aria-hidden="true">
                  arrow_forward
                </span>
              </Link>
            </div>

            <p className="mt-5 text-sm leading-6 text-on-surface-variant">
              Trang chat sẽ tự lấy shop qua API bằng slug trên. Nếu báo không tìm thấy
              shop, hãy chạy script seed demo ở backend trước.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
