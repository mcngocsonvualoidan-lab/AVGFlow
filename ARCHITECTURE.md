# 📁 AVGFlow - Cấu Trúc Dự Án (Project Architecture)

## 🔍 Phân Tích Cấu Trúc Hiện Tại

```
src/
├── App.tsx                    # Entry point, Router config
├── main.tsx                   # React mount
├── index.css                  # Global styles
├── sw.ts                      # Service Worker (PWA)
├── assets/                    # Static assets
├── components/                # ⚠️ MIX: Shared + Feature-specific
│   ├── ActiveUsersWidget.tsx
│   ├── BiometricSetupPrompt.tsx
│   ├── ChatWidget.tsx         # Large 43KB!
│   ├── ErrorBoundary.tsx
│   ├── Header.tsx             # Large 32KB!
│   ├── InvitationModal.tsx
│   ├── Layout.tsx
│   ├── RealtimeChatWidget.tsx # Large 42KB!
│   ├── Sidebar.tsx            # 16KB
│   ├── SmartIdentityPicker.tsx
│   ├── TetDecorations.tsx
│   ├── ToastContainer.tsx
│   └── UpdateNotification.tsx
├── constants/                 # App constants
├── context/                   # React Contexts
│   ├── AuthContext.tsx
│   ├── DataContext.tsx        # ⚠️ HUGE 53KB - needs splitting!
│   ├── LanguageContext.tsx
│   └── ThemeContext.tsx
├── hooks/                     # Custom hooks
├── i18n/                      # Translations
├── lib/                       # External libraries init
│   ├── firebase.ts
│   ├── gemini.ts
│   └── supabase.ts
├── modules/                   # Feature modules ✅ (Good pattern!)
│   ├── admin/
│   ├── apps/
│   ├── auth/
│   ├── communication/
│   ├── dashboard/
│   ├── documents/
│   ├── finance/
│   ├── hr/
│   ├── schedule/
│   ├── settings/
│   ├── tasks/
│   └── timekeeping/
├── services/                  # API/Business logic
│   ├── backupService.ts
│   ├── chatService.ts
│   ├── directiveService.ts
│   └── realtimeChatService.ts
└── utils/                     # Utility functions
    ├── biometricAuth.ts
    ├── emailService.ts
    ├── pushManager.ts
    └── supabaseClient.ts
```

---

## ⚠️ Vấn Đề Cần Khắc Phục

| # | Vấn đề | Mức độ | Giải pháp |
|---|--------|--------|-----------|
| 1 | `DataContext.tsx` quá lớn (53KB) | 🔴 Critical | Tách thành nhiều context nhỏ |
| 2 | `components/` lẫn lộn shared và feature-specific | 🟡 Medium | Di chuyển vào modules tương ứng |
| 3 | `utils/` vs `services/` không rõ ràng | 🟡 Medium | Hợp nhất hoặc phân loại rõ |
| 4 | Thiếu barrel exports (index.ts) | 🟢 Low | Thêm index.ts cho từng folder |
| 5 | Thiếu types folder | 🟢 Low | Tách interfaces ra riêng |

---

## ✅ Cấu Trúc Đề Xuất (Recommended Architecture)

```
src/
├── app/                          # 🆕 App-level config
│   ├── App.tsx
│   ├── routes.tsx               # Centralized routing
│   └── providers.tsx            # All context providers wrapped
│
├── assets/                       # Static files
│   ├── images/
│   └── icons/
│
├── components/                   # 🔧 ONLY shared/reusable UI
│   ├── ui/                      # Atomic UI (Button, Input, Modal...)
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Modal.tsx
│   │   ├── Toggle.tsx
│   │   └── index.ts
│   ├── layout/                  # Layout components
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Layout.tsx
│   │   └── index.ts
│   ├── feedback/                # Notifications, Toasts
│   │   ├── ToastContainer.tsx
│   │   ├── UpdateNotification.tsx
│   │   └── index.ts
│   └── index.ts                 # Barrel export
│
├── config/                       # 🆕 Configuration
│   ├── constants.ts
│   ├── routes.ts
│   └── permissions.ts
│
├── contexts/                     # 🔧 Split into smaller pieces
│   ├── auth/
│   │   ├── AuthContext.tsx
│   │   └── useAuth.ts
│   ├── theme/
│   │   ├── ThemeContext.tsx
│   │   └── useTheme.ts
│   ├── language/
│   │   ├── LanguageContext.tsx
│   │   └── useLanguage.ts
│   ├── data/                    # 🆕 Split DataContext!
│   │   ├── UsersContext.tsx
│   │   ├── TasksContext.tsx
│   │   ├── NotificationsContext.tsx
│   │   ├── MeetingsContext.tsx
│   │   ├── PayrollContext.tsx
│   │   └── index.ts
│   └── index.ts
│
├── features/                     # 🔧 Rename modules → features
│   ├── admin/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── AdminPanel.tsx
│   │   └── index.ts
│   ├── auth/
│   │   ├── components/
│   │   ├── Login.tsx
│   │   ├── AdminLogin.tsx
│   │   └── index.ts
│   ├── chat/                    # 🆕 Extracted from components
│   │   ├── ChatWidget.tsx
│   │   ├── RealtimeChatWidget.tsx
│   │   ├── chatService.ts
│   │   └── index.ts
│   ├── dashboard/
│   │   ├── components/
│   │   │   ├── StatsCards.tsx
│   │   │   ├── InternalNewsBoard.tsx
│   │   │   └── index.ts
│   │   ├── Dashboard.tsx
│   │   └── index.ts
│   ├── documents/
│   │   ├── ConclusionDocs.tsx
│   │   ├── ExecutiveDirectives.tsx
│   │   ├── Reports.tsx
│   │   ├── Workflow.tsx
│   │   └── index.ts
│   ├── finance/
│   │   ├── Income.tsx
│   │   ├── BusinessFund.tsx
│   │   └── index.ts
│   ├── hr/
│   │   ├── UserManagement.tsx
│   │   ├── MyBirthdayWishes.tsx
│   │   └── index.ts
│   ├── schedule/
│   │   ├── MeetingSchedule.tsx
│   │   └── index.ts
│   ├── settings/
│   │   ├── Settings.tsx
│   │   ├── BiometricSettings.tsx
│   │   └── index.ts
│   ├── tasks/
│   │   ├── TaskManager.tsx
│   │   └── index.ts
│   ├── timekeeping/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── utils.ts
│   │   ├── TimekeepingLayout.tsx
│   │   └── index.ts
│   └── apps/                    # AI Apps Portal
│       ├── AppsPortal.tsx
│       └── index.ts
│
├── hooks/                        # 🔧 Global hooks only
│   ├── useDebounce.ts
│   ├── useLocalStorage.ts
│   ├── useMediaQuery.ts
│   └── index.ts
│
├── lib/                          # External library initializations
│   ├── firebase.ts
│   ├── supabase.ts
│   ├── gemini.ts
│   └── index.ts
│
├── services/                     # 🔧 Global API services only
│   ├── api/
│   │   ├── firebaseApi.ts
│   │   └── supabaseApi.ts
│   ├── notifications/
│   │   ├── pushManager.ts
│   │   ├── emailService.ts
│   │   └── index.ts
│   ├── backup/
│   │   ├── backupService.ts
│   │   └── index.ts
│   └── index.ts
│
├── styles/                       # 🆕 Centralized styles
│   ├── globals.css
│   ├── variables.css
│   └── animations.css
│
├── types/                        # 🆕 TypeScript types/interfaces
│   ├── user.types.ts
│   ├── task.types.ts
│   ├── notification.types.ts
│   ├── meeting.types.ts
│   ├── payroll.types.ts
│   └── index.ts
│
├── utils/                        # 🔧 Pure utility functions only
│   ├── date.ts
│   ├── format.ts
│   ├── validation.ts
│   ├── storage.ts
│   └── index.ts
│
├── i18n/                         # Internationalization
│   ├── translations.ts
│   └── index.ts
│
├── main.tsx                      # Entry point
└── sw.ts                         # Service Worker
```

