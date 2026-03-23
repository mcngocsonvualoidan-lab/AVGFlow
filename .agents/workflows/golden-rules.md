---
description: Hiến pháp và quy định bắt buộc khi làm việc với ứng dụng AVGFlow
---

# 🚨 QUY ĐỊNH BẮT BUỘC — GOLDEN RULES

Các quy định dưới đây là **HIẾN PHÁP** của dự án, phải được tuân thủ tuyệt đối trong mọi tình huống.

## 1. KHÔNG BAO GIỜ BỊA THÔNG TIN

- **KHÔNG ĐƯỢC** tự bịa ra bất kỳ thông tin nào (tên người, số điện thoại, email, dữ liệu, cấu hình, v.v.) nếu không có sự cho phép và xác nhận từ USER.
- Khi cần thông tin mà không có sẵn trong codebase hoặc dữ liệu hiện tại, **PHẢI HỎI** USER trước khi điền.
- Nếu cần placeholder, phải ghi rõ đó là placeholder và hỏi USER cung cấp giá trị thực.

### Ví dụ vi phạm (KHÔNG LÀM):
- Tự đặt tên nhân sự không có trong danh sách (VD: "Lương Ngọc Doanh" khi tên thật là "Hà Ngọc Doanh")
- Tự bịa số điện thoại, email, địa chỉ
- Tự tạo dữ liệu demo mà không hỏi

### Cách làm đúng:
- Tra cứu dữ liệu từ codebase hiện tại (constants, DataContext, v.v.)
- Nếu không tìm thấy → **HỎI USER**
- Luôn xác nhận với USER trước khi sử dụng bất kỳ thông tin cá nhân/thực tế nào

## 2. NGUỒN DỮ LIỆU ĐÁNG TIN CẬY

Khi cần thông tin nhân sự, tham khảo:
- `src/constants/common.ts` → USER_SORT_ORDER (danh sách nhân sự)
- `src/context/DataContext.tsx` → Chi tiết nhân sự (tên, email, alias, phòng ban)
- Hỏi USER nếu thông tin không có trong code

---

## 3. THIẾT KẾ GIAO DIỆN — UI/UX DESIGN RULES

Tất cả giao diện trong ứng dụng AVGFlow **BẮT BUỘC** phải tuân thủ các quy tắc thiết kế sau:

### 3.1. Font chữ: Be Vietnam Pro

- **Mọi nội dung** tạo mới phải sử dụng font **Be Vietnam Pro** (Google Fonts).
- Import: `@import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@300;400;500;600;700;800;900&display=swap');`
- CSS: `font-family: 'Be Vietnam Pro', sans-serif;`
- **KHÔNG ĐƯỢC** dùng font mặc định trình duyệt hoặc font khác trừ khi USER cho phép.

### 3.2. Phong cách thiết kế: Glassmorphism (Bóng gương mờ)

Mọi component UI phải theo phong cách **Glassmorphism**:
- Background bán trong suốt: `bg-white/70 dark:bg-slate-800/70`
- Hiệu ứng backdrop blur: `backdrop-blur-xl`
- Border mờ nhẹ: `border border-white/50 dark:border-white/10`
- Shadow mềm: `shadow-sm` hoặc `shadow-lg`
- Rounded corners: `rounded-xl` hoặc `rounded-2xl`
- Gradient tinh tế cho các accent elements

#### Ví dụ chuẩn:
```css
/* Card / Panel */
background: rgba(255, 255, 255, 0.7);
backdrop-filter: blur(20px);
border: 1px solid rgba(255, 255, 255, 0.5);
border-radius: 16px;
box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
```

### 3.3. Responsive: Tự động tối ưu Mobile & PC

- **BẮT BUỘC** mọi giao diện phải hiển thị tốt trên cả **Mobile** và **PC**.
- Sử dụng Tailwind responsive prefixes: `sm:`, `md:`, `lg:`, `xl:`
- Mobile-first approach: thiết kế cho mobile trước, mở rộng cho desktop.
- Kiểm tra các breakpoint phổ biến:
  - Mobile: `< 640px`
  - Tablet: `640px - 1024px`
  - Desktop: `> 1024px`
