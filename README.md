# SmartSales Web

Frontend Next.js/React hiện có cho Customer Chat. Định hướng mới: Catalog-First Sales Assistant; roadmap ở [build checklist](../docs/build-checklist-final.md), kiến trúc ở [architecture](../docs/architecture.md).

## Hiện trạng từ source

- `src/app/chat/[slug]/page.tsx`: Customer Chat theo shop slug.
- `src/features/chat/hooks/useChatDemo.ts`: resolve shop, gửi chat SSE, lưu conversation ID phía client, click tracking và trạng thái lỗi.
- `src/lib/api/` và `src/types/`: API client/types; JSON chat và SSE có cấu trúc product cards khác nhau, cần giữ mapping.
- Merchant Dashboard/auth chưa có trong route tree được rà soát. Chưa xác nhận MVP hoàn thành hoặc chạy end-to-end.

Giữ stack hiện tại. Tới phase UI mới bổ sung màn catalog/import, hội thoại và thống kê tối giản sau khi backend có auth/quyền shop. Không xây màn reindex hoặc hiển thị dữ liệu quản trị giả.

## Chạy frontend local

Từ thư mục này, cài dependencies theo lockfile rồi dùng script hiện có:

```powershell
npm.cmd ci
npm.cmd run dev
```

URL mặc định `http://localhost:3000`; cấu hình `NEXT_PUBLIC_API_BASE_URL` theo `.env.example` và origin CORS backend. Chỉ public config được đưa vào client; không có Gemini key, DB URL hoặc service key trong bundle.

Gửi chat tới backend cấu hình Gemini hiện tại có thể gọi API thật, kể cả bước intent. E2E/automation phải dùng fake backend/provider đã kiểm chứng và chặn outbound AI theo [testing policy](../docs/testing.md). Lượt sửa docs chưa chạy demo hoặc xác minh setup.

## Contract và kiểm tra

[API map](../docs/backend-frontend-api-map.md) và [SSE contract](../backend/docs/chat-stream.md) là baseline hiện hữu. Khi backend refactor phải giữ tương thích JSON/SSE hoặc cập nhật client có mapping rõ. Conversation ID/localStorage không thay thế session authorization; không tái sử dụng hội thoại khác shop/customer.

Scripts hiện có: `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd run format:check`. Chỉ chạy checks liên quan khi tới phase triển khai. `generate:api` đọc `openapi.json` local; chỉ regenerate khi contract thực thay đổi, không dùng kiến trúc đích như schema đã triển khai.

Trước khi viết code Next.js, đọc [AGENTS.md](AGENTS.md) và guide phù hợp của phiên bản đã cài. Lượt hiện tại chỉ sửa Markdown, không đổi code/config/dependencies.
