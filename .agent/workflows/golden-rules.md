---
description: Hiến pháp và quy định bắt buộc khi làm việc với ứng dụng AVGFlow
---

# 🏛️ HIẾN PHÁP AVGFLOW — Quy Tắc Bất Di Bất Dịch

> Mọi thay đổi code đều PHẢI tuân thủ các quy tắc sau. Không có ngoại lệ.

---

## 📜 ĐIỀU 1: Không Lãng Phí Tài Nguyên

### 1.1 Firestore Reads
- **KHÔNG** subscribe nhiều collection cùng lúc nếu không cần thiết
- **PHẢI** dùng `limit()` cho collection có nhiều document (>50)
- **PHẢI** dùng dynamic subscription (chỉ lắng nghe khi tab/view active)
- **KHÔNG** tạo duplicate listeners cho cùng 1 collection (kiểm tra DataContext trước)

### 1.2 Firestore Writes  
- **KHÔNG** viết heartbeat/presence quá thường xuyên (tối thiểu 2 phút/lần)
- **PHẢI** dùng `localStorage` guard cho migration scripts (chạy 1 lần duy nhất)
- **PHẢI** dùng `writeBatch()` khi cập nhật nhiều documents

### 1.3 Network Requests
- **KHÔNG** gọi API thất bại liên tục (nếu source không khả dụng, dùng fallback)
- **KHÔNG** auto-refresh quá thường xuyên cho data ít thay đổi:
  - Lịch họp: tối thiểu 5 phút
  - Dữ liệu tài chính: chỉ khi user yêu cầu
  - Weather: 30 phút OK
- **PHẢI** có cache strategy (localStorage) cho data từ external API

### 1.4 Supabase
- **KHÔNG SỬ DỤNG SUPABASE** cho bất kỳ tính năng mới nào
- Tất cả data PHẢI đi qua kiến trúc: **Google Sheets → Firestore → App**
- Nếu cần database, dùng **Firestore** exclusively

---

## 📜 ĐIỀU 2: Kiến Trúc Dữ Liệu

### 2.1 Source of Truth
```
Google Sheets (Master Data) → Firestore (Real-time Cache) → App (UI)
```

### 2.2 Context Management
- **DataContext** = context chính cho toàn bộ app data
- **KHÔNG** tạo thêm context mới subscribe cùng collection với DataContext
- Nếu cần split context, PHẢI migrate listener ra khỏi DataContext (không duplicate)

### 2.3 Migration Scripts
- **PHẢI** có `localStorage` guard: `if (localStorage.getItem(KEY)) return;`
- **PHẢI** set flag SAU KHI migration thành công
- **KHÔNG** chạy migration mỗi lần app mount

---

## 📜 ĐIỀU 3: Performance

### 3.1 Bundle Size
- **KHÔNG** import thư viện không sử dụng
- **PHẢI** remove dead code (unused imports, unused functions)
- **PHẢI** dùng dynamic import cho modules nặng

### 3.2 Re-renders
- **PHẢI** dùng `useMemo`/`useCallback` cho expensive computations
- **KHÔNG** tạo inline objects/functions trong JSX nếu gây re-render

### 3.3 Console.log
- **KHÔNG** để console.log trong production cho logic chạy thường xuyên
- OK cho one-time startup logs và error handling

---

## 📜 ĐIỀU 4: Quota Management (Firebase Free Tier)

### Giới hạn hàng ngày:
| Tài nguyên | Giới hạn | Khuyến nghị |
|-----------|----------|-------------|
| Firestore Reads | 50,000/ngày | < 35,000 |
| Firestore Writes | 20,000/ngày | < 10,000 |
| Firestore Deletes | 20,000/ngày | < 5,000 |
| Storage | 1 GB | < 500 MB |

### Checklist trước khi deploy:
- [ ] Không có Supabase import mới
- [ ] Không có listener không có cleanup
- [ ] Không có setInterval < 60s (trừ countdown UI)
- [ ] Migration scripts có localStorage guard
- [ ] Không có console.log spam trong loops

---

## 📜 ĐIỀU 5: Trước Khi Thêm Tính Năng Mới

1. **Kiểm tra** xem DataContext đã có data cần thiết chưa
2. **Tính toán** số reads/writes mới sẽ phát sinh
3. **Đảm bảo** tổng quota vẫn nằm trong giới hạn free tier
4. **Ưu tiên** cache (localStorage, React state) trước khi query Firestore
5. **KHÔNG BAO GIỜ** tạo listener mà không có cleanup function

---

*Hiến pháp này được thiết lập ngày 27/03/2026 và có hiệu lực vĩnh viễn.*
