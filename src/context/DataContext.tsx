import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { db } from '../lib/firebase';
import { supabase } from '../lib/supabase';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, writeBatch, query, orderBy, limit, where, getDocs } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { backupDataToSupabase } from '../services/backupService';


// --- INTERFACES ---

export interface LeaveRecord {
    id: string;
    type: 'leave' | 'absence' | 'online';
    session?: 'full' | 'morning' | 'afternoon'; // Added session type
    start: string; // ISO
    end: string; // ISO
    reason: string;
    approvedBy?: string;
}

export interface User {
    id: string;
    name: string;
    alias: string;
    role: string;
    dept: string;
    email: string;
    phone: string;
    avatar: string;
    bankAcc: string;
    bankName: string;
    isAdmin?: boolean;
    verified?: boolean;
    dob?: string;
    startDate?: string;
    employeeCode?: string;
    contractNo?: string;
    leaves?: LeaveRecord[];
    lastSeen?: string;
    customQrUrl?: string; // Manual Banking QR Override
    permissions?: UserPermissions; // NEW: RBAC Permissions
}

export interface UserPermissions {
    dashboard?: { view: boolean; edit: boolean };
    tasks?: { view: boolean; edit: boolean };
    workflow?: { view: boolean; edit: boolean };
    reports?: { view: boolean; edit: boolean };
    users?: { view: boolean; edit: boolean };
    finance?: { view: boolean; edit: boolean };
    schedule?: { view: boolean; edit: boolean };
    documents?: { view: boolean; edit: boolean };
    timekeep?: { view: boolean; edit: boolean }; // Adding timekeep just in case
    ai_chat?: { view: boolean; edit: boolean };
}

export interface Task {
    id: string;
    title: string;
    assigneeId: string; // Link to User.id
    priority: 'urgent' | 'high' | 'normal';
    deadline: string; // ISO string for easier storage
    status: 'active' | 'completed' | 'pending' | 'archived';
    department: string;
    orderId?: string; // Optional link to an 'Order'
    taskCode?: string; // Unique code: ORDER-DEPT-SEQUENCE (e.g., ORD001-TK-01)
    description?: string;
    attachments: { type: 'link' | 'file'; url: string; name: string }[];
    acceptedAt?: string; // Timestamp when user clicked 'Receive Task'
    warningSent?: boolean; // To track if low-time warning has been sent
    createdAt: string;
}

export interface TimelineEvent {
    id: string;
    department: string;
    timestamp: string;
    status: 'completed' | 'in-progress' | 'pending' | 'rework';
    note?: string;
    images?: string[];
    reworkReason?: string;
    reworkOrigin?: string;
}

export interface OrderLog {
    id: string;
    customer: string;
    dept: string;
    status: 'completed' | 'rework' | 'processing';
    created: string;
    // Enhanced fields
    progress?: number;
    timeline?: TimelineEvent[];
    dueDate?: string;
    deliveryAttempts?: number;
}

export interface Notification {
    id: string;
    title: string;
    message: string;
    time: string;
    read: boolean;
    type: 'alert' | 'success' | 'info' | 'error';
}

export interface BirthdayWish {
    id: string;
    fromUserId: string;
    fromUserName: string;
    toUserId: string;
    message: string;
    timestamp: string;
    isRead: boolean;
    type?: 'birthday' | 'wedding' | 'funeral';
}

export interface ActiveEvent {
    id: string;
    userId: string;
    userName: string;
    type: 'wedding' | 'funeral';
    date: string;
}

export interface Toast {
    id: string;
    title: string;
    message: string;
    type: 'success' | 'info' | 'alert' | 'error';
}

export interface PayrollRecord {
    id: string;
    month: string; // YYYY-MM
    userId: string;
    employeeCode: string; // Ma NV
    fullName: string;
    position: string;
    department: string;

    // Main Columns
    basicSalary: number;
    actualWorkDays: number;

    // Allowances
    allowanceMeal: number;
    allowanceFuel: number; // Xang xe
    allowancePhone: number; // Dien thoai
    allowanceAttendance: number; // Chuyen can
    totalAllowanceActual: number;

    // Additional
    incomeMentalHealth: number; // Suc khoe tinh than
    incomeOvertime: number; // Them gio
    incomeQuality: number; // Chat luong VHKL
    incomeSpecial: number; // Cong viec dac thu
    incomeOfficer: number; // Can bo hoi chat luong
    incomeKPI: number;
    totalAdditional: number;

    totalActualIncome: number;

    insuranceCompany: number;
    insuranceEmployee: number;
    advancePayment: number; // Tam ung/Phat

    totalIncome: number;
    netPay: number;
}

export interface Meeting {
    id: string;
    scope: string;
    date: string;
    day: string;
    startTime: string;
    endTime: string;
    duration: string;
    content: string;
    pic: string;
    participants: string;
    secretary: string;
    note: string;
    link: string;
    isHighlight?: boolean;
    remindersSent?: {
        dayBefore?: boolean;
        min30?: boolean;
        min15?: boolean;
    };
}

interface DataContextType {
    users: User[];
    tasks: Task[];
    logs: OrderLog[];
    notifications: Notification[];
    toasts: Toast[];
    setToasts: React.Dispatch<React.SetStateAction<Toast[]>>;
    addNotification: (n: any) => Promise<void>;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    clearNotifications: () => Promise<void>;
    invitation: { title: string; body: string } | null;
    setInvitation: React.Dispatch<React.SetStateAction<{ title: string; body: string } | null>>;
    birthdayWishes: BirthdayWish[];
    activeEvents: ActiveEvent[];

    payrollRecords: PayrollRecord[];
    meetings: Meeting[];

