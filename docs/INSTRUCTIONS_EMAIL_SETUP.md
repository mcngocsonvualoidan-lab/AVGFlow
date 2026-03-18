# Hướng dẫn Thiết lập Gửi Email Thật (Real Email System)

Hiện tại, hệ thống đã được lập trình sẵn để gửi lệnh email. Để email thực sự được gửi đi, bạn cần thực hiện các bước cấu hình Server sau đây trên Firebase Console.

## Bước 0: Chuẩn bị
1. **Thẻ thanh toán Quốc tế:** Bạn cần thẻ Visa/Mastercard (Debit hoặc Credit) để nâng cấp tài khoản Firebase lên gói **Blaze (Pay as you go)**.
   * *Lưu ý: Google chỉ giữ tạm $0 hoặc $1 để xác minh thẻ, bạn sẽ không bị trừ tiền nếu dùng dưới hạn mức miễn phí (Free Tier) rất lớn.*

2. **Dịch vụ Email (SMTP):** Chúng ta sẽ dùng một dịch vụ gửi mail miễn phí. Khuyên dùng **Resend** hoặc **SendGrid**.
   * Ví dụ với **Resend** (Dễ nhất):
     * Truy cập [Resend.com](https://resend.com) -> Đăng ký tài khoản.
     * Tạo API Key mới.
     * Xác thực Domain (Nếu có website riêng) hoặc dùng thử qua email cá nhân được cấp phép.

## Bước 1: Nâng cấp Firebase
1. Truy cập [Firebase Console](https://console.firebase.google.com/).
2. Chọn dự án **AVG Flow**.
3. Ở góc dưới bên trái, chỗ chữ **Spark Plan**, bấm nút **Upgrade**.
4. Chọn gói **Blaze Plan**.
5. Nhập thông tin thẻ và hoàn tất.

## Bước 2: Cài đặt Extension "Trigger Email"
Đây là tiện ích giúp tự động hóa việc gửi mail mà không cần viết code server phức tạp.
1. Tại Menu bên trái Firebase Console, chọn **Extensions**.
2. Tìm kiếm **"Trigger Email"** (của Firebase).
3. Bấm **Install**.
4. Chọn dự án của bạn và bấm Next.
5. Cấu hình Extension:
   * **Cloud Functions location:** Chọn `asia-southeast1` (Singapore) hoặc `us-central1`.
   * **Collection:** Nhập chính xác chữ `mail` (Code đã viết sẵn để đẩy vào bảng này).
   * **Default FROM address:** Email gửi đi (ví dụ: `noreply@avgflow.com`).
   * **SMTP connection URI:** Đây là chuỗi kết nối quan trọng. Nếu dùng **Resend**, nó sẽ có dạng:
     `smtps://resend:[YOUR_API_KEY]@smtp.resend.com:465`
     *(Thay [YOUR_API_KEY] bằng mã API bạn lấy ở Bước 0)*.

6. Bấm **Install Extension**. Quá trình cài đặt sẽ mất khoảng 3-5 phút.

## Bước 3: Kiểm tra
1. Sau khi cài đặt xong, quay lại ứng dụng **Admin Panel**.
2. Bấm nút "Cảnh báo Đăng nhập" (Hình cái chuông).
3. Hệ thống sẽ:
   * Gửi thông báo In-app ngay lập tức.
   * Tạo một bản ghi mới trong bảng `mail` của Firestore.
   * Extension sẽ tự động đọc bản ghi này, gửi email qua Resend/SendGrid.
   * Nếu thành công, bản ghi trong bảng `mail` sẽ có thêm trường `delivery: { state: "SUCCESS" }`.

## Xử lý lỗi
* Nếu email không đến, hãy kiểm tra tab **Logs** trong phần Functions của Firebase Console.
* Đảm bảo API Key của SMTP đúng quyền gửi mail.
