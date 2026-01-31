# HƯỚNG DẪN SỬA LỖI DNS (Thủ Công)

Hệ thống xác định các bản ghi DNS chưa được tạo thành công trên Cloudflare. Vui lòng làm theo các bước sau để thêm thủ công:

1. Đăng nhập vào [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Chọn tên miền **auvietglobal.com**.
3. Vào menu bên trái: **DNS** > **Records**.
4. Bấm nút màu xanh **Add record** để thêm lần lượt 3 bản ghi dưới đây:

---

### 1. Bản ghi DKIM (Xác thực tên miền)
* **Type:** `TXT`
* **Name (Required):** `resend._domainkey`
* **Content:** (Copy toàn bộ chuỗi bắt đầu bằng `p=...` từ trang Resend)
* **Proxy status:** ☁️ **DNS Only** (Tắt đám mây vàng đi thành màu xám)
* Bấm **Save**.

### 2. Bản ghi MX (Cho phép gửi mail)
* **Type:** `MX`
* **Name (Required):** `send`
* **Mail Server:** `feedback-smtp.us-east-1.amazonses.com`
* **Priority:** `10`
* **Proxy status:** ☁️ **DNS Only** (Tắt đám mây vàng)
* Bấm **Save**.

### 3. Bản ghi SPF (Chống Spam)
* **Type:** `TXT`
* **Name (Required):** `send`
* **Content:** `v=spf1 include:amazonses.com ~all`
* **Proxy status:** ☁️ **DNS Only** (Tắt đám mây vàng)
* Bấm **Save**.

---
**Sau khi làm xong:**
Quay lại trang Resend, bấm vào nút **Status: Failed** hoặc nút refresh ở góc để nó kiểm tra lại. Sẽ mất khoảng 1-5 phút để chuyển sang màu xanh **Verified**.
