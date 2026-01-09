export const translations = {
    vi: {
        common: {
            search: "Tìm kiếm...",
            filter: "Bộ lọc",
            add: "Thêm mới",
            edit: "Chỉnh sửa",
            delete: "Xóa",
            cancel: "Hủy bỏ",
            save: "Lưu lại",
            update: "Cập nhật",
            status: "Trạng thái",
            date: "Ngày tạo",
            department: "Bộ phận",
            role: "Chức vụ",
            email: "Email",
            phone: "SĐT",
            address: "Địa chỉ",
            loading: "Đang tải...",
            error: "Có lỗi xảy ra",
            success: "Thành công",
            confirm: "Xác nhận",
            adminMode: "Chế độ Admin",
            aiAnalysis: "Phân tích AI",
            print: "In phiếu",
            export: "Xuất dữ liệu",
            download: "Tải xuống",
            newest: "Mới nhất",
            completed: "Hoàn thành",
            processing: "Đang xử lý",
            rework: "Tái sản xuất",
            pending: "Chờ xử lý",
            active: "Hoạt động",
            datePicker: {
                months: ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"],
                weekdays: ["T2", "T3", "T4", "T5", "T6", "T7", "CN"],
                time: "Thời gian",
                done: "Xong"
            }
        },
        sidebar: {
            dashboard: "Tổng quan",
            workflow: "Quy trình",
            tasks: "Nhiệm vụ",
            users: "Nhân sự",
            reports: "Báo cáo",
            settings: "Cài đặt"
        },
        header: {
            aiActive: "AVGFlow AI Active",
            searchPlaceholder: "Tìm kiếm...",
            noNotifications: "Chưa có thông báo mới"
        },
        dashboard: {
            welcome: "Chào mừng trở lại,",
            projectOverview: "Tổng quan Dự án",
            globalProgress: "Tiến độ Toàn cục",
            personnelPerf: "Hiệu suất Nhân sự",
            resourceAlloc: "Phân bổ Nguồn lực",
            totalOrders: "Tổng đơn hàng",
            avgTime: "Thời gian TB",
            reworkRate: "Tỷ lệ Rework",
            distribution: "Phân bổ",
            systemData: "Dữ liệu Hệ thống",
            checkProcess: "Kiểm tra quy trình",
            normal: "Bình thường",
            insights: "Thông tin chi tiết",
            activeOrders: "Đơn hàng đang xử lý",
            completionRate: "Tỷ lệ hoàn thành",
            reworkNotes: "đơn cần xử lý lại"
        },
        auth: {
            title: "Đăng nhập Hệ thống",
            subtitle: "Quản lý quy trình sản xuất thông minh",
            googleLogin: "Đăng nhập bằng Google",
            email: "Email",
            password: "Mật khẩu",
            login: "Đăng nhập",
            forgotPass: "Quên mật khẩu?",
            resetPass: "Cấp lại mật khẩu",
            resetDesc: "Nhập email để nhận liên kết đặt lại mật khẩu",
            backToLogin: "Quay lại đăng nhập",
            sendLink: "Gửi liên kết",
            logout: "Đăng xuất",
            welcome: "Xin chào",
            error: "Đã xảy ra lỗi",
            resetSent: "Đã gửi email đặt lại mật khẩu!",
            permissionDenied: "Bạn không có quyền truy cập hệ thống này."
        },
        users: {
            title: "Quản lý Nhân sự",
            subtitle: "Hệ thống hóa quy trình làm việc trực quan",
            systemTitle: "Hệ thống Nhân sự & Thanh toán",
            systemDesc: "Quản lý đầu mối tiếp nhận và mã QR thanh toán cá nhân",
            addBtn: "Thêm nhân sự",
            searchPlaceholder: "Tìm nhân sự...",
            form: {
                name: "Họ và tên",
                alias: "Mật danh (Auto-fill)",
                dept: "Bộ phận",
                role: "Chức vụ",
                bank: "Ngân hàng",
                accNum: "Số tài khoản",
                randomAvatar: "Random Avatar",
                update: "Cập nhật Info",
                create: "Khởi tạo ID"
            },
            card: {
                clickZoom: "Click để phóng to",
                systemVerify: "Xác thực hệ thống",
                verified: "Verified",
                pending: "Pending"
            },
            alerts: {
                nameRequired: "Vui lòng nhập tên nhân sự!",
                updateSuccess: "Đã cập nhật thông tin nhân sự!",
                addSuccess: "Đã thêm nhân sự mới thành công!",
                confirmDelete: "Bạn có chắc chắn muốn xóa nhân sự này?"
            }
        },
        tasks: {
            title: "Quản lý Nhiệm vụ",
            subtitle: "Theo dõi và phân công công việc",
            create: "Tạo nhiệm vụ mới",
            searchPlaceholder: "Tìm ID, Tiêu đề...",
            columns: {
                todo: "Cần làm",
                inProgress: "Đang thực hiện",
                review: "Đang duyệt",
                done: "Hoàn thành"
            },
            priority: {
                urgent: "Khẩn cấp",
                high: "Cao",
                normal: "Bình thường",
                low: "Thấp"
            },
            panel: {
                linkedOrder: "ĐƠN HÀNG LIÊN KẾT",
                noLink: "-- KHÔNG LIÊN KẾT --",
                targetSector: "BỘ PHẬN TIẾP NHẬN",
                personnelIdentity: "ĐỊNH DANH NHÂN SỰ",
                deadlineTarget: "MỤC TIÊU DEADLINE",
                commandDetails: "CHI TIẾT CHỈ THỊ",
                markdownSupported: "HỖ TRỢ MARKDOWN",
                placeholder: "> Nhập chỉ thị chi tiết tại đây...",
                attachFile: "Đính file",
                addLink: "Thêm Link",
                submit: "GIAO VIỆC NGAY"
            }
        },
        workflow: {
            title: "Danh sách đơn hàng",
            searchPlaceholder: "Tìm theo ID, khách hàng...",
            filterStatus: "Lọc trạng thái",
            timeline: "Lịch sử & Mirror Timeline",
            statusUpdate: "Cập nhật trạng thái",
            reworkReason: "Lý do lỗi",
            reworkOrigin: "Nguồn gốc",
            emptyState: "Chưa chọn đơn hàng",
            linkedTasks: "Nhiệm vụ liên quan",
            modal: {
                title: "Cập nhật trạng thái",
                newStatus: "Trạng thái mới",
                issueReason: "Lý do vấn đề / Rework",
                issuePlaceholder: "Mô tả vấn đề...",
                progress: "Tiến độ",
                note: "Ghi chú (Tùy chọn)",
                notePlaceholder: "Thêm ghi chú vào timeline...",
                save: "Lưu cập nhật"
            }
        },
        reports: {
            title: "Trung tâm Báo cáo",
            subtitle: "Hệ thống hóa quy trình làm việc trực quan",
            centerTitle: "Trung tâm Báo cáo & Xuất dữ liệu",
            timeFilters: {
                today: "Hôm nay",
                week: "Tuần này",
                month: "Tháng này"
            },
            cards: {
                delivery: "Phiếu Xuất kho",
                deliveryDesc: "Tổng hợp các đơn hàng đã sẵn sàng giao",
                deptPerf: "Năng suất Bộ phận",
                deptDesc: "Thống kê thời gian xử lý trung bình",
                summary: "Tổng hợp Đơn hàng",
                summaryDesc: "Báo cáo chi tiết trạng thái vĩ mô"
            },
            table: {
                rawTitle: "Dữ liệu thô (Real-time Logs)",
                headers: {
                    id: "Mã Đơn",
                    customer: "Khách Hàng",
                    dept: "Bộ Phận",
                    status: "Trạng Thái",
                    created: "Khởi Tạo"
                }
            },
            export: {
                csv: "Tải CSV",
                fullReport: "XUẤT BÁO CÁO TỔNG"
            }
        },
        settings: {
            title: "Cấu hình Hệ thống",
            subtitle: "Quản lý tùy chọn cá nhân và thiết lập hệ thống",
            interface: "Giao diện & Trải nghiệm",
            darkMode: "Chế độ Tối (Dark Mode)",
            darkModeDesc: "Giao diện tối giúp dịu mắt khi làm việc đêm",
            language: "Ngôn ngữ (Language)",
            languageDesc: "Ngôn ngữ hiển thị chính của hệ thống",
            notifications: "Thông báo & Cảnh báo",
            emailDigest: "Email Digest",
            emailDigestDesc: "Nhận báo cáo tổng hợp vào 8:00 sáng",
            pushNotif: "Push Notifications",
            pushNotifDesc: "Cảnh báo thời gian thực trên mobile",
            security: "Bảo mật & Tài khoản",
            changePass: "Đổi mật khẩu",
            lastChanged: "Lần đổi cuối: 30 ngày trước",
            update: "Cập nhật",
            twoFactor: "Xác thực 2 lớp (2FA)",
            twoFactorDesc: "Tăng cường bảo mật khi đăng nhập",
            data: "Dữ liệu & Backup",
            autoBackup: "Tự động sao lưu",
            backupDesc: "Backup dữ liệu mỗi 24h",
            active: "Active",
            cache: "Quản lý Cache hệ thống",
            cancel: "Hủy bỏ",
            save: "Lưu thay đổi",
            saving: "Đang lưu...",
            saveSuccess: "Lưu cài đặt thành công!",
            pushSuccess: "Đã bật thông báo thành công!",
            pushBlocked: "Bạn đã chặn thông báo."
        }
    },
    en: {
        common: {
            search: "Search...",
            filter: "Filter",
            add: "Add New",
            edit: "Edit",
            delete: "Delete",
            cancel: "Cancel",
            save: "Save",
            update: "Update",
            status: "Status",
            date: "Date",
            department: "Department",
            role: "Role",
            email: "Email",
            phone: "Phone",
            address: "Address",
            loading: "Loading...",
            error: "Error occurred",
            success: "Success",
            confirm: "Confirm",
            adminMode: "Admin Mode",
            aiAnalysis: "AI Analysis",
            print: "Print Ticket",
            export: "Export Data",
            download: "Download",
            newest: "Newest",
            completed: "Completed",
            processing: "Processing",
            rework: "Rework",
            pending: "Pending",
            active: "Active",
            datePicker: {
                months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
                weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                time: "Time",
                done: "Done"
            }
        },
        sidebar: {
            dashboard: "Dashboard",
            workflow: "Workflow",
            tasks: "Task Manager",
            users: "Personnel",
            reports: "Reports",
            settings: "Settings"
        },
        header: {
            aiActive: "AVGFlow AI Active",
            searchPlaceholder: "Search orders, people...",
            noNotifications: "No new notifications"
        },
        dashboard: {
            welcome: "Welcome back,",
            projectOverview: "Project Overview",
            globalProgress: "Global Progress",
            personnelPerf: "Personnel Performance",
            resourceAlloc: "Resource Allocation",
            totalOrders: "Total Orders",
            avgTime: "Avg Time",
            reworkRate: "Rework Rate",
            distribution: "Distribution",
            systemData: "System Data",
            checkProcess: "Check process",
            normal: "Normal",
            insights: "Insights",
            activeOrders: "orders processing",
            completionRate: "Completion rate",
            reworkNotes: "orders need rework"
        },
        auth: {
            title: "System Login",
            subtitle: "Intelligent Production Workflow Management",
            googleLogin: "Sign in with Google",
            email: "Email",
            password: "Password",
            login: "Login",
            forgotPass: "Forgot password?",
            resetPass: "Reset Password",
            resetDesc: "Enter email to receive reset link",
            backToLogin: "Back to Login",
            sendLink: "Send Link",
            logout: "Logout",
            welcome: "Welcome",
            error: "An error occurred",
            resetSent: "Password reset email sent!",
            permissionDenied: "You do not have permission to access the system."
        },
        users: {
            title: "Personnel Management",
            subtitle: "Visualized workflow system",
            systemTitle: "Personnel & Payment System",
            systemDesc: "Manage points of contact and personal QR payments",
            addBtn: "Add Personnel",
            searchPlaceholder: "Find personnel...",
            form: {
                name: "Full Name",
                alias: "Alias (Auto-fill)",
                dept: "Department",
                role: "Position",
                bank: "Bank",
                accNum: "Account Number",
                randomAvatar: "Random Avatar",
                update: "Update Info",
                create: "Create ID"
            },
            card: {
                clickZoom: "Click to zoom",
                systemVerify: "System Verification",
                verified: "Verified",
                pending: "Pending"
            },
            alerts: {
                nameRequired: "Please enter personnel name!",
                updateSuccess: "Personnel info updated!",
                addSuccess: "New personnel added successfully!",
                confirmDelete: "Are you sure you want to delete this user?"
            }
        },
        tasks: {
            title: "Task Management",
            subtitle: "Track and assign work",
            create: "Create New Task",
            searchPlaceholder: "Search ID, Title...",
            columns: {
                todo: "To Do",
                inProgress: "In Progress",
                review: "Review",
                done: "Done"
            },
            priority: {
                urgent: "Urgent",
                high: "High",
                normal: "Normal",
                low: "Low"
            },
            panel: {
                linkedOrder: "LINKED ORDER",
                noLink: "-- NO LINK --",
                targetSector: "TARGET SECTOR",
                personnelIdentity: "PERSONNEL IDENTITY",
                deadlineTarget: "DEADLINE TARGET",
                commandDetails: "COMMAND DETAILS",
                markdownSupported: "MARKDOWN SUPPORTED",
                placeholder: "> Enter detailed instructions here...",
                attachFile: "Attach File",
                addLink: "Add Link",
                submit: "ASSIGN TASK NOW"
            }
        },
        workflow: {
            title: "Order List",
            searchPlaceholder: "Search by ID, customer...",
            filterStatus: "Filter Status",
            timeline: "History & Mirror Timeline",
            statusUpdate: "Update Status",
            reworkReason: "Rework Reason",
            reworkOrigin: "Origin",
            emptyState: "No order selected",
            linkedTasks: "Linked Tasks",
            modal: {
                title: "Update Status",
                newStatus: "New Status",
                issueReason: "Issue / Rework Reason",
                issuePlaceholder: "Describe the issue...",
                progress: "Progress",
                note: "Note (Optional)",
                notePlaceholder: "Add a note to the timeline...",
                save: "Save Update"
            }
        },
        reports: {
            title: "Reports Center",
            subtitle: "Visualized workflow system",
            centerTitle: "Reports & Data Export Center",
            timeFilters: {
                today: "Today",
                week: "This Week",
                month: "This Month"
            },
            cards: {
                delivery: "Delivery Ticket",
                deliveryDesc: "Summary of orders ready for delivery",
                deptPerf: "Dept Productivity",
                deptDesc: "Average processing time statistics",
                summary: "Order Summary",
                summaryDesc: "Detailed macro status report"
            },
            table: {
                rawTitle: "Raw Data (Real-time Logs)",
                headers: {
                    id: "Order ID",
                    customer: "Customer",
                    dept: "Dept",
                    status: "Status",
                    created: "Created"
                }
            },
            export: {
                csv: "Download CSV",
                fullReport: "EXPORT FULL REPORT"
            }
        },
        settings: {
            title: "System Configuration",
            subtitle: "Manage personal preferences and system settings",
            interface: "Interface & Experience",
            darkMode: "Dark Mode",
            darkModeDesc: "Dark mode reduces eye strain at night",
            language: "Language",
            languageDesc: "Primary display language",
            notifications: "Notifications & Alerts",
            emailDigest: "Email Digest",
            emailDigestDesc: "Receive summary report at 8:00 AM",
            pushNotif: "Push Notifications",
            pushNotifDesc: "Real-time mobile alerts",
            security: "Security & Account",
            changePass: "Change Password",
            lastChanged: "Last changed: 30 days ago",
            update: "Update",
            twoFactor: "2-Factor Auth (2FA)",
            twoFactorDesc: "Enhanced login security",
            data: "Data & Backup",
            autoBackup: "Auto Backup",
            backupDesc: "Backup data every 24h",
            active: "Active",
            cache: "Manage System Cache",
            cancel: "Cancel",
            save: "Save Changes",
            saving: "Saving...",
            saveSuccess: "Settings saved successfully!",
            pushSuccess: "Notifications enabled!",
            pushBlocked: "You have blocked notifications."
        }
    }
};

export type Language = 'vi' | 'en';
