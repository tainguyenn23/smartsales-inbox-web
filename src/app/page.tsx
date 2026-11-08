import Link from "next/link";

const DEMO_SHOP = {
  name: "Đèn Decor Yuki",
  slug: "den-decor-yuki",
} as const;

const FEATURES = [
  {
    icon: "database",
    title: "Catalog-First · Chính xác 100%",
    desc: "Mọi câu hỏi về giá, màu sắc, kích thước, tình trạng còn hàng đều truy vấn trực tiếp từ SQL của shop. Tuyệt đối không bịa giá hay báo sai tồn kho.",
  },
  {
    icon: "psychology",
    title: "AI Tư vấn thông minh (Tùy chọn)",
    desc: "Tiết kiệm tối đa chi phí: 90% câu hỏi xử lý tức thì không tốn AI. Chỉ gọi Gemini khi khách cần so sánh chuyên sâu hoặc gợi ý phối đồ.",
  },
  {
    icon: "contact_phone",
    title: "Thu thập SĐT chốt đơn tự động",
    desc: "Khi khách chọn được mẫu ưng ý, khung chat tự động hiển thị biểu mẫu để lại Tên & SĐT hoặc trích xuất trực tiếp từ tin nhắn của khách.",
  },
  {
    icon: "trending_up",
    title: "Phát hiện nhu cầu chưa đáp ứng",
    desc: "Tự động thống kê những mặt hàng hoặc tầm giá khách hỏi nhiều nhưng shop chưa có trong kho để chủ shop nhập hàng kịp thời.",
  },
] as const;

export default function Home() {
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-outline-variant/50 bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-8">
          <div className="flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-xs">
              <span className="material-symbols-outlined text-[22px]">support_agent</span>
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-primary">SmartSales</span>
              <span className="ml-1.5 rounded-full bg-primary-fixed px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                Catalog AI
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href={`/chat/${DEMO_SHOP.slug}`}
              className="hidden rounded-full border border-outline-variant px-4 py-2 text-xs font-bold text-on-surface transition hover:bg-surface-container-low sm:inline-flex sm:items-center sm:gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px] text-primary">chat</span>
              Chat thử Shop mẫu
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-on-primary shadow-xs transition hover:bg-primary-container sm:px-5 sm:py-2.5 sm:text-sm"
            >
              <span className="material-symbols-outlined text-[18px]">storefront</span>
              Đăng nhập / Mở Shop
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        {/* Hero Banner */}
        <section className="overflow-hidden rounded-[2rem] border border-outline-variant/60 bg-surface-container-lowest shadow-[0_24px_80px_rgba(0,53,39,0.10)]">
          <div className="grid lg:grid-cols-[1.25fr_1fr]">
            <div className="bg-primary px-6 py-10 text-on-primary sm:px-10 sm:py-12">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary-container px-3.5 py-1 text-xs font-semibold text-primary-fixed">
                <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                Kiến trúc Catalog-First · Data-First · LLM-Optional
              </div>
              <h1 className="text-3xl font-bold leading-tight sm:text-4xl lg:text-[2.6rem]">
                Trợ lý bán hàng trả lời đúng giá, đúng tồn kho từ Catalog
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-primary-fixed sm:text-base">
                Chủ shop chỉ cần tải file sản phẩm (CSV/Excel) hoặc thêm trực tiếp trên Dashboard.
                Khách hàng hỏi giá, màu sắc, tồn kho hay{" "}
                <span className="font-semibold text-white">“mẫu thứ hai còn màu kem không?”</span> đều
                được giải đáp tức thì kèm thẻ sản phẩm và form chốt đơn.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  href="/dashboard"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary-fixed px-6 py-3 text-sm font-bold text-primary shadow-sm transition hover:opacity-95"
                >
                  <span className="material-symbols-outlined text-[20px]">rocket_launch</span>
                  Mở Shop miễn phí ngay
                </Link>
                <Link
                  href={`/chat/${DEMO_SHOP.slug}`}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-primary-fixed/40 bg-primary-container/60 px-6 py-3 text-sm font-bold text-on-primary transition hover:bg-primary-container"
                >
                  Trải nghiệm Chat mẫu
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </Link>
              </div>
            </div>

            {/* Right Interactive Preview Box */}
            <div className="flex flex-col justify-between bg-surface-container-lowest p-6 sm:p-8">
              <div>
                <div className="flex items-center justify-between border-b border-outline-variant/50 pb-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-secondary">
                      Gian hàng Demo trực tuyến
                    </p>
                    <h2 className="mt-0.5 text-lg font-bold text-on-surface">{DEMO_SHOP.name}</h2>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                    <span className="size-1.5 rounded-full bg-emerald-600" />
                    Online
                  </span>
                </div>

                <div className="mt-4 space-y-3 text-xs">
                  <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-none bg-primary px-3.5 py-2.5 text-on-primary">
                    Shop có đèn ngủ để bàn dưới 500k không?
                  </div>
                  <div className="max-w-[90%] rounded-2xl rounded-bl-none border border-outline-variant/60 bg-surface-container-low px-3.5 py-2.5 text-on-surface">
                    Dạ shop hiện có 3 mẫu đèn bàn dưới 500.000đ đang còn hàng. Bạn xem thử các mẫu bên dưới nhé!
                  </div>
                  <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-none bg-primary px-3.5 py-2.5 text-on-primary">
                    Mẫu thứ 2 còn màu vàng ấm không shop? Mình lấy 1 cái.
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-outline-variant/50 bg-surface-container-low p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs">
                    <p className="font-bold text-on-surface">Đường dẫn phòng chat Demo:</p>
                    <code className="text-primary">/chat/{DEMO_SHOP.slug}</code>
                  </div>
                  <Link
                    href={`/chat/${DEMO_SHOP.slug}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary shadow-xs hover:bg-primary-container"
                  >
                    Chat ngay
                    <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="mt-12">
          <div className="mb-6 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-primary">
                Điểm khác biệt cốt lõi
              </p>
              <h2 className="mt-1 text-2xl font-bold">
                Giải quyết triệt để bài toán “AI bịa giá” và chi phí Token
              </h2>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline"
            >
              Vào trang quản trị Chủ Shop
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="flex flex-col rounded-3xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-xs transition hover:border-primary/40"
              >
                <div className="mb-3.5 flex size-11 items-center justify-center rounded-2xl bg-primary-fixed text-primary">
                  <span className="material-symbols-outlined text-[24px]">{f.icon}</span>
                </div>
                <h3 className="text-base font-bold text-on-surface">{f.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