---

## 🎯 Nguyên Tắc Tổ Chức (Organization Principles)

### 1️⃣ Feature-First Architecture
Mỗi tính năng (feature) là một folder độc lập chứa:
- `components/` - UI components riêng của feature
- `hooks/` - Custom hooks riêng
- `services/` - API calls riêng
- `types.ts` - Types riêng
- `index.ts` - Barrel export

### 2️⃣ Separation of Concerns
| Layer | Trách nhiệm | Ví dụ |
|-------|-------------|-------|
| `components/` | UI rendering | Button, Modal |
| `hooks/` | State logic | useDebounce |
| `services/` | API/Business logic | chatService |
| `utils/` | Pure functions | formatDate |
| `types/` | TypeScript interfaces | User, Task |

### 3️⃣ Import Rules
```typescript
// ✅ GOOD: Import from barrel exports
import { Button, Modal } from '@/components/ui';
import { useAuth } from '@/contexts/auth';
import { User, Task } from '@/types';

// ❌ BAD: Deep imports
import { Button } from '@/components/ui/Button';
```

### 4️⃣ Naming Conventions
| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `UserCard.tsx` |
| Hooks | camelCase with `use` prefix | `useDebounce.ts` |
| Services | camelCase with `Service` suffix | `chatService.ts` |
| Utils | camelCase | `formatDate.ts` |
| Types | PascalCase with `.types.ts` | `user.types.ts` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_FILE_SIZE` |

---

## 📊 Ưu Tiên Tái Cấu Trúc

### Phase 1: Critical (Tuần 1)
- [ ] Tách `DataContext.tsx` thành các context nhỏ
- [ ] Di chuyển Chat components vào `features/chat/`
- [ ] Tạo `types/` folder với interfaces

### Phase 2: Important (Tuần 2)
- [ ] Thêm barrel exports (index.ts) cho tất cả folders
- [ ] Tổ chức lại `components/` theo phân loại
- [ ] Tách services ra khỏi utils

### Phase 3: Nice-to-have (Tuần 3)
- [ ] Rename `modules/` → `features/`
- [ ] Tạo `config/` folder
- [ ] Setup path aliases trong tsconfig

---

## 🔧 Ví Dụ Tách DataContext

### Trước (53KB trong 1 file):
```tsx
// DataContext.tsx - 1377 lines!
interface User { ... }
interface Task { ... }
interface Notification { ... }
// ... everything mixed
```

### Sau (Tách ra nhiều files):
```
contexts/data/
├── types.ts              # All interfaces
├── UsersContext.tsx      # Users state & actions
├── TasksContext.tsx      # Tasks state & actions
├── NotificationsContext.tsx
├── MeetingsContext.tsx
├── PayrollContext.tsx
├── DataProvider.tsx      # Combines all providers
└── index.ts              # Barrel export
```

---

## 🚀 Lệnh Thực Thi (nếu bạn muốn tôi tiến hành)

Hãy xác nhận nếu bạn muốn tôi:

1. **Tách DataContext** thành các context nhỏ
2. **Di chuyển Chat components** vào features/chat/
3. **Tạo types folder** với interfaces riêng
4. **Thêm barrel exports** cho tất cả folders

Trả lời "tiến hành" để tôi bắt đầu Phase 1.
