# Báo cáo hiệu năng (Performance) — Visfar Academy (Task 12)

- **Ngày:** 11/11/2026 (phiên đo 23:41 +07 10/11 → ~00:45 +07 11/11)
- **Phạm vi:** `workspace/visfar-academy-platform/apps/web` (Next.js 15.4.11, React 19), production build local.
- **Người đo:** subagent Performance Task 12 (đo bằng Puppeteer/Lighthouse) + coordinator tổng hợp phần đo tĩnh sau khi agent đo trình duyệt bị chặn (xem §1).
- **Nguyên tắc:** không bịa số. Chỉ số nào không đo được ghi rõ **CHƯA ĐO + lý do**.

## 1. Kết luận tổng thể

| Hạng mục | Kết quả |
|---|---|
| **LCP (Largest Contentful Paint)** | ❌ **CHƯA ĐO** — Chrome headless không khởi động được trong môi trường này (xem §2) |
| **Lighthouse score** | ❌ **CHƯA ĐO** — cùng lý do |
| **TTFB (server, localhost)** | ✅ Đo thật: `/` 18,5 ms (lần đầu) / 2,5 ms (warm); `/chuong-trinh` 3,7 ms (xem §3) — đây là thời gian phản hồi server, **không phải LCP** |
| **Bundle / First Load JS** | ✅ Từ output `next build` thật: shared 100 kB; các trang 172–187 kB (xem §4) |
| **Lazy loading** | ⚠️ **Hầu như chưa có** — 0 `next/image`, 5 thẻ `<img>` thường, chỉ 1 có `loading="lazy"` (xem §5) |
| **Video không tải thừa** | ✅ YouTube IFrame API chỉ tải khi mở trang bài học, bất đồng bộ, có xử lý lỗi (xem §6) |
| **Trạng thái lỗi / phục hồi** | ✅ Có ở nhiều trang (kiểm chứng tĩnh, xem §7) |
| **Responsive** | ⚠️ Kiểm chứng tĩnh: 8 media query (700/900/1020px); **chưa đo trên trình duyệt/thiết bị thật** (xem §8) |
| **Lỗi JavaScript nghiêm trọng** | ⚠️ Build + test chạy không lỗi; **chưa kiểm tra console trên trình duyệt thật** (xem §9) |

**Verdict hiệu năng: CHƯA ĐẠT ĐỦ ĐIỀU KIỆN KẾT LUẬN.** Mục tiêu LCP ≤ 2,5s **chưa được đo** — không thể khẳng định đạt hay không đạt. Các số đo server và bundle đều tốt, nhưng đó không phải là trải nghiệm render trên trình duyệt thật.

## 2. Vì sao LCP/Lighthouse CHƯA ĐO (bằng chứng)

Agent đo đã chạy ~62 phút (23:41 +07 10/11 → ~00:43 +07 11/11), đã:
- Cài `chrome-headless-shell@stable` qua `@puppeteer/browsers` thành công.
- Chạy `next build` (log `~/.perf-task12/build*.log`) và `next dev` trên cổng 3101.
- Viết script đo `~/.perf-task12/measure.js` và chạy `measure-run.log`.

**Lỗi chặn (trích nguyên văn từ `~/.perf-task12/measure-run.log`, 17:18 UTC):**

```text
FATAL Error: Failed to launch the browser process!
[1110/171800.347163:ERROR:chrome/app/chrome_main_delegate.cc:1283] Hatch WebGL domain policy is required for browser startup
```

Chrome headless bị chặn khởi động bởi chính sách WebGL domain của môi trường Hatch (VM này). Agent đã thử nhiều lần cài/chạy lại và im lặng ~15 phút cuối trước khi coordinator đóng task và chuyển sang đo tĩnh. **Không có số LCP, FCP, CLS, INP, Speed Index hay điểm Lighthouse nào được đo trong phiên này — mọi con số như vậy (nếu xuất hiện ở nơi khác) đều là bịa.**

