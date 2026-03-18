# 🚀 AVG Flow — Enterprise Operations Platform

> Nền tảng quản lý vận hành doanh nghiệp tích hợp, xây dựng bằng React + TypeScript + Firebase.

## 📋 Tổng quan

AVG Flow là ứng dụng web PWA quản lý toàn diện các hoạt động doanh nghiệp bao gồm:

| Module | Mô tả |
|--------|-------|
| **Dashboard** | Tổng quan, biểu đồ thống kê, tin tức nội bộ |
| **Timekeeping** | Chấm công, thống kê giờ làm, phép năm |
| **Orders** | Quản lý đơn hàng in ấn & thiết kế |
| **Tasks** | Quản lý công việc và tiến độ |
| **Finance** | Quỹ doanh nghiệp, thu nhập nhân sự |
| **HR** | Quản lý nhân sự, hồ sơ, portfolio |
| **Documents** | Văn bản kết luận, chỉ đạo điều hành |
| **Schedule** | Lịch họp & sự kiện |
| **Communication** | Chat AI, tin nhắn thời gian thực |
| **Minigame** | Trò chơi giải trí nội bộ |
| **Settings** | Cài đặt ứng dụng |

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, TailwindCSS
- **Backend**: Firebase (Firestore, Auth, Storage, Functions, Hosting)
- **Storage**: Cloudflare R2 (file uploads via Worker proxy)
- **AI**: Google Gemini API
- **PWA**: Vite PWA Plugin + Service Worker

## 📁 Cấu trúc Thư mục

```
azure-nebula/
├── docs/                    # Tài liệu dự án
│   ├── email-templates/     # Template email HTML
│   └── *.md                 # Hướng dẫn, phân tích, setup
├── functions/               # Firebase Cloud Functions
├── public/                  # Static assets (icons, images, manifest)
├── scripts/                 # Scripts tiện ích
│   ├── workers/             # Cloudflare Workers
│   └── *.mjs               # Migration, backup scripts
├── src/
│   ├── components/          # Shared UI components
│   │   └── ui/              # Base UI primitives
│   ├── constants/           # App constants
│   ├── context/             # React Context providers
│   ├── features/            # Feature-specific logic
│   ├── hooks/               # Custom React hooks
│   ├── i18n/                # Internationalization
│   ├── lib/                 # Library configs (Firebase, Gemini, Supabase)
│   ├── modules/             # Feature modules (pages)
│   │   ├── admin/           # Admin panel
│   │   ├── apps/            # Apps portal
│   │   ├── auth/            # Authentication
│   │   ├── communication/   # AI Chat
│   │   ├── dashboard/       # Dashboard & internal news
│   │   ├── documents/       # Document management
│   │   ├── finance/         # Financial management
│   │   ├── hr/              # Human resources & portfolio
│   │   ├── minigame/        # Entertainment games
│   │   ├── orders/          # Print & design orders
│   │   ├── schedule/        # Meeting schedule
│   │   ├── settings/        # App settings
│   │   ├── tasks/           # Task management
│   │   └── timekeeping/     # Time tracking
│   ├── services/            # API & business logic services
│   ├── types/               # TypeScript type definitions
│   └── utils/               # Utility functions
├── firebase.json            # Firebase config
├── firestore.rules          # Firestore security rules
├── storage.rules            # Storage security rules
├── database.rules.json      # Realtime Database rules
└── vite.config.ts           # Vite build config
```

## 🚀 Khởi chạy

```bash
# Cài đặt dependencies
npm install

# Chạy dev server
npm run dev

# Build production
npm run build

# Deploy lên Firebase
npx firebase deploy
```

## 🔑 Environment

Tạo file `ext.env` với các biến:
```
VITE_GEMINI_API_KEY=...
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## 📝 License

Private — AVG Corporation
