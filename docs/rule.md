# HỆ THỐNG QUẢN TRỊ SẢN XUẤT & VẬN HÀNH THÔNG MINH (AVGFlow)

Tài liệu này mô tả chi tiết về chức năng, luồng dữ liệu và kiến trúc phân quyền của hệ thống AVGFlow.

---

## 1. Tổng quan Hệ thống
AVGFlow là một nền tảng ERP mini (Enterprise Resource Planning) tập trung tối ưu hóa quy trình sản xuất, theo dõi tiến độ đơn hàng theo thời gian thực (Real-time), quản lý nhân sự và tự động hóa tính lương. Hệ thống kết nối liền mạch các bộ phận: Kinh doanh, Thiết kế, Sản xuất, QC và Giao vận.

---

## 2. Các Phân hệ Chức năng (Modules)

### A. Trung tâm Điều hành (Dashboard)
- **Tổng quan dự án:** Dashboard hiển thị trực quan các chỉ số vĩ mô như Tổng đơn hàng, Thời gian xử lý trung bình, Tỷ lệ lỗi lại (Rework Rate).
- **Biểu đồ hiệu suất:** Phân tích năng suất làm việc theo thời gian thực của từng bộ phận và cá nhân.
- **Giám sát tiến độ:** Theo dõi trạng thái đơn hàng (đang chạy, sắp trễ hạn, đã hoàn thành).

### B. Quản lý Quy trình (Workflow & Orders)
- **Tracking Đơn hàng:** Theo dõi vòng đời đơn hàng khép kín: *Khởi tạo -> Thiết kế -> Sản xuất -> QC -> Giao vận*.
- **Timeline Gương (Mirror Timeline):** Ghi lại lịch sử chi tiết mọi tác động lên đơn hàng (Ai? Bộ phận nào? Làm gì? Lúc nào?).
- **Quản lý Rework (Lỗi):** 
  - Đánh dấu đơn hàng bị trả lại/làm lại.
  - Ghi nhận "Lý do lỗi" và "Nguồn gốc lỗi" để phục vụ đánh giá KPI.

### C. Quản lý Nhiệm vụ (Task Manager)
- **Giao việc:** Tạo task, gán người thực hiện, deadline và mức độ ưu tiên (Urgent, High, Normal).
- **Liên kết:** Task có thể liên kết trực tiếp với một Mã Đơn Hàng (Order ID) để truy xuất nguồn gốc công việc.
- **Tương tác:** Hỗ trợ đính kèm tài liệu, link thiết kế và mô tả công việc (Markdown).

### D. Văn bản & Bình chọn (Conclusion Docs)
- **Kho tri thức:** Lưu trữ văn bản quy định, kết luận cuộc họp (Tích hợp trình xem PDF/Word online).
- **Vinh danh:** Hệ thống bình chọn nhân sự xuất sắc hàng tháng, có đếm ngược thời gian đóng cổng bình chọn.

### E. Nhân sự & Tiền lương (HR & Payroll)
- **Hồ sơ nhân sự số:** Quản lý thông tin chi tiết (Ngày sinh, Hợp đồng, Bank account).
- **Thanh toán QR:** Tích hợp mã QR Banking cá nhân cho từng nhân sự để kế toán quét thanh toán lương nhanh.
- **Bảng lương tự động:** 
  - *Công thức:* Lương cứng + Phụ cấp (Ăn, Xăng, ĐT) + Thưởng (KPI, Chuyên cần) - Khấu trừ.
  - Tự động tổng hợp và xuất phiếu lương.

### F. Tiện ích & Lịch (Utilities)
- **Lịch họp thông minh:** Quản lý book lịch họp, hệ thống tự động gửi thông báo nhắc nhở trước 30p và 15p (Real-time Notification).
- **Gắn kết nội bộ:** Tự động nhắc sinh nhật, gửi thiệp chúc mừng/chia buồn/đám cưới.

---

## 3. Kiến trúc Phân quyền (User Roles & Authorization)

Hệ thống sử dụng **Firebase Authentication** và phân quyền dựa trên dữ liệu người dùng trong **Firestore**.

### Cấp 1: Super Admin (Quản trị viên Tối cao)
**Đặc điểm:** Tài khoản có cờ `isAdmin: true` trong database.

**Quyền hạn:**
- **Admin Panel:** Truy cập trang quản trị ẩn (Root Access).
- **CRUD Dữ liệu:** Sửa/Xóa mọi dữ liệu hệ thống (User, Task, Log, Lương) bất chấp quy trình.
- **Quản lý User:** Thêm mới nhân sự, reset mật khẩu, chỉnh sửa thông tin nhạy cảm (Lương, Hợp đồng).
- **Quản lý Hệ thống:** Upload văn bản pháp lý, kiểm soát bình chọn.

### Cấp 2: Standard User (Nhân viên)
**Đặc điểm:** Tài khoản nhân viên thông thường.

**Quyền hạn:**
- **Vận hành:** Xem dashboard, cập nhật trạng thái đơn hàng/task thuộc trách nhiệm của mình.
- **Cá nhân hóa (Settings):**
  - Tùy chỉnh giao diện (Dark Mode, Ngôn ngữ).
  - **Tự cập nhật Avatar:** Được phép thay đổi ảnh đại diện cá nhân (Upload -> Crop -> Save).
  - *Không thể sửa các thông tin nhân sự cốt lõi (Lương, Hợp đồng).*
- **Tương tác:** Tham gia bình chọn (1 phiếu/tháng), nhận thông báo.
- **Hạn chế:** Không được phép xóa dữ liệu hệ thống hoặc xem thông tin lương của người khác.

---

## 4. Cơ chế Kỹ thuật Nổi bật

1.  **Real-time Synchronization:**
    Sử dụng `onSnapshot` của Firestore để đồng bộ hóa dữ liệu tức thì giữa tất cả các thiết bị đang online. Mọi thay đổi (trạng thái đơn, thông báo mới) đều hiển thị ngay lập tức không cần F5.

2.  **Smart Upload & Auto-Save:**
    - **Admin:** Khi Admin upload avatar cho nhân viên, hệ thống thực hiện "Silent Save" (Lưu ngầm) ngay lập tức để đảm bảo dữ liệu không bị mất nếu quên bấm nút Lưu.
    - **User:** User tự upload avatar tại trang Settings, hệ thống tự động resize ảnh về 1000x1000px, crop vuông và cập nhật hồ sơ ngay lập tức.

3.  **Hạ tầng:**
    - **Frontend:** React + TypeScript + Vite.
    - **Design:** Tailwind CSS (Glassmorphism UI).
    - **Backend/DB:** Firebase (Firestore, Authentication, Storage).