**Điều kiện cần để đo thật LCP sau này:** chạy Lighthouse/Web Vitals trên một máy/môi trường cho phép Chrome khởi động (máy dev của user, hoặc Cloudflare Pages preview + Lighthouse từ máy khác), trên trang production thật, đo cả desktop và mobile (390px).

## 3. Đo thật: thời gian phản hồi server (TTFB, localhost)

Chạy production server từ bản build hiện có (`npx next start -p 3102`, coordinator đo bằng `curl`, 11/11/2026 ~00:45 +07):

| Route | HTTP | TTFB | Tổng thời gian | Kích thước HTML |
|---|---|---|---|---|
| `GET /` (lần đầu, cold) | 200 | **18,5 ms** | 18,5 ms | 13.530 B |
| `GET /` (lần 2, warm) | 200 | **2,5 ms** | 2,6 ms | 13.530 B |
| `GET /chuong-trinh` | 200 | **3,7 ms** | 3,8 ms | 12.336 B |

Lưu ý: đây là đo trên **localhost trong cùng VM** (không có mạng, không có CDN, không render trình duyệt). TTFB thấp là tín hiệu tốt cho server, nhưng **không suy ra LCP** — LCP còn phụ thuộc tải JS/CSS, render font, và mạng thật của người dùng.

## 4. Bundle — từ output `next build` thật

(Bảng route trong log build của agent đo + báo cáo QA `TEST_REPORT.md` §2.4–2.5; build PASS, 31/31 trang.)

| Chỉ số | Giá trị |
|---|---|
| First Load JS shared bởi mọi trang | **100 kB** (chunks 44 kB + 54,1 kB + 1,95 kB khác) |
| Middleware | 34,4 kB |
| Trang nặng nhất | `/chuong-trinh/[slug]` — **187 kB** First Load |
| Trang bài học | `/hoc-vien/khoa-hoc/[courseSlug]/bai/[lessonSlug]` — **183 kB** |
| Trang `/tu-van` | 172 kB; `/chuong-trinh` 172 kB; `/` — xem HTML (13,5 kB HTML, JS theo bảng route) |
| Tổng `.next/static/chunks/` | 1,7 MB (toàn bộ chunk của app, không phải tải 1 lần) |

Đánh giá: First Load JS ~172–187 kB là mức vừa phải cho app Next.js (dưới ngưỡng 200 kB thường được coi là nặng); shared 100 kB là chấp nhận được. Không có chunk nào bất thường lớn. **Nhưng đây là kích thước JS, không phải thời gian render — không thay thế LCP.**

## 5. Lazy loading — ⚠️ hầu như chưa có

Kiểm chứng bằng grep toàn `apps/web/src` (11/11/2026):

| Kiểm tra | Kết quả |
|---|---|
| `next/image` | **0 lần sử dụng** — không dùng tối ưu ảnh của Next.js (không resize, không modern format, không lazy mặc định) |
| Thẻ `<img>` thường | **5 thẻ** trong toàn app |
| `loading="lazy"` | **Chỉ 1 thẻ** (`CertificateCard.tsx:82` — ảnh chứng chỉ) |
| 4 thẻ `<img>` còn lại không lazy | Avatar học viên (`hoc-vien/page.tsx:169`, `ho-so/page.tsx:148`), ảnh bài học (`bai/[lessonSlug]/page.tsx:157`), ảnh thanh toán (`thanh-toan/[orderId]/page.tsx:231`) |

Đánh giá: số lượng ảnh trong app hiện rất ít (5 thẻ), và các ảnh không lazy đều là ảnh trên màn hình chính của trang đó (avatar, ảnh bài học) nên tác động thực tế hiện tại là **thấp**. Nhưng khi thêm poster khóa học/ảnh sự kiện/blog vào app, cần dùng `next/image` + lazy để không kéo chậm trang. Ghi nhận là việc cải thiện, không phải lỗi chặn.

## 6. Video — ✅ không tải thừa

Kiểm chứng `src/components/course/LessonPlayer.tsx` (dòng 78–101):