    addMeeting: (meeting: Meeting) => void;
    updateMeeting: (meeting: Meeting) => void;
    deleteMeeting: (id: string) => void;
    removeToast: (id: string) => void;
    addPayrollRecord: (record: PayrollRecord) => void;
    updatePayrollRecord: (record: PayrollRecord) => void;
    deletePayrollRecord: (id: string) => void;
    addUser: (user: User) => void;
    updateUser: (user: User) => void;
    deleteUser: (id: string) => void;
    addTask: (task: Task) => void;
    updateTask: (task: Task) => void;
    deleteTask: (id: string) => void;
    markTaskAsAccepted: (taskId: string) => void;
    addLog: (log: OrderLog) => void;
    updateLog: (log: OrderLog) => void;
    addBirthdayWish: (wish: BirthdayWish) => void;
    markWishAsRead: (id: string) => void;
    addActiveEvent: (event: ActiveEvent) => void; // New
    showTetDecor: boolean;
    toggleTetDecor: () => void;
    isLoaded: boolean;
    restoreDefaults: () => Promise<void>;
}

// --- MOCK INITIAL DATA ---


export const initialUsers: User[] = [
    {
        id: '1',
        name: 'Nguyễn Mạnh Thành',
        alias: 'THANH-FIN',
        role: 'Trưởng phòng Tài chính',
        dept: 'Tài chính - Kế toán',
        email: 'thanhnguyen.icg@gmail.com',
        phone: '0937651896',
        avatar: 'https://ui-avatars.com/api/?name=Thanh+Nguyen&background=0ea5e9&color=fff',
        bankAcc: '0937651896',
        bankName: 'Techcombank',
        verified: true,
        dob: '1996-12-09',
        startDate: '2024-10-01',
        employeeCode: 'NV012',
        contractNo: 'N2-010/2024/HĐLĐ-HJ'
    },
    {
        id: '2',
        name: 'Trần Hải Lưu',
        alias: 'LUU-HR',
        role: 'Chuyên viên Nhân sự',
        dept: 'Hồ sơ năng lực',
        email: 'hailuu1998@gmail.com',
        phone: '0705491164',
        avatar: 'https://ui-avatars.com/api/?name=Hai+Luu&background=8b5cf6&color=fff',
        bankAcc: '300698666',
        bankName: 'VIB',
        verified: true,
        dob: '1998-06-30',
        startDate: '2024-12-01',
        employeeCode: 'NV017',
        contractNo: 'N2-013/2024/HĐLĐ-HJ'
    },
    {
        id: '3',
        name: 'Lê Trần Thiện Tâm',
        alias: 'TAM-OUT',
        role: 'Quản lý Đầu ra',
        dept: 'InterData',
        email: 'cambridgeorg.209@gmail.com',
        phone: '0354126398',
        avatar: 'https://ui-avatars.com/api/?name=Thien+Tam&background=f59e0b&color=fff',
        bankAcc: '106879222277',
        bankName: 'Vietinbank',
        verified: true,
        dob: '2002-09-20',
        startDate: '2024-10-01',
        employeeCode: 'NV004',
        contractNo: 'N2-015/2024/HĐLĐ-HJ'
    },
    {
        id: '4',
        name: 'Lê Thị Ánh Nguyệt',
        alias: 'NGUYET-DATA',
        role: 'Chuyên viên Dữ liệu',
        dept: 'Dữ liệu',
        email: 'lenguyet011@gmail.com',
        phone: '0336308512',
        avatar: 'https://ui-avatars.com/api/?name=Anh+Nguyet&background=ec4899&color=fff',
        bankAcc: '03326847601',
        bankName: 'TPBank',
        verified: true,
        dob: '1999-10-13',
        startDate: '2024-09-01',
        employeeCode: 'NV011',
        contractNo: 'N2-005/2024/HĐLĐ-HJ'
    },
    {
        id: '5',
        name: 'Nguyễn Ngọc Sơn',
        alias: 'SON-ADMIN',
        role: 'Quản trị viên / Thiết kế',
        dept: 'Thiết kế',
        email: 'mcngocsonvualoidan@gmail.com',
        phone: '0336936926',
        avatar: 'https://ui-avatars.com/api/?name=Ngoc+Son&background=6366f1&color=fff',
        bankAcc: '19032652518011',
        bankName: 'Techcombank',
        isAdmin: true,
        verified: true,
        dob: '1996-04-07',
        startDate: '2024-12-01',
        employeeCode: 'NV005',
        contractNo: 'N2-016/2024/HĐLĐ-HJ'
    },
    {
        id: '6',
        name: 'Hà Ngọc Doanh',
        alias: 'DOANH-DES',
        role: 'Chuyên viên Thiết kế',
        dept: 'Thiết kế',
        email: 'hangocdoanh1242001@gmail.com',
        phone: '0867927728',
        avatar: 'https://ui-avatars.com/api/?name=Ngoc+Doanh&background=10b981&color=fff',
        bankAcc: '9000112042001',
        bankName: 'MB',
        verified: true,
        dob: '2001-04-12',
        startDate: '2024-12-01',
        employeeCode: 'NV006',
        contractNo: 'N2-014/2024/HĐLĐ-HJ',
        leaves: [
            {
                id: 'l_doanh_1',
                type: 'absence',
                start: '2026-01-10',
                end: '2026-01-10',
                reason: 'Nghỉ không lương'
            }
        ]
    },
    {
        id: '7',
        name: 'Đinh Hoàng Ngọc Hân',
        alias: 'HAN-INFO',
        role: 'Thông tin Đầu ra',
        dept: 'InterData',
        email: 'trolitct@gmail.com',
        phone: '0869413365',
        avatar: 'https://ui-avatars.com/api/?name=Ngoc+Han&background=f97316&color=fff',
        bankAcc: '0869413365',
        bankName: 'VPBank',
        verified: true,
        dob: '2002-10-28',
        startDate: '2024-09-01',
        employeeCode: 'NV014',
        contractNo: 'N2-004/2024/HĐLĐ-HJ'
    },
    {
        id: '8',
        name: 'Lê Thị Nga',
        alias: 'NGA-LEGAL',
        role: 'Chuyên viên Pháp lý',
        dept: 'Pháp lý',
        email: 'lenga.orga@gmail.com',
        phone: '0936263320',
        avatar: 'https://ui-avatars.com/api/?name=Thi+Nga&background=64748b&color=fff',
        bankAcc: '0936263320',
        bankName: 'VPBank',
        verified: true,
        dob: '1988-02-17',
        startDate: '2024-09-01',
        employeeCode: 'NV002',
        contractNo: 'N2-001/2024/HĐLĐ-HJ'
    },
    {
        id: '9',
        name: 'Nguyễn Thị Quỳnh Nga',
        alias: 'QUYNHNGA',
        role: 'Chuyên viên',
        dept: 'R&D - Nghiên cứu & Phát triển',
        email: 'quynhnga.avg@gmail.com',
        phone: '0354589044',
        avatar: 'https://ui-avatars.com/api/?name=Quynh+Nga&background=f43f5e&color=fff',
        bankAcc: '106870476947',
        bankName: 'Vietinbank',
        verified: true,
        dob: '2001-01-06',
        startDate: '2024-09-01',
        employeeCode: 'NV009',
        contractNo: 'N2-006/2024/HĐLĐ-HJ',
        leaves: [
            {
                id: 'l_nga_1',
                type: 'absence',
                start: '2026-01-03',
                end: '2026-01-03',
                reason: 'Nghỉ không lương'
            }
        ]
    },
    {
        id: '10',
        name: 'Phan Thị Hải',
        alias: 'HAI-PHAN',
        role: 'Chuyên viên',
        dept: 'R&D - Nghiên cứu & Phát triển',
        email: 'phanhai.avg@gmail.com',
        phone: '0344896073',
        avatar: 'https://ui-avatars.com/api/?name=Thi+Hai&background=14b8a6&color=fff',
        bankAcc: '9344896073',
        bankName: 'Vietcombank',
        verified: true,
        dob: '2000-02-21',
        startDate: '2024-09-01',
        employeeCode: 'NV008',
        contractNo: 'N2-008/2024/HĐLĐ-HJ',
        leaves: [
            {
                id: 'l_hai_1',
                type: 'absence',
                start: '2026-01-03',
                end: '2026-01-03',
                reason: 'Nghỉ không lương'
            },
            {
                id: 'l_hai_2',
                type: 'absence',
                start: '2026-01-19',
                end: '2026-01-19',
                reason: 'Nghỉ không lương'
            }
        ]
    },

];