- Layout flex/grid phải co giãn hợp lý, tránh tràn nội dung trên mobile.

### 3.4. Dropdown: Thiết kế đồng bộ

Tất cả dropdown trong ứng dụng phải:
- Theo **cùng một phong cách** thiết kế glassmorphism.
- Rounded corners: `rounded-xl`
- Background: `bg-white dark:bg-slate-800`
- Border: `border border-slate-200/50 dark:border-white/10`
- Shadow: `shadow-2xl shadow-black/20`
- Animation mở/đóng mượt mà
- Hover state rõ ràng cho từng item
- **Tham khảo dropdown đã có** trong codebase trước khi tạo mới để đảm bảo đồng bộ.

### Tóm tắt checklist trước khi code UI:
- [ ] Font: Be Vietnam Pro ✓
- [ ] Style: Glassmorphism (blur + transparency + soft border) ✓
- [ ] Responsive: Mobile + PC ✓
- [ ] Dropdown: Đồng bộ với style hiện có ✓
- [ ] Dark mode: Hỗ trợ đầy đủ ✓

---

## 4. BẢO VỆ DỮ LIỆU — DATA PROTECTION & SUPABASE SYNC

Tất cả dữ liệu bảng lấy từ Google Sheet **BẮT BUỘC** phải đi qua **Supabase** để bảo vệ chống mất dữ liệu.

### 4.1. Kiến trúc bắt buộc: Sheet → Supabase → App

```
📊 Google Sheet  →  ⚙️ Apps Script (onChange)  →  🗄️ Supabase  →  📱 Ứng dụng
                                                     ↓
                                               💾 Bảng _backup
```

- **KHÔNG ĐƯỢC** đọc trực tiếp CSV từ Google Sheet trên frontend (trừ fallback).
- Mọi bảng dữ liệu phải có **Apps Script trigger** tự động sync lên Supabase.
- Ứng dụng đọc dữ liệu từ **Supabase trước**, Sheet CSV chỉ là **fallback** khi Supabase lỗi.

### 4.2. Ba lớp bảo vệ dữ liệu (BẮT BUỘC)

Mỗi bảng sync từ Sheet → Supabase **PHẢI** có 3 lớp bảo vệ:

| Lớp | Cơ chế | Mô tả |
|---|---|---|
| **1. Ngưỡng tối thiểu** | `MIN_ROWS_TO_SYNC` | Từ chối sync nếu Sheet có ít hơn N dòng (mặc định: 10) |
| **2. Auto Backup** | `backupCurrentData()` | Tự động backup bảng hiện tại trước khi ghi đè |
| **3. Cảnh báo thất bại** | Kiểm tra % insert | Nếu >20% dòng insert thất bại → log cảnh báo |

Mỗi bảng trên Supabase cần có bảng backup tương ứng: `<tên_bảng>_backup`.

### 4.3. Tối ưu hiệu suất sync

Khi tạo Apps Script sync mới, **BẮT BUỘC** áp dụng:

- **Debounce: 5 giây** (không quá dài để đảm bảo cập nhật nhanh)
- **UPSERT thay vì DELETE + INSERT**: Chỉ sync dòng thay đổi, không xóa toàn bộ
- **Supabase Realtime**: Frontend subscribe Supabase Realtime để tự động nhận data mới (không cần user refresh)

Mục tiêu: Tổng thời gian từ sửa Sheet → App cập nhật ≤ **10 giây**.

### 4.4. Cấu trúc bảng Supabase chuẩn

Mỗi bảng sync từ Sheet phải có cấu trúc tối thiểu:

```sql
CREATE TABLE <tên_bảng> (
  id bigint primary key generated always as identity,
  row_index integer,
  row_content jsonb
);

-- Bảng backup tương ứng
CREATE TABLE <tên_bảng>_backup (
  id bigint primary key generated always as identity,
  row_index integer,
  row_content jsonb
);

-- RLS policy cho cả 2 bảng
ALTER TABLE <tên_bảng> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON <tên_bảng> FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE <tên_bảng>_backup ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON <tên_bảng>_backup FOR ALL USING (true) WITH CHECK (true);
```