- YouTube IFrame API (`https://www.youtube.com/iframe_api`) chỉ được tải khi component `LessonPlayer` mount — tức **chỉ khi mở trang bài học video**, không tải ở trang chủ, trang khóa học hay bất kỳ trang nào khác.
- Tải bất đồng bộ (`tag.async = true`), có xử lý lỗi: `onerror` → thông báo “Không tải được YouTube. Vui lòng kiểm tra mạng và thử lại.”
- Video dùng `youtube-nocookie` embed (theo báo cáo Task 07/08).

Đánh giá: đúng yêu cầu “không tải video không cần thiết”. **Chưa kiểm chứng phát video thật** (xem TEST_REPORT §4, mục Video — PASS giới hạn).

## 7. Trạng thái lỗi và phương án phục hồi — ✅ có (kiểm chứng tĩnh)

Grep chuỗi “Đang tải / Có lỗi / Thử lại” trong `src/**/*.tsx` tìm thấy ở ít nhất 12 file trang, gồm: `/chuong-trinh`, `/chuong-trinh/[slug]`, `/dang-nhap`, `/hoc-vien`, `/hoc-vien/ho-so`, `/hoc-vien/khoa-hoc`, trang bài học, trang bài tập + chấm bài, `/hoc-vien/lich-su`, `/hoc-vien/thong-bao`, `/hoc-vien/don-hang`. Các trang dữ liệu đều có nhánh loading / error / empty + nút thử lại (theo báo cáo Task 05–08 và grep đợt này).

Giới hạn: chỉ kiểm chứng **sự tồn tại** của các nhánh này trong code, chưa kiểm chứng hiển thị thật trên trình duyệt (mất mạng thật, Supabase lỗi thật).

## 8. Responsive — ⚠️ kiểm chứng tĩnh, chưa đo thật

- `src/styles/globals.css` có **8 media query** tại các breakpoint 700px / 900px / 1020px (2×1020, 3×700, 2×900 + 1 khác).
- Tiêu chuẩn mobile của dự án (body ≥16px, 1 cột, tap target ≥44px, không tràn ngang) áp cho trang HTML gốc đã được kiểm chứng 2026-11-10; app Next.js mới **chưa được đo trên trình duyệt/thiết bị thật** (390px/768px/1440px).
- Ghi nhận: **CHƯA ĐO** responsive trên trình duyệt thật — cần kiểm tra bằng Lighthouse mobile + kiểm tra tay trên điện thoại thật sau khi deploy preview.

## 9. Lỗi JavaScript nghiêm trọng — ⚠️ chưa kiểm tra trên trình duyệt thật

- `npm run build` PASS (31/31 trang, không lỗi prerender), `npm test` 547/548 pass (hiệu lực), typecheck + lint PASS (xem TEST_REPORT.md §2).
- **Chưa có lần chạy nào mở app trên trình duyệt thật và đọc console** — nên không khẳng định được “không có lỗi JS nghiêm trọng” trong môi trường chạy thật. Cần kiểm tra console khi đo Lighthouse.

## 10. Việc cần làm để đủ điều kiện kết luận hiệu năng

1. **Đo Lighthouse thật** (Performance + Accessibility + Best Practices + SEO) trên môi trường cho phép Chrome chạy — đo cả desktop và mobile (390px), trên domain preview/production thật, ghi lại LCP/FCP/CLS/INP và điểm số.
2. Kiểm tra console trình duyệt thật (không lỗi JS nghiêm trọng) và kiểm tra responsive bằng tay trên điện thoại thật.
3. Cân nhắc dùng `next/image` cho ảnh (đặc biệt khi thêm poster/ảnh sự kiện) và thêm `loading="lazy"` cho ảnh dưới màn hình đầu tiên.
4. Sau khi có số Lighthouse: nếu LCP > 2,5s thì tối ưu theo gợi ý Lighthouse (thường là: giảm JS chặn render, preload font, nén ảnh) rồi đo lại.

---

*Báo cáo này không bịa bất kỳ chỉ số Web Vitals nào. LCP, FCP, CLS, INP và điểm Lighthouse đều ghi CHƯA ĐO với lý do đầy đủ ở §2.*
