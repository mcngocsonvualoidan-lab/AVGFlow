# Weather Feature Setup Guide

## Tính năng Thời tiết dựa trên Vị trí GPS

Hệ thống đã được tích hợp tính năng hiển thị thời tiết theo vị trí GPS của từng thiết bị.

### Đặc điểm chính:
- ✅ Tự động yêu cầu quyền truy cập vị trí GPS
- ✅ Hiển thị thời tiết khác nhau cho mỗi thiết bị ở vị trí khác nhau
- ✅ Tự động cập nhật sau mỗi 30 phút
- ✅ Hiển thị chi tiết: nhiệt độ, độ ẩm, gió, tầm nhìn, áp suất
- ✅ Hỗ trợ Light/Dark mode

### Cài đặt API Key (BẮT BUỘC)

1. **Đăng ký tài khoản OpenWeatherMap (MIỄN PHÍ)**:
   - Truy cập: https://openweathermap.org/api
   - Tạo tài khoản miễn phí
   - Sau khi đăng nhập, vào "API Keys" để lấy key

2. **Cập nhật API Key**:
   - Mở file: `src/services/weatherService.ts`
   - Tìm dòng: `const API_KEY = 'YOUR_OPENWEATHER_API_KEY';`
   - Thay thế bằng key của bạn: `const API_KEY = 'abc123xyz...';`

3. **Deploy lại**:
   ```bash
   npm run build
   npx firebase deploy --only hosting
   ```

### Quyền truy cập Geolocation

Khi người dùng mở Dashboard lần đầu, trình duyệt sẽ yêu cầu quyền truy cập vị trí:
- Nếu **Cho phép** → Hiển thị thời tiết theo vị trí hiện tại
- Nếu **Từ chối** → Hiển thị nút "Thử lại" để người dùng cấp quyền

### Giới hạn API (Free Tier)
- 60 calls/phút
- 1,000,000 calls/tháng
- Hoàn toàn đủ cho ứng dụng này (mỗi user chỉ gọi API mỗi 30 phút)

### Troubleshooting

**Không hiển thị thời tiết:**
- Kiểm tra Console (F12) xem có lỗi gì
- Đảm bảo đã thay API_KEY
- Đảm bảo trình duyệt hỗ trợ Geolocation (HTTPS)
- Kiểm tra quyền Location trong browser settings

**Thời tiết không cập nhật:**
- Dữ liệu được cache 30 phút
- Refresh page để force update ngay

### Files đã tạo/sửa đổi:
- ✅ `src/services/weatherService.ts` - Weather logic
- ✅ `src/components/WeatherWidget.tsx` - UI component
- ✅ `src/modules/dashboard/Dashboard.tsx` - Integration
