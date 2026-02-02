/**
 * ============================================
 * 📁 AVGFlow - Type Definitions
 * ============================================
 * Centralized TypeScript interfaces for the entire application.
 * Import from '@/types' or '../types'
 */

// ==========================================
// 👤 USER TYPES
// ==========================================

export interface LeaveRecord {
    id: string;
    type: 'leave' | 'absence' | 'online';
    session?: 'full' | 'morning' | 'afternoon';
    start: string; // ISO
    end: string; // ISO
    reason: string;
    approvedBy?: string;
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
    timekeep?: { view: boolean; edit: boolean };
    ai_chat?: { view: boolean; edit: boolean };
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
    customQrUrl?: string;
    permissions?: UserPermissions;
    fcmToken?: string;
}

// ==========================================
// ✅ TASK TYPES
// ==========================================

export interface Task {
    id: string;
    title: string;
    assigneeId: string;
    priority: 'urgent' | 'high' | 'normal';
    deadline: string;
    status: 'active' | 'completed' | 'pending' | 'archived';
    department: string;
    orderId?: string;
    taskCode?: string;
    description?: string;
    attachments: { type: 'link' | 'file'; url: string; name: string }[];
    acceptedAt?: string;
    warningSent?: boolean;
    createdAt: string;
}

// ==========================================
// 📋 ORDER/LOG TYPES
// ==========================================

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
    progress?: number;
    timeline?: TimelineEvent[];
    dueDate?: string;
    deliveryAttempts?: number;
}

// ==========================================
// 🔔 NOTIFICATION TYPES
// ==========================================

export interface Notification {
    id: string;
    title: string;
    message: string;
    time: string;
    read: boolean;
    type: 'alert' | 'success' | 'info' | 'error';
}

export interface Toast {
    id: string;
    title: string;
    message: string;
    type: 'success' | 'info' | 'alert' | 'error';
}

// ==========================================
// 🎂 EVENT TYPES
// ==========================================

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

// ==========================================
// 💰 PAYROLL TYPES
// ==========================================

export interface PayrollRecord {
    id: string;
    month: string; // YYYY-MM
    userId: string;
    employeeCode: string;
    fullName: string;
    position: string;
    department: string;

    // Main Columns
    basicSalary: number;
    actualWorkDays: number;

    // Allowances
    allowanceMeal: number;
    allowanceFuel: number;
    allowancePhone: number;
    allowanceAttendance: number;
    totalAllowanceActual: number;

    // Additional Income
    incomeMentalHealth: number;
    incomeOvertime: number;
    incomeQuality: number;
    incomeSpecial: number;
    incomeOfficer: number;
    incomeKPI: number;
    totalAdditional: number;

    totalActualIncome: number;

    // Deductions
    insuranceCompany: number;
    insuranceEmployee: number;
    advancePayment: number;

    totalIncome: number;
    netPay: number;
}

// ==========================================
// 📅 MEETING TYPES
// ==========================================

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

// ==========================================
// 💬 CHAT TYPES
// ==========================================

export interface ChatMessage {
    id: string;
    senderId: string;
    senderName: string;
    senderAvatar?: string;
    content: string;
    timestamp: string;
    type?: 'text' | 'image' | 'file';
    fileUrl?: string;
    fileName?: string;
}

export interface ChatRoom {
    id: string;
    type: 'direct' | 'group';
    name?: string;
    participants: string[];
    lastMessage?: string;
    lastMessageTime?: string;
    createdAt: string;
}

// ==========================================
// 📰 NEWS TYPES
// ==========================================

export interface InternalNews {
    id: string;
    title: string;
    content: string;
    authorId: string;
    authorName: string;
    createdAt: string;
    isPinned?: boolean;
    category?: string;
}

// ==========================================
// 🤖 AI TYPES
// ==========================================

export interface AIConversation {
    id: string;
    userId: string;
    title?: string;
    createdAt: string;
    lastMessageAt: string;
}

export interface AIAppHistory {
    id: string;
    userId: string;
    appType: string;
    input: string;
    output: string;
    createdAt: string;
}

// ==========================================
// 📧 EMAIL TYPES
// ==========================================

export interface EmailQueueItem {
    id: string;
    to: string | string[];
    subject: string;
    html: string;
    status?: 'pending' | 'sent' | 'error';
    createdAt: string;
    sentAt?: string;
    error?: string;
}

// ==========================================
// 📄 DOCUMENT TYPES
// ==========================================

export interface ConclusionDoc {
    id: string;
    title: string;
    fileUrl: string;
    uploadedBy: string;
    uploadedAt: string;
    category?: string;
}

export interface ConclusionVote {
    id: string;
    docId: string;
    userId: string;
    vote: 'agree' | 'disagree' | 'abstain';
    comment?: string;
    votedAt: string;
}
