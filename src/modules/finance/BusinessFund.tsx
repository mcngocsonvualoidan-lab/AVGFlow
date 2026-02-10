import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../utils/supabaseClient';
import {
    ResponsiveContainer, Tooltip,
    ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { ArrowUpCircle, ArrowDownCircle, Wallet, Calendar, Copy, Download, ExternalLink, Maximize2, X, Check, Sparkles, Calculator } from 'lucide-react';
import { clsx } from 'clsx';
import HeroBanner from '../../components/HeroBanner';

// Types
interface FundTransaction {
    id: string;
    fund_type: 'INVESTMENT' | 'WELFARE';
    month: string;
    date: string;
    content: string;
    amount_in: number;
    amount_out: number;
    balance: number;
    note?: string;
}

const BusinessFund = () => {
    const [activeTab, setActiveTab] = useState<'INVESTMENT' | 'WELFARE'>('INVESTMENT');
    const [selectedMonth, setSelectedMonth] = useState('2025-12');
    const [transactions, setTransactions] = useState<FundTransaction[]>([]);
    const [historyData, setHistoryData] = useState<any[]>([]); // Data for Chart
    const [loading, setLoading] = useState(true);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    };

    // Load Month Data (Detail)
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);

            // DATA INJECTION FOR JAN 2026 (User Request)
            if (selectedMonth === '2026-01') {
                if (activeTab === 'WELFARE') {
                    const DATA_WELFARE_JAN_2026: FundTransaction[] = [
                        { id: 'wel_jan_26_00', fund_type: 'WELFARE', month: '2026-01', date: '2026-01-01', content: 'Tồn đầu kỳ', amount_in: 0, amount_out: 0, balance: 20764964, note: 'Chuyển từ T12/2025' },
                        { id: 'wel_jan_26_01', fund_type: 'WELFARE', month: '2026-01', date: '2026-01-14', content: 'Thành nộp quỹ PL', amount_in: 68000, amount_out: 0, balance: 20832964 },
                        { id: 'wel_jan_26_02', fund_type: 'WELFARE', month: '2026-01', date: '2026-01-15', content: 'Tâm nộp quỹ PL', amount_in: 85000, amount_out: 0, balance: 20917964 },
                        { id: 'wel_jan_26_03', fund_type: 'WELFARE', month: '2026-01', date: '2026-01-16', content: 'Lưu nộp quỹ PL', amount_in: 62000, amount_out: 0, balance: 20979964 },
                        { id: 'wel_jan_26_04', fund_type: 'WELFARE', month: '2026-01', date: '2026-01-16', content: 'Sơn nộp quỹ PL', amount_in: 25000, amount_out: 0, balance: 21004964 },
                        { id: 'wel_jan_26_05', fund_type: 'WELFARE', month: '2026-01', date: '2026-01-16', content: 'Nguyệt nộp quỹ PL', amount_in: 147000, amount_out: 0, balance: 21151964 },
                        { id: 'wel_jan_26_06', fund_type: 'WELFARE', month: '2026-01', date: '2026-01-16', content: 'Sơn nộp quỹ PL (Lần 2)', amount_in: 25000, amount_out: 0, balance: 21176964 },
                        { id: 'wel_jan_26_07', fund_type: 'WELFARE', month: '2026-01', date: '2026-01-16', content: 'Hân nộp quỹ PL', amount_in: 177000, amount_out: 0, balance: 21353964 },
                        { id: 'wel_jan_26_08', fund_type: 'WELFARE', month: '2026-01', date: '2026-01-16', content: 'Doanh nộp quỹ PL', amount_in: 74000, amount_out: 0, balance: 21427964 },
                        { id: 'wel_jan_26_09', fund_type: 'WELFARE', month: '2026-01', date: '2026-01-16', content: 'Tâm nộp quỹ PL (Lần 2)', amount_in: 25000, amount_out: 0, balance: 21452964 },
                        { id: 'wel_jan_26_10', fund_type: 'WELFARE', month: '2026-01', date: '2026-01-16', content: 'Nga nộp quỹ PL', amount_in: 211000, amount_out: 0, balance: 21663964 },
                        { id: 'wel_jan_26_11', fund_type: 'WELFARE', month: '2026-01', date: '2026-01-18', content: 'Lãi Tiền gửi', amount_in: 162, amount_out: 0, balance: 21664126 },
                        { id: 'wel_jan_26_12', fund_type: 'WELFARE', month: '2026-01', date: '2026-01-19', content: 'Lưu nộp quỹ PL (Lần 2)', amount_in: 25000, amount_out: 0, balance: 21689126 }
                    ];
                    setTransactions(DATA_WELFARE_JAN_2026);
                    setLoading(false);
                    return;
                }

                if (activeTab === 'INVESTMENT') {
                    const DATA_INVESTMENT_JAN_2026: FundTransaction[] = [
                        { id: 'inv_jan_26_00', fund_type: 'INVESTMENT', month: '2026-01', date: '2026-01-01', content: 'Số dư đầu kỳ', amount_in: 0, amount_out: 0, balance: 202744, note: 'Chuyển từ T12/2025' },
                        { id: 'inv_jan_26_01', fund_type: 'INVESTMENT', month: '2026-01', date: '2026-01-15', content: 'Thu nhập Hào', amount_in: 10000000, amount_out: 0, balance: 10202744 },
                        { id: 'inv_jan_26_02', fund_type: 'INVESTMENT', month: '2026-01', date: '2026-01-16', content: 'Thưởng tinh thần T12 - Nguyệt', amount_in: 0, amount_out: 500000, balance: 9702744 },
                        { id: 'inv_jan_26_03', fund_type: 'INVESTMENT', month: '2026-01', date: '2026-01-16', content: 'Thưởng tinh thần T12 - Doanh', amount_in: 0, amount_out: 500000, balance: 9202744 },
                        { id: 'inv_jan_26_04', fund_type: 'INVESTMENT', month: '2026-01', date: '2026-01-16', content: 'Thưởng tinh thần T12 - Sơn', amount_in: 0, amount_out: 500000, balance: 8702744 },
                        { id: 'inv_jan_26_05', fund_type: 'INVESTMENT', month: '2026-01', date: '2026-01-16', content: 'Thưởng tinh thần T12 - Thành', amount_in: 0, amount_out: 500000, balance: 8202744 },
                        { id: 'inv_jan_26_06', fund_type: 'INVESTMENT', month: '2026-01', date: '2026-01-16', content: 'Thưởng tinh thần T12 - Tâm', amount_in: 0, amount_out: 500000, balance: 7702744 },
                        { id: 'inv_jan_26_07', fund_type: 'INVESTMENT', month: '2026-01', date: '2026-01-16', content: 'Thưởng tinh thần T12 - Nga', amount_in: 0, amount_out: 500000, balance: 7202744 },
                        { id: 'inv_jan_26_08', fund_type: 'INVESTMENT', month: '2026-01', date: '2026-01-16', content: 'Thưởng tinh thần T12 - Lưu', amount_in: 0, amount_out: 500000, balance: 6702744 },
                        { id: 'inv_jan_26_09', fund_type: 'INVESTMENT', month: '2026-01', date: '2026-01-16', content: 'Thưởng tinh thần T12 - Hân', amount_in: 0, amount_out: 500000, balance: 6202744 },
                        { id: 'inv_jan_26_10', fund_type: 'INVESTMENT', month: '2026-01', date: '2026-01-16', content: 'Hỗ trợ nghiệp vụ Hào - Thành', amount_in: 0, amount_out: 500000, balance: 5702744 },
                        { id: 'inv_jan_26_11', fund_type: 'INVESTMENT', month: '2026-01', date: '2026-01-16', content: 'Hỗ trợ nghiệp vụ Hào - Nguyệt', amount_in: 0, amount_out: 500000, balance: 5202744 }
                    ];
                    setTransactions(DATA_INVESTMENT_JAN_2026);
                    setLoading(false);
                    return;
                }
            }

            try {
                // 1. Fetch current month's transactions
                const { data: currentData, error: currentError } = await supabase
                    .from('fund_transactions')
                    .select('*')
                    .eq('fund_type', activeTab)
                    .eq('month', selectedMonth)
                    .order('date', { ascending: true })
                    .order('created_at', { ascending: true });

                if (currentError) throw currentError;

                // 2. If data exists, just use it
                if (currentData && currentData.length > 0) {
                    setTransactions(currentData);
                } else {
                    // 3. Automation: If selected month has NO data, try to fetch Closing Balance of Previous Month
                    // to generate an 'Opening Balance' entry automatically.
                    const [year, month] = selectedMonth.split('-').map(Number);
                    let prevMonthStr = '';
                    if (month === 1) {
                        prevMonthStr = `${year - 1}-12`;
                    } else {
                        prevMonthStr = `${year}-${String(month - 1).padStart(2, '0')}`;
                    }

                    const { data: prevData } = await supabase
                        .from('fund_transactions')
                        .select('balance')
                        .eq('fund_type', activeTab)
                        .eq('month', prevMonthStr)
                        .order('date', { ascending: false })
                        .order('created_at', { ascending: false })
                        .limit(1);

                    if (prevData && prevData.length > 0) {
                        const closingBalance = prevData[0].balance;
                        setTransactions([{
                            id: `opening-${selectedMonth}`,
                            fund_type: activeTab,
                            month: selectedMonth,
                            date: `${selectedMonth}-01`,
                            content: 'Số dư đầu kỳ (Tự động chuyển từ tháng trước)',
                            amount_in: 0,
                            amount_out: 0,
                            balance: closingBalance,
                            note: 'Hệ thống tự động đồng bộ'
                        }]);
                    } else {
                        setTransactions([]);
                    }
                }
            } catch (err) {
                console.error('Error fetching fund data:', err);
                setTransactions([]);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [activeTab, selectedMonth]);

    // Load History Data (Chart)
    useEffect(() => {
        const fetchHistory = async () => {
            try {
                // Fetch all data for the active fund to build history
                const { data, error } = await supabase
                    .from('fund_transactions')
                    .select('*')
                    .eq('fund_type', activeTab)
                    .order('date', { ascending: true });

                if (error) throw error;

                if (data) {
                    let finalData = [...data];

                    // INJECT HISTORY DATA FOR JAN 2026 IF MISSING FROM DB
                    if (!data.some((t: any) => t.month === '2026-01')) {
                        if (activeTab === 'WELFARE') {
                            const DATA_WELFARE_JAN_2026: any[] = [
                                { id: 'wel_jan_26_00', fund_type: 'WELFARE', month: '2026-01', date: '2026-01-01', content: 'Tồn đầu kỳ', amount_in: 0, amount_out: 0, balance: 20764964 }, // Opening
                                { id: 'wel_jan_26_01', fund_type: 'WELFARE', month: '2026-01', date: '2026-01-14', content: 'Thành nộp quỹ PL', amount_in: 68000, amount_out: 0, balance: 20832964 },
                                { id: 'wel_jan_26_02', fund_type: 'WELFARE', month: '2026-01', date: '2026-01-15', content: 'Tâm nộp quỹ PL', amount_in: 85000, amount_out: 0, balance: 20917964 },
                                { id: 'wel_jan_26_03', fund_type: 'WELFARE', month: '2026-01', date: '2026-01-16', content: 'Lưu nộp quỹ PL', amount_in: 62000, amount_out: 0, balance: 20979964 },
                                { id: 'wel_jan_26_04', fund_type: 'WELFARE', month: '2026-01', date: '2026-01-16', content: 'Sơn nộp quỹ PL', amount_in: 25000, amount_out: 0, balance: 21004964 },
                                { id: 'wel_jan_26_05', fund_type: 'WELFARE', month: '2026-01', date: '2026-01-16', content: 'Nguyệt nộp quỹ PL', amount_in: 147000, amount_out: 0, balance: 21151964 },
                                { id: 'wel_jan_26_06', fund_type: 'WELFARE', month: '2026-01', date: '2026-01-16', content: 'Sơn nộp quỹ PL (Lần 2)', amount_in: 25000, amount_out: 0, balance: 21176964 },
                                { id: 'wel_jan_26_07', fund_type: 'WELFARE', month: '2026-01', date: '2026-01-16', content: 'Hân nộp quỹ PL', amount_in: 177000, amount_out: 0, balance: 21353964 },
                                { id: 'wel_jan_26_08', fund_type: 'WELFARE', month: '2026-01', date: '2026-01-16', content: 'Doanh nộp quỹ PL', amount_in: 74000, amount_out: 0, balance: 21427964 },
                                { id: 'wel_jan_26_09', fund_type: 'WELFARE', month: '2026-01', date: '2026-01-16', content: 'Tâm nộp quỹ PL (Lần 2)', amount_in: 25000, amount_out: 0, balance: 21452964 },
                                { id: 'wel_jan_26_10', fund_type: 'WELFARE', month: '2026-01', date: '2026-01-16', content: 'Nga nộp quỹ PL', amount_in: 211000, amount_out: 0, balance: 21663964 },
                                { id: 'wel_jan_26_11', fund_type: 'WELFARE', month: '2026-01', date: '2026-01-18', content: 'Lãi Tiền gửi', amount_in: 162, amount_out: 0, balance: 21664126 },
                                { id: 'wel_jan_26_12', fund_type: 'WELFARE', month: '2026-01', date: '2026-01-19', content: 'Lưu nộp quỹ PL (Lần 2)', amount_in: 25000, amount_out: 0, balance: 21689126 }
                            ];
                            finalData = [...finalData, ...DATA_WELFARE_JAN_2026];
                        } else if (activeTab === 'INVESTMENT') {
                            const DATA_INVESTMENT_JAN_2026: any[] = [
                                { id: 'inv_jan_26_00', fund_type: 'INVESTMENT', month: '2026-01', date: '2026-01-01', content: 'Số dư đầu kỳ', amount_in: 0, amount_out: 0, balance: 202744 },
                                { id: 'inv_jan_26_01', fund_type: 'INVESTMENT', month: '2026-01', date: '2026-01-15', content: 'Thu nhập Hào', amount_in: 10000000, amount_out: 0, balance: 10202744 },
                                { id: 'inv_jan_26_02', fund_type: 'INVESTMENT', month: '2026-01', date: '2026-01-16', content: 'Thưởng tinh thần T12 - Nguyệt', amount_in: 0, amount_out: 500000, balance: 9702744 },
                                { id: 'inv_jan_26_03', fund_type: 'INVESTMENT', month: '2026-01', date: '2026-01-16', content: 'Thưởng tinh thần T12 - Doanh', amount_in: 0, amount_out: 500000, balance: 9202744 },
                                { id: 'inv_jan_26_04', fund_type: 'INVESTMENT', month: '2026-01', date: '2026-01-16', content: 'Thưởng tinh thần T12 - Sơn', amount_in: 0, amount_out: 500000, balance: 8702744 },
                                { id: 'inv_jan_26_05', fund_type: 'INVESTMENT', month: '2026-01', date: '2026-01-16', content: 'Thưởng tinh thần T12 - Thành', amount_in: 0, amount_out: 500000, balance: 8202744 },
                                { id: 'inv_jan_26_06', fund_type: 'INVESTMENT', month: '2026-01', date: '2026-01-16', content: 'Thưởng tinh thần T12 - Tâm', amount_in: 0, amount_out: 500000, balance: 7702744 },
                                { id: 'inv_jan_26_07', fund_type: 'INVESTMENT', month: '2026-01', date: '2026-01-16', content: 'Thưởng tinh thần T12 - Nga', amount_in: 0, amount_out: 500000, balance: 7202744 },
                                { id: 'inv_jan_26_08', fund_type: 'INVESTMENT', month: '2026-01', date: '2026-01-16', content: 'Thưởng tinh thần T12 - Lưu', amount_in: 0, amount_out: 500000, balance: 6702744 },
                                { id: 'inv_jan_26_09', fund_type: 'INVESTMENT', month: '2026-01', date: '2026-01-16', content: 'Thưởng tinh thần T12 - Hân', amount_in: 0, amount_out: 500000, balance: 6202744 },
                                { id: 'inv_jan_26_10', fund_type: 'INVESTMENT', month: '2026-01', date: '2026-01-16', content: 'Hỗ trợ nghiệp vụ Hào - Thành', amount_in: 0, amount_out: 500000, balance: 5702744 },
                                { id: 'inv_jan_26_11', fund_type: 'INVESTMENT', month: '2026-01', date: '2026-01-16', content: 'Hỗ trợ nghiệp vụ Hào - Nguyệt', amount_in: 0, amount_out: 500000, balance: 5202744 }
                            ];
                            finalData = [...finalData, ...DATA_INVESTMENT_JAN_2026];
                        }
                    }

                    // Aggregate by Month
                    const monthlyMap = new Map<string, { month: string, in: number, out: number, balance: number }>();

                    finalData.forEach(t => {
                        const m = t.month;
                        if (!monthlyMap.has(m)) {
                            monthlyMap.set(m, { month: m, in: 0, out: 0, balance: 0 });
                        }
                        const entry = monthlyMap.get(m)!;
                        entry.in += Number(t.amount_in) || 0;
                        entry.out += Number(t.amount_out) || 0;
                        entry.balance = t.balance; // Last transaction's balance wins
                    });

                    // Convert to Array and Sort
                    const chartData = Array.from(monthlyMap.values()).sort((a, b) => a.month.localeCompare(b.month));
                    setHistoryData(chartData);
                }
            } catch (err) {
                console.error('Error fetching history:', err);
            }
        };

        fetchHistory();
    }, [activeTab]);

    // Calculate Summary
    const summary = useMemo(() => {
        const totalIn = transactions.reduce((sum, t) => sum + (Number(t.amount_in) || 0), 0);
        const totalOut = transactions.reduce((sum, t) => sum + (Number(t.amount_out) || 0), 0);
        const finalBalance = transactions.length > 0 ? transactions[transactions.length - 1].balance : 0;

        return { totalIn, totalOut, finalBalance };
    }, [transactions]);

    // Analysis Logic
    const analysis = useMemo(() => {
        if (summary.totalIn === 0) return { ratio: 0, message: "Chưa có nguồn thu để đánh giá.", color: "text-slate-400" };
        const ratio = (summary.totalOut / summary.totalIn) * 100;

        if (ratio > 80) return {
            ratio,
            message: "CẢNH BÁO: Tỷ lệ chi quá cao (>80%). Cần cắt giảm chi phí ngay lập tức!",
            color: "text-red-500",
            bg: "bg-red-500/10 border-red-500/30"
        };
        if (ratio > 50) return {
            ratio,
            message: "LƯU Ý: Tỷ lệ chi ở mức trung bình cao (>50%). Cần rà soát lại các khoản chi.",
            color: "text-yellow-400",
            bg: "bg-yellow-500/10 border-yellow-500/30"
        };
        return {
            ratio,
            message: "TỐT: Tỷ lệ chi an toàn (<50%). Dòng tiền đang được quản lý tốt.",
            color: "text-emerald-400",
            bg: "bg-emerald-500/10 border-emerald-500/30"
        };
    }, [summary]);

    // Bank Info
    const bankInfo = activeTab === 'INVESTMENT' ? {
        bankName: 'Techcombank',
        accountName: 'QUY DU TRU DAU TU THU CAP',
        accountNumber: '1902 3155 5500 16',
        qrUrl: 'https://img.vietqr.io/image/TCB-19023155550016-compact2.jpg?amount=0&addInfo=Quy%20Dau%20Tu'
    } : {
        bankName: 'MB Bank',
        accountName: 'Quy Phuc Loi HJ',
        accountNumber: '0936 2633 20',
        qrUrl: 'https://img.vietqr.io/image/MB-0936263320-compact2.jpg?amount=0&addInfo=Quy%20Phuc%20Loi'
    };

    return (
        <div className="p-4 md:p-6 h-full overflow-y-auto custom-scrollbar flex flex-col gap-8 bg-white/50 dark:bg-slate-800/50 backdrop-blur-3xl rounded-[3rem] shadow-2xl border border-white/20 ring-1 ring-white/20">
            {/* HERO BANNER - BUSINESS FUND */}
            {/* 1. Hero Banner */}
            <HeroBanner
                icon={Wallet}
                title="Quỹ Doanh Nghiệp"
                subtitle="Finance & Assets"
                description="Quản lý dòng tiền đầu tư, quỹ phúc lợi, tài sản công ty và theo dõi biến động tài chính."
                badge="Financial Management"
                badgeIcon={Sparkles}
                secondBadge={`Tháng ${selectedMonth.split('-')[1]}/${selectedMonth.split('-')[0]}`}
                stats={[
                    { icon: ArrowUpCircle, label: 'Tổng thu', value: new Intl.NumberFormat('en-US', { notation: "compact" }).format(summary.totalIn), color: 'from-blue-400 to-indigo-500' },
                    { icon: ArrowDownCircle, label: 'Tổng chi', value: new Intl.NumberFormat('en-US', { notation: "compact" }).format(summary.totalOut), color: 'from-red-400 to-orange-500' },
                    { icon: Calculator, label: 'Tồn quỹ', value: new Intl.NumberFormat('en-US', { notation: "compact" }).format(summary.finalBalance), color: 'from-emerald-400 to-teal-500' },
                ]}
                gradientFrom="from-indigo-600"
                gradientVia="via-violet-600"
                gradientTo="to-purple-600"
                accentColor="indigo"
            />

            {/* 2. Action Toolbar */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm mb-6">
                {/* Tabs Switcher */}
                <div className="flex bg-slate-100 dark:bg-black/20 p-1.5 rounded-xl border border-slate-200 dark:border-white/10 w-full md:w-auto">
                    <button
                        onClick={() => setActiveTab('INVESTMENT')}
                        className={clsx(
                            "px-4 py-2 rounded-lg text-sm font-bold transition-all flex-1 md:flex-none text-center",
                            activeTab === 'INVESTMENT' ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm" : "text-slate-500 dark:text-indigo-200 hover:text-indigo-600 dark:hover:text-white"
                        )}
                    >
                        Quỹ Đầu tư
                    </button>
                    <button
                        onClick={() => setActiveTab('WELFARE')}
                        className={clsx(
                            "px-4 py-2 rounded-lg text-sm font-bold transition-all flex-1 md:flex-none text-center",
                            activeTab === 'WELFARE' ? "bg-white dark:bg-slate-700 text-pink-600 dark:text-white shadow-sm" : "text-slate-500 dark:text-indigo-200 hover:text-pink-600 dark:hover:text-white"
                        )}
                    >
                        Quỹ Phúc lợi
                    </button>
                </div>

                {/* Month Selector */}
                <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                    {['2025-11', '2025-12', '2026-01'].map(month => (
                        <button
                            key={month}
                            onClick={() => setSelectedMonth(month)}
                            className={clsx(
                                "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap border shrink-0",
                                selectedMonth === month
                                    ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-500/20"
                                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400"
                            )}
                        >
                            <Calendar size={14} />
                            T{month.split('-')[1]}/{month.split('-')[0]}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Stats & QR */}
                {/* Left Column: Stats & QR */}
                <div className="space-y-6">
                    {/* Summary Cards - Correct Order: IN -> OUT -> BALANCE */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-5 rounded-2xl border border-blue-200/60 dark:border-blue-500/20 shadow-sm hover:shadow-md transition-all order-1 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/5 rounded-bl-full -mr-5 -mt-5 transition-transform group-hover:scale-110"></div>
                            <div className="text-blue-600 dark:text-blue-300 text-xs font-bold uppercase tracking-wider mb-2">Tổng thu</div>
                            <div className="text-blue-700 dark:text-blue-400 font-black text-2xl flex items-center gap-2">
                                <ArrowUpCircle size={24} className="text-blue-500" />
                                {formatCurrency(summary.totalIn)}
                            </div>
                        </div>
                        <div className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 p-5 rounded-2xl border border-red-200/60 dark:border-red-500/20 shadow-sm hover:shadow-md transition-all order-2 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-20 h-20 bg-red-500/5 rounded-bl-full -mr-5 -mt-5 transition-transform group-hover:scale-110"></div>
                            <div className="text-red-600 dark:text-red-300 text-xs font-bold uppercase tracking-wider mb-2">Tổng chi</div>
                            <div className="text-red-700 dark:text-red-400 font-black text-2xl flex items-center gap-2">
                                <ArrowDownCircle size={24} className="text-red-500" />
                                {formatCurrency(summary.totalOut)}
                            </div>
                        </div>
                        <div className="col-span-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white p-6 rounded-3xl shadow-xl shadow-emerald-500/20 transform transition-all hover:scale-[1.01] order-3 relative overflow-hidden">
                            <div className="absolute -right-10 -top-10 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                            <div className="relative z-10 flex flex-col items-center">
                                <div className="text-emerald-100 text-sm font-bold uppercase tracking-widest mb-2 border border-white/20 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm">Tồn quỹ hiện tại</div>
                                <div className="font-black text-5xl font-mono tracking-tight text-white drop-shadow-sm">
                                    {formatCurrency(summary.finalBalance)}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Financial Analysis Section */}
                    <div className={clsx("p-4 rounded-xl border transition-all duration-300 backdrop-blur-md shadow-lg", analysis.bg || "bg-white dark:bg-slate-800/50 border-slate-200 dark:border-white/10")}>
                        <h3 className="text-slate-900 dark:text-white font-semibold text-sm mb-3 flex items-center gap-2">
                            <span>📊</span> Phân tích & Hành động
                        </h3>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-600 dark:text-slate-400">Tỷ lệ Chi / Thu:</span>
                                <span className={clsx("font-bold", analysis.color)}>{analysis.ratio.toFixed(1)}%</span>
                            </div>
                            {/* Progress Bar */}
                            <div className="w-full bg-slate-200 dark:bg-slate-700/50 rounded-full h-2 overflow-hidden">
                                <div
                                    className={clsx("h-full rounded-full transition-all duration-1000",
                                        analysis.ratio > 80 ? 'bg-red-500' : analysis.ratio > 50 ? 'bg-yellow-500' : 'bg-emerald-500'
                                    )}
                                    style={{ width: `${Math.min(analysis.ratio, 100)}% ` }}
                                ></div>
                            </div>
                            <p className={clsx("text-xs font-semibold mt-2", analysis.color)}>
                                {analysis.message}
                            </p>
                        </div>
                    </div>

                    {/* Chart - GLASSMORPHISM STYLE */}
                    <div className="lg:col-span-1 relative group">
                        {/* Glow Effect */}
                        <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-amber-500 rounded-2xl opacity-20 group-hover:opacity-40 blur-xl transition duration-500"></div>

                        <div className="relative bg-white dark:bg-[#0f172a]/60 backdrop-blur-2xl border border-slate-200 dark:border-white/10 p-5 rounded-2xl shadow-xl dark:shadow-2xl h-[400px] flex flex-col overflow-hidden">
                            <div className="flex justify-between items-start mb-6 z-10">
                                <div>
                                    <h3 className="text-slate-900 dark:text-white font-bold text-base flex items-center gap-2">
                                        <div className="p-1.5 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-lg">
                                            <Wallet size={16} className="text-indigo-600 dark:text-indigo-400" />
                                        </div>
                                        Biểu đồ Biến động Quỹ
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 ml-9">Theo dõi xu hướng dòng tiền</p>
                                </div>
                                <div className="flex gap-2">
                                    <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 dark:bg-blue-500/10 rounded border border-blue-200 dark:border-blue-500/20">
                                        <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]"></div>
                                        <span className="text-[10px] text-blue-600 dark:text-blue-300">Thu</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 px-2 py-1 bg-red-50 dark:bg-red-500/10 rounded border border-red-200 dark:border-red-500/20">
                                        <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]"></div>
                                        <span className="text-[10px] text-red-600 dark:text-red-300">Chi</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 dark:bg-emerald-500/10 rounded border border-emerald-200 dark:border-emerald-500/20">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></div>
                                        <span className="text-[10px] text-emerald-600 dark:text-emerald-300">Tồn</span>
                                    </div>
                                </div>
                            </div>

                            <div className="w-full h-full z-10 -ml-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={historyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorBal" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.5} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                        <XAxis
                                            dataKey="month" // Format 2025-12 -> 12/25
                                            tickFormatter={(val) => {
                                                if (!val) return '';
                                                const parts = val.split('-');
                                                return `${parts[1]}/${parts[0].slice(2)}`;
                                            }}
                                            stroke="#64748b"
                                            tick={{ fill: '#64748b', fontSize: 10 }}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <YAxis
                                            yAxisId="left"
                                            stroke="#64748b"
                                            tick={{ fill: '#64748b', fontSize: 10 }}
                                            axisLine={false}
                                            tickLine={false}
                                            tickFormatter={(val) => new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 0 }).format(val)}
                                        />
                                        <YAxis
                                            yAxisId="right"
                                            orientation="right"
                                            stroke="#10b981"
                                            tick={{ fill: '#10b981', fontSize: 10 }}
                                            axisLine={false}
                                            tickLine={false}
                                            tickFormatter={(val) => new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 0 }).format(val)}
                                        />
                                        <Tooltip
                                            content={({ active, payload, label }) => {
                                                if (active && payload && payload.length) {
                                                    return (
                                                        <div className="bg-[#0f172a]/95 border border-white/20 p-3 rounded-xl shadow-2xl backdrop-blur-md">
                                                            <div className="text-white font-bold text-xs mb-2 border-b border-white/10 pb-1">Tháng {label}</div>
                                                            <div className="space-y-1">
                                                                <div className="text-blue-400 text-xs flex justify-between gap-4">
                                                                    <span>Thu:</span>
                                                                    <span className="font-mono">{new Intl.NumberFormat('vi-VN').format(Number(payload[0]?.value) || 0)}</span>
                                                                </div>
                                                                <div className="text-red-400 text-xs flex justify-between gap-4">
                                                                    <span>Chi:</span>
                                                                    <span className="font-mono">{new Intl.NumberFormat('vi-VN').format(Number(payload[1]?.value) || 0)}</span>
                                                                </div>
                                                                <div className="text-emerald-400 text-xs flex justify-between gap-4 font-bold pt-1 border-t border-white/5 mt-1">
                                                                    <span>Tồn:</span>
                                                                    <span className="font-mono">{new Intl.NumberFormat('vi-VN').format(Number(payload[2]?.value) || 0)}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Bar yAxisId="left" dataKey="in" fill="url(#colorIn)" barSize={20} radius={[4, 4, 0, 0]} animationDuration={1000} />
                                        <Bar yAxisId="left" dataKey="out" fill="url(#colorOut)" barSize={20} radius={[4, 4, 0, 0]} animationDuration={1000} />
                                        <Line
                                            yAxisId="right"
                                            type="linear"
                                            dataKey="balance"
                                            stroke="#10b981"
                                            strokeWidth={3}
                                            dot={{ r: 4, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
                                            activeDot={{ r: 6, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
                                            animationDuration={1500}
                                        />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* QR Code - UPDATED */}
                    <QRCodeSection bankInfo={bankInfo} />
                </div>

                {/* Right Column: Transaction Table */}
                <div className="lg:col-span-2 bg-white/60 dark:bg-[#1e293b]/60 backdrop-blur-xl rounded-[2rem] border border-white/20 dark:border-white/10 flex flex-col overflow-hidden shadow-xl ring-1 ring-black/5">
                    <div className="p-6 border-b border-white/10 flex justify-between items-center bg-gradient-to-r from-slate-50/50 to-white/0 dark:from-slate-900/50">
                        <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-lg">
                            📄 Chi tiết giao dịch
                        </h3>
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">*Dữ liệu từ Google Sheet</span>
                    </div>
                    <div className="overflow-auto flex-1 custom-scrollbar">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-100 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 uppercase text-xs sticky top-0 z-10 shadow-sm backdrop-blur-md">
                                <tr>
                                    <th className="p-3 w-32 whitespace-nowrap">Thời gian</th>
                                    <th className="p-3">Nội dung</th>
                                    <th className="p-3 w-36 text-right text-blue-600 dark:text-blue-400 whitespace-nowrap">Thu (Vào)</th> {/* Blue */}
                                    <th className="p-3 w-36 text-right text-red-600 dark:text-red-400 whitespace-nowrap">Chi (Ra)</th>   {/* Red */}
                                    <th className="p-3 w-36 text-right text-emerald-600 dark:text-emerald-400 whitespace-nowrap">Tồn (Dư)</th> {/* Green */}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="p-12 text-center text-slate-500 animate-pulse">
                                            Đang tải dữ liệu...
                                        </td>
                                    </tr>
                                ) : transactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-12 text-center text-slate-500 italic">
                                            Chưa có dữ liệu phát sinh trong tháng này.
                                        </td>
                                    </tr>
                                ) : (
                                    transactions.map((t) => (
                                        <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                                            <td className="p-3 text-slate-600 dark:text-slate-400 whitespace-nowrap align-top font-mono text-xs group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                                                {new Date(t.date).toLocaleDateString('vi-VN')}
                                            </td>
                                            <td className="p-3 text-slate-800 dark:text-slate-200 align-top group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                                                {t.content}
                                                {t.note && <div className="text-xs text-slate-500 mt-1 italic">{t.note}</div>}
                                            </td>
                                            <td className="p-3 text-right font-medium text-blue-600 dark:text-blue-400 align-top"> {/* Blue */}
                                                {t.amount_in > 0 ? `+${formatCurrency(t.amount_in)}` : '-'}
                                            </td>
                                            <td className="p-3 text-right font-medium text-red-600 dark:text-red-400 align-top"> {/* Red */}
                                                {t.amount_out > 0 ? `-${formatCurrency(t.amount_out)}` : '-'}
                                            </td>
                                            <td className="p-3 text-right font-mono text-emerald-600 dark:text-emerald-400 align-top font-bold"> {/* Green */}
                                                {formatCurrency(t.balance)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div >
            </div >
        </div >
    );
};

// QR Code Section Component
const QRCodeSection = ({ bankInfo }: { bankInfo: any }) => {
    const [isZoomed, setIsZoomed] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(bankInfo.accountNumber);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownload = async () => {
        try {
            const response = await fetch(bankInfo.qrUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `QR-${bankInfo.bankName}-${bankInfo.accountNumber}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Error downloading QR:', error);
        }
    };

    const handleTransfer = () => {
        handleCopy();
        alert("Đã sao chép số tài khoản. Vui lòng mở ứng dụng ngân hàng để chuyển khoản.");
    };

    return (
        <>
            <div className="bg-white p-4 rounded-xl flex flex-col items-center gap-4 shadow-lg border border-slate-200">
                <div className="relative group cursor-pointer" onClick={() => setIsZoomed(true)}>
                    <img src={bankInfo.qrUrl} alt="QR Code" className="w-full max-w-[200px] h-auto object-contain transition-transform group-hover:scale-105" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 flex items-center justify-center transition-all rounded-lg">
                        <Maximize2 className="text-white opacity-0 group-hover:opacity-100 drop-shadow-md" size={32} />
                    </div>
                </div>

                <div className="text-center w-full">
                    <div className="text-slate-900 font-bold text-sm">{bankInfo.bankName}</div>
                    <div className="text-slate-600 text-xs font-mono my-1 flex justify-center items-center gap-2 group cursor-pointer" onClick={handleCopy}>
                        {bankInfo.accountNumber}
                        {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />}
                    </div>
                    <div className="text-slate-800 text-xs font-bold uppercase truncate px-2">{bankInfo.accountName}</div>
                </div>

                <div className="grid grid-cols-2 gap-2 w-full mt-1">
                    <button onClick={handleCopy} className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-colors">
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                        {copied ? 'Đã chép' : 'Copy'}
                    </button>
                    <button onClick={handleDownload} className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-colors">
                        <Download size={14} />
                        Lưu QR
                    </button>
                    <button onClick={handleTransfer} className="col-span-2 flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors shadow-lg shadow-indigo-500/20">
                        <ExternalLink size={14} />
                        Chuyển tiền trực tiếp
                    </button>
                </div>
            </div>

            {/* Modal Zoom */}
            {isZoomed && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4" onClick={() => setIsZoomed(false)}>
                    <button className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors">
                        <X size={32} />
                    </button>
                    <div className="relative animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-sm w-full flex flex-col items-center gap-6">
                            <div className="text-center">
                                <h3 className="text-xl font-bold text-slate-900 mb-1">Quét mã để chuyển tiền</h3>
                                <p className="text-sm text-slate-500">Sử dụng ứng dụng ngân hàng hoặc ví điện tử</p>
                            </div>
                            <img src={bankInfo.qrUrl} alt="QR Code Large" className="w-full h-auto rounded-lg border border-slate-100 shadow-inner" />
                            <div className="w-full space-y-3">
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                                    <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Số tài khoản</div>
                                    <div className="text-lg font-mono font-bold text-slate-900 flex items-center justify-center gap-2 cursor-pointer" onClick={handleCopy}>
                                        {bankInfo.accountNumber}
                                        <Copy size={16} className="text-slate-400" />
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={handleDownload} className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
                                        <Download size={18} /> Lưu ảnh
                                    </button>
                                    <button onClick={handleTransfer} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-500 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20">
                                        <ExternalLink size={18} /> Chuyển khoản
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default BusinessFund;