const initialMeetings: Meeting[] = [
    {
        id: 'M1',
        scope: 'P1',
        day: 'Thứ 7',
        date: '2026-01-03',
        startTime: '16:20',
        endTime: '17:30',
        duration: '70',
        content: '1. Rà soát công việc;\n2. Liệt kê cái sai.',
        pic: '#',
        participants: '4.T: Các đầu mối kỹ thuật AVG (có #K1)',
        secretary: 'Kiến',
        note: '',
        link: ''
    },
    {
        id: 'M_SPECIAL',
        scope: '',
        day: '',
        date: '',
        startTime: '',
        endTime: '',
        duration: '',
        content: 'THỜI GIAN LÀM VIỆC TẬP TRUNG\nĐối với nội dung thúc đẩy giảm tải công việc cho bà Trang sẽ được DH xen kẽ trong các buổi trao đổi',
        pic: '',
        participants: '',
        secretary: '',
        note: '',
        link: '',
        isHighlight: true
    },
    {
        id: 'M2',
        scope: '',
        day: 'Thứ 3',
        date: '2026-01-06',
        startTime: '09:30',
        endTime: '12:00',
        duration: '150',
        content: 'Tổng thể kế hoạch công việc',
        pic: 'DH',
        participants: '- Chủ đầu tư AVG: bà Trang, ông Huy\n- DH tạm thời AVG;\n- Các đầu mối kỹ thuật AVG',
        secretary: '9',
        note: '',
        link: ''
    },
    {
        id: 'M3',
        scope: '',
        day: 'Thứ 4',
        date: '2026-01-07',
        startTime: '14:30',
        endTime: '17:30',
        duration: '180',
        content: 'Tổng kết và công bố;\nPhân tích; định hình 11 nhóm nhiệm vụ 2026;',
        pic: 'DH',
        participants: '- Chủ đầu tư AVG: bà Trang; ông Huy\n- DH tạm thời AVG;\n- Các đầu mối kỹ thuật AVG\n- Chị Hải + Nga RDI',
        secretary: '8',
        note: '- Mời RDI; Kế toán, đội thị trường AV',
        link: ''
    },
    {
        id: 'M4',
        scope: '',
        day: 'Thứ 4',
        date: '2026-01-07',
        startTime: '20:00',
        endTime: '22:00',
        duration: '120',
        content: '',
        pic: '',
        participants: '',
        secretary: '6',
        note: 'Dự phòng theo tình hình thực tiễn',
        link: ''
    },
    {
        id: 'M5',
        scope: '',
        day: 'Thứ 5',
        date: '2026-01-08',
        startTime: '14:30',
        endTime: '17:30',
        duration: '180',
        content: '- Chủ đề/ nội dung Mr 8: Link/line\n- Chủ đề/ nội dung liên quan đến Kiến',
        pic: '8',
        participants: '',
        secretary: '5.1B',
        note: '',
        link: ''
    },
    {
        id: 'M6',
        scope: '',
        day: 'Thứ 5',
        date: '2026-01-08',
        startTime: '20:00',
        endTime: '22:00',
        duration: '120',
        content: '',
        pic: '',
        participants: '',
        secretary: '#',
        note: 'Dự phòng theo tình hình thực tiễn',
        link: ''
    },
    {
        id: 'M7',
        scope: '',
        day: 'Thứ 6',
        date: '2026-01-09',
        startTime: '14:30',
        endTime: '17:30',
        duration: '180',
        content: 'Nội dung đầu mối đặt hàng',
        pic: '',
        participants: '',
        secretary: '5.1T',
        note: 'Anh Doanh nghỉ',
        link: ''
    },
    {
        id: 'M8',
        scope: '',
        day: 'Thứ 6',
        date: '2026-01-09',
        startTime: '20:00',
        endTime: '22:00',
        duration: '120',
        content: '',
        pic: '',
        participants: '',
        secretary: '2.1',
        note: 'Anh Doanh nghỉ, dự phòng theo tình hình thực tiễn',
        link: ''
    },
    {
        id: 'M9',
        scope: '',
        day: 'Thứ 7',
        date: '2026-01-10',
        startTime: '10:00',
        endTime: '12:00',
        duration: '120',
        content: '1. Nghiệp vụ của đầu mối đặt hàng\n2. Rà soát nghiệp vụ;\n3. Liệt kê lỗi sai',
        pic: '',
        participants: '',
        secretary: '3.2S',
        note: '',
        link: ''
    },
    {
        id: 'M10',
        scope: '',
        day: 'Thứ 7',
        date: '2026-01-10',
        startTime: '14:30',
        endTime: '17:30',
        duration: '180',
        content: '',
        pic: '',
        participants: '',
        secretary: '',
        note: '- Anh Thành có thể nghỉ buổi chiều;\n- Chị Nga, anh Doanh, anh Thành, Hân bận buổi tối',
        link: ''
    }
];