### 4.5. Apps Script chuẩn cho mỗi Sheet

Mỗi Sheet cần có Apps Script với các hàm sau:

| Hàm | Chức năng |
|---|---|
| `setupTrigger()` | Cài đặt trigger onChange |
| `onSheetChange()` | Xử lý debounce → gọi sync |
| `syncSheetToSupabase()` | Sync chính (có 3 lớp bảo vệ) |
| `backupCurrentData()` | Backup tự động trước sync |
| `restoreFromBackup()` | Khôi phục từ backup |
| `manualSync()` | Sync thủ công |
| `forceSyncIgnoreProtection()` | Bypass ngưỡng (khi cần) |

Tham khảo file mẫu: `scripts/apps-script/SyncToSupabase.gs`

### 4.6. Danh sách bảng cần sync

| Bảng | Sheet | Supabase Table | Trạng thái |
|---|---|---|---|
| Thông điệp điều hành | ✅ Đã có | `executive_directives` | ✅ Hoàn tất |
| Đơn hàng (Orders) | 📊 Có Sheet | `orders` | ⏳ Chờ triển khai |
| Đơn in (Print Orders) | 📊 Có Sheet | `print_orders_sheet` | ⏳ Chờ triển khai |
| Bảng lương (Payroll) | 📊 Có Sheet | `payroll_sheet` | ⏳ Chờ triển khai |
| Bảng chấm công | 📊 Có Sheet | `attendance_sheet` | ⏳ Chờ triển khai |
| Quỹ doanh nghiệp | 📊 Có Sheet | `company_fund` | ⏳ Chờ triển khai |
| Lịch trao đổi | 📊 Có Sheet | `meeting_schedule` | ⏳ Chờ triển khai |

### Tóm tắt checklist khi thêm bảng sync mới:
- [ ] Tạo bảng + bảng backup trên Supabase ✓
- [ ] Tạo RLS policy cho cả 2 bảng ✓
- [ ] Tạo Apps Script với 3 lớp bảo vệ ✓
- [ ] Debounce ≤ 5 giây ✓
- [ ] UPSERT thay vì DELETE+INSERT ✓
- [ ] Frontend đọc Supabase trước, Sheet làm fallback ✓
- [ ] Supabase Realtime subscription trên frontend ✓
- [ ] Test: sửa Sheet → App cập nhật ≤ 10 giây ✓

### 4.7. 🚨 TỰ ĐỘNG PHÁT HIỆN & CẢNH BÁO DỮ LIỆU CHƯA ĐƯỢC BẢO VỆ

**QUY ĐỊNH BẮT BUỘC:** Khi làm việc với codebase, nếu phát hiện **bất kỳ bảng dữ liệu nào** kết nối tới ứng dụng mà **chưa có**:
- Supabase sync (vẫn đọc trực tiếp CSV từ Google Sheet)
- 3 lớp bảo vệ dữ liệu
- Bảng backup tương ứng

→ **PHẢI LẬP TỨC THÔNG BÁO** cho USER để setup, với format:

```
🚨 CẢNH BÁO: Phát hiện [Tên bảng] đang đọc trực tiếp từ Google Sheet 
   mà CHƯA CÓ bảo vệ dữ liệu Supabase!
   
   📊 Sheet ID: [ID]
   📁 Module: [đường dẫn file]
   ⚠️ Rủi ro: Nếu Sheet bị xóa/lỗi → Ứng dụng mất dữ liệu ngay lập tức
   
   → Bạn có muốn setup Supabase Sync + Backup cho bảng này không?
```

**Các dấu hiệu cần phát hiện:**
- Code chứa `spreadsheets/d/` + `gviz/tq?tqx=out:csv` → đọc trực tiếp Sheet CSV
- Code chứa `export?format=csv` → đọc trực tiếp Sheet CSV
- Bất kỳ `fetch()` nào gọi tới `docs.google.com/spreadsheets` mà **không đi qua Supabase**
- Bảng dữ liệu mới được thêm vào mà chưa có trong danh sách Mục 4.6