const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider = ({ children }: { children: ReactNode }) => {
    const { currentUser } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const usersRef = useRef<User[]>([]); // Ref to access latest users in closures without dependency loop

    // Sync Ref with State
    useEffect(() => { usersRef.current = users; }, [users]);

    const [tasks, setTasks] = useState<Task[]>([]);
    const [logs, setLogs] = useState<OrderLog[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [birthdayWishes, setBirthdayWishes] = useState<BirthdayWish[]>([]);
    const [activeEvents, setActiveEvents] = useState<ActiveEvent[]>([]);

    const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [showTetDecor, setShowTetDecor] = useState(true);
    const [activeInvitation, setActiveInvitation] = useState<{ title: string; body: string } | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    // Using ref to prevent seeding multiple times in strict mode
    // const seedingRef = useRef(false);

    // FCM Logic: Register SW, Get Token, Listen for Foreground
    useEffect(() => {
        let unsubscribeForeground: (() => void) | undefined;

        const initFCM = async () => {
            if (!currentUser) return;

            // 1. Register SW & Get Token
            import('../utils/pushManager').then(async ({ registerServiceWorker, askPermission, subscribeToPush, setupForegroundListener }) => {
                const swReg = await registerServiceWorker();
                if (swReg) {
                    const permission = await askPermission();
                    if (permission === 'granted') {
                        const token = await subscribeToPush(swReg);
                        if (token) {
                            console.log('FCM Token:', token);
                            // Verify if token is new before writing to avoid unnecessary writes
                            // For now, just update (it's cheap enough for login event)
                            // Save to correct App User Document
                            if (users.length > 0) {
                                const appUser = users.find(u => u.email === currentUser.email);
                                if (appUser) {
                                    const userRef = doc(db, 'users', appUser.id);
                                    await updateDoc(userRef, { fcmToken: token }).catch(err => {
                                        console.warn("Error saving FCM token:", err);
                                    });
                                }
                            }
                        }
                    }
                }

                // 2. Setup Foreground Listener
                unsubscribeForeground = setupForegroundListener((payload) => {
                    if (payload.notification) {
                        const { title, body } = payload.notification;
                        // Check if this is a Special Invitation
                        const isInvitation = title?.toUpperCase().includes('MỜI') || title?.toUpperCase().includes('PARTY') || title?.toUpperCase().includes('TIỆC');

                        if (isInvitation) {
                            setActiveInvitation({ title: title || 'Lời mời', body: body || '' });
                        } else {
                            const toastId = `FCM-${Date.now()}`;
                            setToasts(prev => [...prev, {
                                id: toastId,
                                title: title || 'Thông báo mới',
                                message: body || '',
                                type: 'info'
                            }]);
                            setTimeout(() => setToasts(prev => prev.filter(t => t.id !== toastId)), 5000);
                        }
                    }
                });
            });
        };



        if (users.length > 0) {
            initFCM();
        }

        return () => {
            if (unsubscribeForeground) unsubscribeForeground();
        };
    }, [currentUser, users]);

    // AUTOMATED MEETING REMINDERS
    useEffect(() => {
        if (!currentUser || meetings.length === 0) return;

        const checkReminders = () => {
            const now = new Date();
            meetings.forEach(m => {
                if (!m.date || !m.startTime) return;

                // Parse date carefully (YYYY-MM-DD + HH:mm)
                const start = new Date(`${m.date}T${m.startTime}`);
                if (isNaN(start.getTime())) return;

                const diffIds = (start.getTime() - now.getTime()) / 1000; // seconds
                const diffMins = diffIds / 60;

                const updates: Partial<Meeting['remindersSent']> = {};
                let notifType = '';
                let title = '';

                // 1. One Day Before (DISABLED)
                // if (diffHours >= 23 && diffHours <= 25 && !m.remindersSent?.dayBefore) {
                //     updates.dayBefore = true;
                //     notifType = 'DAY';
                //     title = '📅 Nhắc hẹn: Còn 1 ngày';
                // }

                // 2. 30 Minutes Before (25m to 35m window)
                if (diffMins >= 25 && diffMins <= 35 && !m.remindersSent?.min30) {
                    updates.min30 = true;
                    notifType = '30M';
                    title = '⏰ Nhắc hẹn: Còn 30 phút';
                }

                // 3. 15 Minutes Before (10m to 20m window)
                if (diffMins >= 10 && diffMins <= 20 && !m.remindersSent?.min15) {
                    updates.min15 = true;
                    notifType = '15M';
                    title = '🚨 Nhắc hẹn: Còn 15 phút';
                }

                if (notifType) {
                    // Update Meeting to prevent re-sending
                    // Use updateDoc directly to avoid full context re-render loops if we used setMeetings
                    const meetingRef = doc(db, 'meetings', m.id);
                    updateDoc(meetingRef, {
                        [`remindersSent.${Object.keys(updates)[0]}`]: true
                    }).catch(console.error);

                    // Broadcast Notification (Deterministic ID prevents duplicates)
                    const notifId = `REMIND-${m.id}-${notifType}`;
                    const contentSnippet = m.content.length > 50 ? m.content.substring(0, 50) + '...' : m.content;
                    const formatDateDisplay = (d: string) => d.split('-').reverse().join('/');

                    addNotification({
                        id: notifId,
                        title: title,
                        message: `Lịch: ${contentSnippet}.\nThời gian: ${m.startTime} - ${m.day}, ${formatDateDisplay(m.date)}`,
                        time: new Date().toISOString(),
                        read: false,
                        type: notifType === '15M' ? 'alert' : 'info'
                    });
                }
            });
        };

        const timer = setInterval(checkReminders, 30000); // Check every 30s
        checkReminders(); // Run immediately

        return () => clearInterval(timer);
    }, [meetings, currentUser]);


    // Initial Tet Decor Load
    useEffect(() => {
        const stored = localStorage.getItem('avg_tet_decor_v2');
        if (stored) setShowTetDecor(JSON.parse(stored));
    }, []);

    useEffect(() => {
        localStorage.setItem('avg_tet_decor_v2', JSON.stringify(showTetDecor));
    }, [showTetDecor]);

    // LOAD FROM FIRESTORE
    useEffect(() => {
        if (!currentUser) {
            setUsers([]); setTasks([]); setLogs([]); setNotifications([]);
            setBirthdayWishes([]); setActiveEvents([]); setPayrollRecords([]);
            setIsLoaded(true);
            return;
        }

        let unsubs: (() => void)[] = [];

        const setupSubscriptions = async () => {
            // USERS handled in separate Effect for Bi-Directional Sync

            // FIREBASE COLLECTIONS
            unsubs.push(onSnapshot(collection(db, 'tasks'), s => setTasks(s.docs.map(d => d.data() as Task))));

            // Optimized: Limit Logs and Notifications to prevent initial load bloat
            // logs: limit 200 recent
            unsubs.push(onSnapshot(
                query(collection(db, 'logs'), orderBy('created', 'desc'), limit(200)),
                s => setLogs(s.docs.map(d => d.data() as OrderLog))
            ));

            // notifications: limit 50 recent
            unsubs.push(onSnapshot(
                query(collection(db, 'notifications'), orderBy('time', 'desc'), limit(50)),
                s => setNotifications(s.docs.map(d => d.data() as Notification))
            ));

            unsubs.push(onSnapshot(collection(db, 'wishes'), s => setBirthdayWishes(s.docs.map(d => d.data() as BirthdayWish))));
            unsubs.push(onSnapshot(collection(db, 'events'), s => setActiveEvents(s.docs.map(d => d.data() as ActiveEvent))));


            // SUPABASE: Payroll (Realtime)
            const mapPayrollRecord = (d: any): PayrollRecord => ({
                id: d.id,
                month: d.month,
                userId: d.user_id || '',
                employeeCode: d.employee_code || '',
                fullName: d.full_name || '',
                position: d.position || '',
                department: d.department || '',
                basicSalary: d.basic_salary || 0,
                actualWorkDays: d.actual_work_days || 0,
                allowanceMeal: d.allowance_meal || 0,
                allowanceFuel: d.allowance_fuel || 0,
                allowancePhone: d.allowance_phone || 0,
                allowanceAttendance: d.allowance_attendance || 0,
                totalAllowanceActual: d.total_allowance_actual || 0,
                incomeMentalHealth: d.income_mental_health || 0,
                incomeOvertime: d.income_overtime || 0,
                incomeQuality: d.income_quality || 0,
                incomeSpecial: d.income_special || 0,
                incomeOfficer: d.income_officer || 0,
                incomeKPI: d.income_kpi || 0,
                totalAdditional: d.total_additional || 0,
                totalActualIncome: d.total_actual_income || 0,
                insuranceCompany: d.insurance_company || 0,
                insuranceEmployee: d.insurance_employee || 0,
                advancePayment: d.advance_payment || 0,
                totalIncome: d.total_income || 0,
                netPay: d.net_pay || 0
            });

            const payrollChannel = supabase
                .channel('public:payroll')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'payroll' }, (payload: any) => {
                    if (payload.eventType === 'INSERT') {
                        const newRecord = mapPayrollRecord(payload.new);
                        setPayrollRecords(prev => [...prev, newRecord]);
                    } else if (payload.eventType === 'UPDATE') {
                        const updated = mapPayrollRecord(payload.new);
                        setPayrollRecords(prev => prev.map(r => r.id === updated.id ? updated : r));
                    } else if (payload.eventType === 'DELETE') {
                        setPayrollRecords(prev => prev.filter(r => r.id !== payload.old.id));
                    }
                })
                .subscribe();

            const fetchPayroll = async () => {
                const { data, error } = await supabase.from('payroll').select('*');
                if (!error && data) {
                    setPayrollRecords(data.map(mapPayrollRecord));
                }
            };

            fetchPayroll(); // Initial Load
            return () => { supabase.removeChannel(payrollChannel); };

            unsubs.push(onSnapshot(collection(db, 'meetings'), snap => {
                if (snap.empty) {
                    const batch = writeBatch(db);
                    initialMeetings.forEach(m => batch.set(doc(db, 'meetings', m.id), m));
                    batch.commit().catch(e => console.error('Seeding meetings error:', e));
                } else {
                    setMeetings(snap.docs.map(d => d.data() as Meeting));
                }
            }));
        };

        setupSubscriptions();

        return () => unsubs.forEach(u => u());
    }, [currentUser]);

    // PRESENCE HEARTBEAT
    useEffect(() => {
        if (!currentUser) return;

        const sendHeartbeat = () => {
            const appUser = usersRef.current.find(u => u.email === currentUser.email);
            if (!appUser) return;

            supabase.from('users').update({ last_seen: new Date().toISOString() }).eq('id', appUser.id).then(({ error }) => {
                if (error) console.warn('Heartbeat fail', error);
            });
        };

        // Send immediately on mount/login
        sendHeartbeat();

        // Send periodically (keep alive)
        const interval = setInterval(sendHeartbeat, 60000); // Every 1 minute

        return () => clearInterval(interval);
    }, [currentUser, isLoaded]);

    // SELF-HEALING: Restore ALL initial users if missing from DB (Req: Restore 8 personnel)
    // SELF-HEALING: Removed to allow full control by Firestore.
    // effective-date: 2026-01-08

    // --- ACTIONS (FIRESTORE) ---

    // RESTORE DEFAULTS
    const restoreDefaults = async () => {
        const batch = writeBatch(db);
        initialUsers.forEach(u => batch.set(doc(db, 'users', u.id), u, { merge: true }));
        try {
            await batch.commit();
            // alert('Đã đồng bộ dữ liệu (11 nhân sự).'); // Let UI handle feedback if needed
        } catch (e) {
            console.error('Sync failed:', e);
            alert('Đồng bộ thất bại. Kiểm tra Console.');
        }
    };

    // CLEANUP: Remove Nguyen Thi Hao (Run once on client load)
    useEffect(() => {
        const cleanupDes = async () => {
            console.log('Starting cleanup...');

            // 1. Delete legacy 'NV013' / ID '11'
            await deleteDoc(doc(db, 'users', '11')).catch(() => { });
            await supabase.from('payroll').delete().eq('employee_code', 'NV013');

            // 2. Delete 'Nguyễn Thị Hào' (Code 24009)
            // Query Firestore to find ID if dynamic
            const q = query(collection(db, 'users'), where('employeeCode', '==', '24009'));
            const snap = await getDocs(q);

            snap.forEach(async (d) => {
                await deleteDoc(doc(db, 'users', d.id));
                // Also delete from Supabase Users
                await supabase.from('users').delete().eq('id', d.id);
                console.log(`Deleted user ${d.id} (24009) from Firestore/Supabase`);
            });

            // Double check by Name
            const qName = query(collection(db, 'users'), where('name', '==', 'Nguyễn Thị Hào'));
            const snapName = await getDocs(qName);
            snapName.forEach(async (d) => {
                await deleteDoc(doc(db, 'users', d.id));
                await supabase.from('users').delete().eq('id', d.id);
                console.log(`Deleted user ${d.id} (Name Match) from Firestore/Supabase`);
            });

            // Delete from Payroll by Code 24009
            await supabase.from('payroll').delete().eq('employee_code', '24009');
            await supabase.from('payroll').delete().eq('full_name', 'Nguyễn Thị Hào');

            console.log('Cleanup executed.');
        };
        cleanupDes();
    }, []);

    // MIGRATION: Fix Leave for Le Thi Anh Nguyet and Ha Ngoc Doanh (Jan 2026 updates)
    useEffect(() => {
        if (!users || users.length === 0) return;

        const fixUserLeave = async () => {
            // 1. Fix Nguyet (User 4)
            const user4 = users.find(u => u.id === '4');
            if (user4) {
                // Expected leaves for Nguyet:
                // Jan 27: Leave (P)
                // Jan 28: Absence (x/2)

                // Expected IDs
                const targetIds = ['MIG-NGUYET-26', 'MIG-NGUYET-27-ABSENCE'];
                const hasMigrated = targetIds.every(id => user4.leaves?.some(l => l.id === id));

                // Cleanup bad attempts (e.g. 27-leave, 28-absence)
                const badIds = ['FIX-NGUYET-27', 'MIG-NGUYET-27', 'MIG-NGUYET-28'];
                const hasBad = user4.leaves?.some(l => badIds.includes(l.id));

                if (!hasMigrated || hasBad) {
                    console.log('Syncing Nguyet Data (Corrected)...');

                    // Remove bad records AND existing records for 26/27 to prevent duplicates
                    const cleanLeaves = (user4.leaves || []).filter(l =>
                        !badIds.includes(l.id) &&
                        l.start !== '2026-01-26' && l.start !== '2026-01-27' && l.start !== '2026-01-28'
                    );

                    const newLeaves: LeaveRecord[] = [
                        ...cleanLeaves,
                        { id: 'MIG-NGUYET-26', type: 'leave', start: '2026-01-26', end: '2026-01-26', reason: 'Nghỉ phép (Sync)', session: 'full' },
                        { id: 'MIG-NGUYET-27-ABSENCE', type: 'absence', start: '2026-01-27', end: '2026-01-27', reason: 'Nghỉ không lương 1/2 (Sync)', session: 'morning' },
                    ];

                    await setDoc(doc(db, 'users', user4.id), sanitize({ ...user4, leaves: newLeaves }));
                }
            }

            // 2. Fix Doanh (User 6) - Image: 12(ol), 13(x/2), 20(x/2), 22(x/2)
            const user6 = users.find(u => u.id === '6');
            if (user6) {
                // Expected IDs
                const shouldHaveIds = ['MIG-DOANH-12', 'MIG-DOANH-13', 'MIG-DOANH-20', 'MIG-DOANH-22'];
                const hasMigrated = shouldHaveIds.every(id => user6.leaves?.some(l => l.id === id));

                // Cleanup bad attempts (21, 23, and incorrectly added 09)
                const idsToRemove = ['MIG-DOANH-21', 'MIG-DOANH-23', 'MIG-DOANH-09'];
                const hasBadRecords = user6.leaves?.some(l => idsToRemove.includes(l.id));

                if (!hasMigrated || hasBadRecords) {
                    console.log('Syncing Doanh Data (Corrected 2)...');

                    const cleanLeaves = (user6.leaves || []).filter(l => !idsToRemove.includes(l.id));

                    const correctRecords: LeaveRecord[] = [
                        // Jan 09 is X (Regular Work), so no record needed.
                        { id: 'MIG-DOANH-12', type: 'online', start: '2026-01-12', end: '2026-01-12', reason: 'Work Online', session: 'full' },
                        { id: 'MIG-DOANH-13', type: 'absence', start: '2026-01-13', end: '2026-01-13', reason: 'Half-day Unpaid', session: 'morning' },
                        { id: 'MIG-DOANH-20', type: 'absence', start: '2026-01-20', end: '2026-01-20', reason: 'Half-day Unpaid', session: 'morning' },
                        { id: 'MIG-DOANH-22', type: 'absence', start: '2026-01-22', end: '2026-01-22', reason: 'Half-day Unpaid', session: 'morning' },
                    ];

                    // Merge safely
                    const finalLeaves = [...cleanLeaves];
                    correctRecords.forEach(rec => {
                        if (!finalLeaves.some(l => l.id === rec.id)) {
                            finalLeaves.push(rec);
                        }
                    });

                    await setDoc(doc(db, 'users', user6.id), sanitize({ ...user6, leaves: finalLeaves }));
                }
            }

            // 3. Batch Update for Jan 02 (P) - Users: 1(Thanh), 3(Tam), 5(Son), 9(Q.Nga), 10(Hai)
            const usersToUpdate = [
                { id: '1', date: '2026-01-02', type: 'leave' },
                { id: '3', date: '2026-01-02', type: 'leave' },
                { id: '5', date: '2026-01-02', type: 'leave' },
                { id: '9', date: '2026-01-02', type: 'leave' },
                { id: '10', date: '2026-01-02', type: 'leave' },
            ];

            for (const update of usersToUpdate) {
                const user = users.find(u => u.id === update.id);
                if (user) {
                    const leaveId = `TIER2-SYNC-${update.id}-${update.date}`;
                    const hasRecord = user.leaves?.some(l => l.id === leaveId);

                    if (!hasRecord) {
                        const newLeaf: LeaveRecord = {
                            id: leaveId,
                            type: update.type as any,
                            start: update.date,
                            end: update.date,
                            reason: 'Nghỉ phép năm (Sync)',
                            session: 'full'
                        };
                        const updatedLeaves = [...(user.leaves || []), newLeaf];
                        await setDoc(doc(db, 'users', user.id), sanitize({ ...user, leaves: updatedLeaves }));
                    }
                }
            }
        };

        fixUserLeave();
    }, [users]);

    // USERS (Primary Source: Firestore)
    const sanitize = (obj: any) => JSON.parse(JSON.stringify(obj));

    const addUser = (user: User) => setDoc(doc(db, 'users', user.id), sanitize(user));
    const updateUser = (user: User) => setDoc(doc(db, 'users', user.id), sanitize(user));
    const deleteUser = (id: string) => deleteDoc(doc(db, 'users', id));

    // SYNC: Listen for Supabase changes (Source of Truth) -> Update Local State
    useEffect(() => {
        // Removed currentUser check to allow background sync / public access if rules permit

        const unsub = onSnapshot(collection(db, 'users'), (snap) => {
            const currentUsers = snap.docs.map(d => d.data() as User);
            setUsers(currentUsers);
            setIsLoaded(true);

            // Mirror to Supabase (One-way Sync Logic)
            snap.docChanges().forEach(async (change) => {
                const userData = change.doc.data() as User;

                if (change.type === 'added' || change.type === 'modified') {
                    // Check if Supabase already has this data to avoid loop
                    // We can't easily check remote without a fetch, so we rely on optimistically sending
                    // But to prevent loops, we could check a timestamp or rely on DB deduplication.
                    // For now, we perform the Upsert.
                    try {
                        await supabase.from('users').upsert({
                            id: userData.id,
                            name: userData.name,
                            alias: userData.alias,
                            email: userData.email,
                            role: userData.role,
                            dept: userData.dept,
                            phone: userData.phone,
                            avatar: userData.avatar,
                            bank_acc: userData.bankAcc,
                            bank_name: userData.bankName,
                            is_admin: userData.isAdmin,
                            verified: userData.verified,
                            dob: userData.dob,
                            start_date: userData.startDate,
                            employee_code: userData.employeeCode,
                            contract_no: userData.contractNo,
                            leaves: userData.leaves || [],
                            custom_qr_url: userData.customQrUrl,
                            // last_seen: userData.lastSeen // REMOVED: Prevent Sync Loop. Supabase is Source of Truth for Heartbeat.
                        });
                    } catch (err) {
                        console.error('Sync to Supabase failed', err);
                    }
                } else if (change.type === 'removed') {
                    await supabase.from('users').delete().eq('id', userData.id);
                }
            });
        }, (error) => {
            console.warn("Firestore Sync Error (likely permission):", error.message);
        });

        // SYNC 2: Supabase -> Firestore (Bi-directional)
        const channel = supabase
            .channel('public:users')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, async (payload) => {
                console.log('🔥 SUPABASE EVENT:', payload);
                const { eventType, new: newRecord, old: oldRecord } = payload;

                if (eventType === 'INSERT' || eventType === 'UPDATE') {
                    const mappedUser: User = {
                        id: newRecord.id,
                        name: newRecord.name,
                        alias: newRecord.alias,
                        email: newRecord.email,
                        role: newRecord.role,
                        dept: newRecord.dept,
                        phone: newRecord.phone,
                        avatar: newRecord.avatar,
                        bankAcc: newRecord.bank_acc,
                        bankName: newRecord.bank_name,
                        isAdmin: newRecord.is_admin,
                        verified: newRecord.verified,
                        dob: newRecord.dob,
                        startDate: newRecord.start_date,
                        employeeCode: newRecord.employee_code,
                        contractNo: newRecord.contract_no,
                        leaves: newRecord.leaves, // Ensure this JSON matches
                        customQrUrl: newRecord.custom_qr_url,
                        lastSeen: newRecord.last_seen
                    };

                    // LOOP PREVENTION:
                    // Check if the incoming Supabase data is already identical to what we have in Firestore (via usersRef)
                    const existingUser = usersRef.current.find(u => u.id === mappedUser.id);

                    // We only compare fields present in mappedUser, assuming Supabase is the "Diff" source
                    // Actually, let's just sanitise both and compare
                    const shouldUpdate = !existingUser ||
                        JSON.stringify(sanitize(existingUser)) !== JSON.stringify(sanitize(mappedUser));

                    if (shouldUpdate) {
                        console.log('🔄 Sync Supabase -> Firestore:', mappedUser.name);
                        await setDoc(doc(db, 'users', mappedUser.id), sanitize(mappedUser), { merge: true });
                    } else {
                        console.log('start_sync_check: Data identical, skipping write to Firestore to prevent loop.');
                    }

                } else if (eventType === 'DELETE') {
                    if (oldRecord?.id) {
                        await deleteDoc(doc(db, 'users', oldRecord.id));
                    }
                }
            })
            .subscribe();

        return () => {
            unsub();
            supabase.removeChannel(channel);
        };
    }, []);

    // TASKS
    const addTask = (task: Task) => setDoc(doc(db, 'tasks', task.id), task);
    const updateTask = (task: Task) => setDoc(doc(db, 'tasks', task.id), task);
    const deleteTask = (id: string) => deleteDoc(doc(db, 'tasks', id));
    const markTaskAsAccepted = (taskId: string) => updateDoc(doc(db, 'tasks', taskId), { acceptedAt: new Date().toISOString(), status: 'active' });

    // LOGS
    const addLog = (log: OrderLog) => setDoc(doc(db, 'logs', log.id), log);
    const updateLog = (log: OrderLog) => setDoc(doc(db, 'logs', log.id), log);

    // NOTIFICATIONS & TOASTS
    const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

    const addNotification = async (n: any) => {
        const newNotification: Notification = {
            id: n.id || doc(collection(db, 'notifications')).id,
            time: new Date().toISOString(),
            read: false,
            ...n
        };
        // Ensure id matches if passed or generated
        await setDoc(doc(db, 'notifications', newNotification.id), newNotification);

        // Local Toast
        const toastId = `TOAST-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        setToasts(prev => [...prev, {
            id: toastId,
            title: newNotification.title,
            message: newNotification.message,
            type: newNotification.type || 'info'
        }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== toastId)), 5000);
    };

    const markAsRead = async (id: string) => {
        await updateDoc(doc(db, 'notifications', id), { read: true });
    };

    const markAllAsRead = async () => {
        const batch = writeBatch(db);
        notifications.filter(n => !n.read).forEach(n => {
            batch.update(doc(db, 'notifications', n.id), { read: true });
        });
        await batch.commit();
    };

    const clearNotifications = async () => {
        const batch = writeBatch(db);
        notifications.forEach(n => batch.delete(doc(db, 'notifications', n.id)));
        await batch.commit();
    };

    // WISHES
    const addBirthdayWish = (wish: BirthdayWish) => setDoc(doc(db, 'wishes', wish.id), wish);
    const markWishAsRead = (id: string) => updateDoc(doc(db, 'wishes', id), { isRead: true });

    // EVENTS
    const addActiveEvent = (event: ActiveEvent) => setDoc(doc(db, 'events', event.id), event);

    // PAYROLL
    // PAYROLL (Supabase)
    const addPayrollRecord = async (record: PayrollRecord) => {
        // Convert camelCase to snake_case
        const payload = {
            id: record.id,
            month: record.month,
            user_id: record.userId,
            employee_code: record.employeeCode,
            full_name: record.fullName,
            position: record.position,
            department: record.department,
            basic_salary: record.basicSalary,
            actual_work_days: record.actualWorkDays,
            allowance_meal: record.allowanceMeal,
            allowance_fuel: record.allowanceFuel,
            allowance_phone: record.allowancePhone,
            allowance_attendance: record.allowanceAttendance,
            total_allowance_actual: record.totalAllowanceActual,
            income_mental_health: record.incomeMentalHealth,
            income_overtime: record.incomeOvertime,
            income_quality: record.incomeQuality,
            income_special: record.incomeSpecial,
            income_officer: record.incomeOfficer,
            income_kpi: record.incomeKPI,
            total_additional: record.totalAdditional,
            total_actual_income: record.totalActualIncome,
            insurance_company: record.insuranceCompany,
            insurance_employee: record.insuranceEmployee,
            advance_payment: record.advancePayment,
            total_income: record.totalIncome,
            net_pay: record.netPay
        };
        const { error } = await supabase.from('payroll').upsert(payload);
        if (error) console.error('Error adding payroll:', error);
    };

    const updatePayrollRecord = async (record: PayrollRecord) => {
        // Same as add (upsert)
        await addPayrollRecord(record);
    };

    const deletePayrollRecord = async (id: string) => {
        const { error } = await supabase.from('payroll').delete().eq('id', id);
        if (error) console.error('Error deleting payroll:', error);
    };

    // MEETINGS
    const addMeeting = (meeting: Meeting) => setDoc(doc(db, 'meetings', meeting.id), meeting);
    const updateMeeting = (meeting: Meeting) => setDoc(doc(db, 'meetings', meeting.id), meeting);
    const deleteMeeting = (id: string) => deleteDoc(doc(db, 'meetings', id));

    const toggleTetDecor = () => setShowTetDecor(prev => !prev);

    // Auto-backup to Supabase every 60 minutes
    useEffect(() => {
        const runBackup = async () => {
            console.log('⏳ Triggering scheduled backup...');
            await backupDataToSupabase();
        };

        // Schedule every 60 minutes (3600000 ms)
        const intervalId = setInterval(runBackup, 3600000);

        // Optional: Run one minute after mount to ensure data is likely loaded
        const initialTimer = setTimeout(runBackup, 60000);

        return () => {
            clearInterval(intervalId);
            clearTimeout(initialTimer);
        };
    }, []);

    const value = {
        users, tasks, logs, notifications, toasts, birthdayWishes, activeEvents, payrollRecords,
        addUser, updateUser, deleteUser,
        addTask, updateTask, deleteTask, markTaskAsAccepted,
        addLog, updateLog,
        markAsRead, markAllAsRead, clearNotifications,
        addNotification, removeToast,
        addBirthdayWish, markWishAsRead,
        addActiveEvent,
        addPayrollRecord, updatePayrollRecord, deletePayrollRecord,
        meetings, addMeeting, updateMeeting, deleteMeeting,
        showTetDecor, toggleTetDecor,
        isLoaded, restoreDefaults,
        invitation: activeInvitation,
        setInvitation: setActiveInvitation,
        setToasts
    };

    return (
        <DataContext.Provider value={value}>
            {children}
        </DataContext.Provider>
    );
};

export const useData = () => {
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
};
