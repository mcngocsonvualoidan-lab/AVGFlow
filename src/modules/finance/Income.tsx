import { useState, useMemo, useEffect } from 'react';
import { useData, PayrollRecord } from '../../context/DataContext';
import { supabase } from '../../utils/supabaseClient';
import { Upload, Search, Loader2, DollarSign, Wallet, Calculator, Sparkles } from 'lucide-react';
import HeroBanner from '../../components/HeroBanner';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';

const Income = () => {
    const { payrollRecords, updatePayrollRecord, addNotification } = useData();
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [searchTerm, setSearchTerm] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    // Defined Sort Order
    const SORT_ORDER = [
        'Lê Thị Nga',
        'Lê Trần Thiện Tâm',
        'Nguyễn Ngọc Sơn',
        'Hà Ngọc Doanh',
        'Phan Thị Hải',
        'Nguyễn Thị Quỳnh Nga',
        'Trần Hải Lưu',
        'Lê Thị Ánh Nguyệt',
        'Nguyễn Mạnh Thành',
        'Đinh Hoàng Ngọc Hân'
    ];

    // Filter Logic with Sorting
    const filteredRecords = useMemo(() => {
        const results = payrollRecords.filter(r => {
            const matchesMonth = r.month === selectedMonth;
            const matchesSearch = (r.fullName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (r.employeeCode || '').toLowerCase().includes(searchTerm.toLowerCase());
            return matchesMonth && matchesSearch;
        });

        return results.sort((a, b) => {
            const indexA = SORT_ORDER.indexOf(a.fullName);
            const indexB = SORT_ORDER.indexOf(b.fullName);

            // If both are in the list, sort by index
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            // If only A is in list, A comes first
            if (indexA !== -1) return -1;
            // If only B is in list, B comes first
            if (indexB !== -1) return 1;
            // Otherwise sort alphabetically
            return a.fullName.localeCompare(b.fullName);
        });
    }, [payrollRecords, selectedMonth, searchTerm]);



    // Chart Data Preparation: Group by Month -> Employee -> NetPay
    const chartData = useMemo(() => {
        const months = Array.from(new Set(payrollRecords.map(r => r.month))).sort();
        return months.map(month => {
            const recordsInMonth = payrollRecords.filter(r => r.month === month);
            const point: any = { month };
            recordsInMonth.forEach(r => {
                point[r.fullName] = r.netPay;
            });
            return point;
        });
    }, [payrollRecords]);

    const employeeNames = useMemo(() => {
        const names = Array.from(new Set(payrollRecords.map(r => r.fullName)));
        return names.sort((a, b) => {
            const indexA = SORT_ORDER.indexOf(a);
            const indexB = SORT_ORDER.indexOf(b);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return a.localeCompare(b);
        });
    }, [payrollRecords]);

    const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#a855f7'];

    const loadNov2025Data = async () => {
        const novData = [
            { id: '2025-11-NV002', code: 'NV002', name: 'Lê Thị Nga', net: 11562500, dept: 'Khối Văn Phòng' },
            { id: '2025-11-NV004', code: 'NV004', name: 'Lê Trần Thiện Tâm', net: 9685000, dept: 'InterData' },
            { id: '2025-11-NV005', code: 'NV005', name: 'Nguyễn Ngọc Sơn', net: 14422500, dept: 'Tổng Giám Đốc' },
            { id: '2025-11-NV006', code: 'NV006', name: 'Hà Ngọc Doanh', net: 11185000, dept: 'Khối Văn Phòng' },
            { id: '2025-11-NV017', code: 'NV017', name: 'Trần Hải Lưu', net: 14195000, dept: 'Nhân Sự' },
            { id: '2025-11-NV008', code: 'NV008', name: 'Phan Thị Hải', net: 13208333, dept: 'Phát Triển RDI' },
            { id: '2025-11-NV009', code: 'NV009', name: 'Nguyễn Thị Quỳnh Nga', net: 10013462, dept: 'Phát Triển RDI' },
            { id: '2025-11-NV011', code: 'NV011', name: 'Lê Thị Ánh Nguyệt', net: 12395000, dept: 'Dữ Liệu' },
            { id: '2025-11-NV012', code: 'NV012', name: 'Nguyễn Mạnh Thành', net: 14895000, dept: 'Tài Chính' },

            { id: '2025-11-NV014', code: 'NV014', name: 'Đinh Hoàng Ngọc Hân', net: 11165000, dept: 'Tài Chính' }
        ];

        const records = novData.map(r => ({
            id: r.id,
            month: '2025-11',
            userId: '',
            employeeCode: r.code,
            fullName: r.name,
            position: '',
            department: r.dept,
            basicSalary: 5000000, // Placeholder
            actualWorkDays: 26,
            allowanceMeal: 0, allowanceFuel: 0, allowancePhone: 0, allowanceAttendance: 0, totalAllowanceActual: 0,
            incomeMentalHealth: 0, incomeOvertime: 0, incomeQuality: 0, incomeSpecial: 0, incomeOfficer: 0, incomeKPI: 0, totalAdditional: 0,
            totalActualIncome: 0, insuranceCompany: 0, insuranceEmployee: 0, advancePayment: 0,
            totalIncome: 0,
            netPay: r.net
        }));

        const payload = records.map(r => ({
            id: r.id,
            month: r.month,
            user_id: '',
            employee_code: r.employeeCode,
            full_name: r.fullName,
            position: '',
            department: r.department,
            basic_salary: r.basicSalary,
            actual_work_days: r.actualWorkDays,
            allowance_meal: 0, allowance_fuel: 0, allowance_phone: 0, allowance_attendance: 0, total_allowance_actual: 0,
            income_mental_health: 0, income_overtime: 0, income_quality: 0, income_special: 0, income_officer: 0, income_kpi: 0, total_additional: 0,
            total_actual_income: 0, insurance_company: 0, insurance_employee: 0, advance_payment: 0,
            total_income: 0,
            net_pay: r.netPay
        }));

        await supabase.from('payroll').upsert(payload);
        // Do not change selected month automatically to avoid jumping if user is viewing something else
        // setSelectedMonth('2025-11'); 
    };

    // Auto-seed Nov 2025 if missing (User Request)
    useEffect(() => {
        // Debounce or check effectively. 
        // We check if we have data loaded (length > 0) but NO Nov 2025 data.
        if (payrollRecords.length > 0 && !payrollRecords.some(r => r.month === '2025-11')) {
            console.log('Auto-seeding Nov 2025 Data...');
            loadNov2025Data();
        }
    }, [payrollRecords]);

    const importDec2025Data = async () => {
        // Data parsed from: https://docs.google.com/spreadsheets/d/1o9LIOYj5sWzYtEV42J4VyM1CkYDR2qnd6LaumnOOKz0/edit?gid=318390419
        const rawData = [
            // KHOI VAN PHONG
            { code: 'NV002', name: 'Lê Thị Nga', salary: 5500000, days: 27, meal: 2000000, fuel: 0, phone: 0, attend: 3000000, totalAllow: 5000000, mental: 500000, over: 2100000, qual: 420000, spec: 700000, off: 0, kpi: 0, totalAdd: 3720000, insurance: 577500, adv: 0, net: 17458846, gross: 18036346, dept: 'Khối Văn Phòng' },
            { code: 'NV004', name: 'Lê Trần Thiện Tâm', salary: 5000000, days: 27, meal: 2000000, fuel: 0, phone: 0, attend: 1500000, totalAllow: 3500000, mental: 500000, over: 990000, qual: 210000, spec: 0, off: 0, kpi: 0, totalAdd: 1700000, insurance: 525000, adv: 0, net: 10447681, gross: 10972681, dept: 'InterData' },
            { code: 'NV005', name: 'Nguyễn Ngọc Sơn', salary: 5500000, days: 27, meal: 2000000, fuel: 2000000, phone: 2000000, attend: 3000000, totalAllow: 9000000, mental: 500000, over: 0, qual: 0, spec: 0, off: 0, kpi: 0, totalAdd: 500000, insurance: 577500, adv: 0, net: 15762067, gross: 16339567, dept: 'Tổng Giám Đốc' },
            { code: 'NV006', name: 'Hà Ngọc Doanh', salary: 5000000, days: 27, meal: 2000000, fuel: 0, phone: 1000000, attend: 2500000, totalAllow: 5500000, mental: 500000, over: 450000, qual: 30000, spec: 0, off: 0, kpi: 0, totalAdd: 980000, insurance: 525000, adv: 0, net: 10955000, gross: 11480000, dept: 'Khối Văn Phòng' },
            { code: 'NV017', name: 'Trần Hải Lưu', salary: 5000000, days: 27, meal: 2000000, fuel: 2000000, phone: 1000000, attend: 2500000, totalAllow: 7500000, mental: 500000, over: 540000, qual: 0, spec: 200000, off: 0, kpi: 0, totalAdd: 1240000, insurance: 525000, adv: 0, net: 15952239, gross: 16477239, dept: 'Nhân Sự' },

            // RDI
            { code: 'NV008', name: 'Phan Thị Hải', salary: 5000000, days: 27, meal: 2000000, fuel: 1000000, phone: 1000000, attend: 3000000, totalAllow: 7000000, mental: 0, over: 0, qual: 0, spec: 0, off: 0, kpi: 0, totalAdd: 1540741, insurance: 525000, adv: 0, net: 13015741, gross: 13540741, dept: 'Phát Triển RDI' },
            { code: 'NV009', name: 'Nguyễn Thị Quỳnh Nga', salary: 5000000, days: 27, meal: 2000000, fuel: 0, phone: 0, attend: 2000000, totalAllow: 4000000, mental: 0, over: 0, qual: 0, spec: 0, off: 0, kpi: 0, totalAdd: 1422222, insurance: 525000, adv: 0, net: 9897222, gross: 10422222, dept: 'Phát Triển RDI' },

            // DU LIEU
            { code: 'NV011', name: 'Lê Thị Ánh Nguyệt', salary: 5000000, days: 27, meal: 2000000, fuel: 1000000, phone: 1000000, attend: 2000000, totalAllow: 6000000, mental: 500000, over: 1230000, qual: 210000, spec: 0, off: 0, kpi: 0, totalAdd: 1940000, insurance: 525000, adv: 0, net: 15234926, gross: 15759926, dept: 'Dữ Liệu' },
            { code: 'NV012', name: 'Nguyễn Mạnh Thành', salary: 5000000, days: 27, meal: 2000000, fuel: 2000000, phone: 2000000, attend: 3000000, totalAllow: 9000000, mental: 500000, over: 630000, qual: 30000, spec: 200000, off: 0, kpi: 0, totalAdd: 1360000, insurance: 525000, adv: 0, net: 17974806, gross: 18499806, dept: 'Tài Chính' },

            // NV014 Added
            { code: 'NV014', name: 'Đinh Hoàng Ngọc Hân', salary: 5000000, days: 25, meal: 2000000, fuel: 0, phone: 1000000, attend: 2000000, totalAllow: 5000000, mental: 500000, over: 990000, qual: 0, spec: 0, off: 0, kpi: 200000, totalAdd: 1690000, insurance: 525000, adv: 0, net: 11165000, gross: 11690000, dept: 'Tài Chính' }
        ];

        const recordsToInsert = rawData.map(r => ({
            id: `2025-12-${r.code}`,
            month: '2025-12',
            user_id: '', // Would need to map to real user IDs if available
            employee_code: r.code,
            full_name: r.name,
            position: '',
            department: r.dept,
            basic_salary: r.salary,
            actual_work_days: r.days,
            allowance_meal: r.meal,
            allowance_fuel: r.fuel,
            allowance_phone: r.phone,
            allowance_attendance: r.attend,
            total_allowance_actual: r.totalAllow,
            income_mental_health: r.mental,
            income_overtime: r.over,
            income_quality: r.qual,
            income_special: r.spec,
            income_officer: r.off,
            income_kpi: r.kpi,
            total_additional: r.totalAdd,
            total_actual_income: r.salary + r.totalAllow + r.totalAdd, // Re-calc to be safe
            insurance_company: r.salary * 0.215, // Approx if not provided
            insurance_employee: r.insurance,
            advance_payment: r.adv,
            total_income: r.gross,
            net_pay: r.net
        }));

        // Upload to Supabase
        const { error } = await supabase.from('payroll').upsert(recordsToInsert);

        if (error) {
            console.error('Upload failed:', error);
            addNotification({
                id: `ERR-${Date.now()}`,
                title: 'Lỗi cập nhật',
                message: 'Không thể tải dữ liệu lên Supabase.',
                type: 'error',
                time: 'Vừa xong',
                read: false
            });
        } else {
            setSelectedMonth('2025-12');
            addNotification({
                id: `LOAD-DEC-${Date.now()}`,
                title: 'Đã cập nhật T12/2025',
                message: 'Dữ liệu lương tháng 12/2025 đã được tải lên Supabase.',
                type: 'success',
                time: 'Vừa xong',
                read: false
            });
        }
    };

    const generateJan2026 = async () => {
        setIsGenerating(true);
        try {
            // 1. Fetch Dec 2025 Data from Supabase (Source of Truth)
            const { data: decData, error: decError } = await supabase
                .from('payroll')
                .select('*')
                .eq('month', '2025-12');

            if (decError || !decData || decData.length === 0) {
                addNotification({
                    id: `ERR-DEC-${Date.now()}`,
                    title: 'Thiếu dữ liệu',
                    message: 'Không tìm thấy bảng lương tháng 12/2025 trên hệ thống. Vui lòng tạo hoặc nhập lại.',
                    type: 'error',
                    time: 'Vừa xong',
                    read: false
                });
                alert('Không tìm thấy dữ liệu lương T12/2025!');
                setIsGenerating(false);
                return;
            }

            // 2. Fetch Users for Attendance
            const { data: userData, error: userError } = await supabase.from('users').select('*');
            if (userError) {
                console.error(userError);
                setIsGenerating(false);
                return;
            }

            // Standard Working Days for Jan 2026 (31 days - 4 Sundays = 27 days)
            const STANDARD_DAYS = 27;

            const newRecords = userData.map(user => {
                // Find base record in Dec Data
                const base = decData.find((r: any) => r.employee_code === user.employee_code) || {
                    basic_salary: 5000000,
                    allowance_meal: 0, allowance_fuel: 0, allowance_phone: 0, allowance_attendance: 0,
                    income_mental_health: 0, income_overtime: 0, income_quality: 0, income_special: 0, income_officer: 0, income_kpi: 0
                };

                // Calculate Absence
                let absenceDays = 0;
                if (user.leaves) {
                    const leaves = Array.isArray(user.leaves) ? user.leaves : JSON.parse(user.leaves);
                    leaves.forEach((leave: any) => {
                        if (leave.type === 'absence' && leave.start.startsWith('2026-01')) {
                            const start = new Date(leave.start);
                            const end = new Date(leave.end);
                            const d1 = new Date(start.toDateString());
                            const d2 = new Date(end.toDateString());
                            const days = (d2.getTime() - d1.getTime()) / (1000 * 3600 * 24) + 1;

                            // Check session
                            if (leave.session && leave.session !== 'full') {
                                absenceDays += 0.5 * days; // If multi-day half-day? Unlikely. Usually single day.
                            } else {
                                absenceDays += days;
                            }
                        }
                    });
                }

                const actualWorkDays = Math.max(0, STANDARD_DAYS - absenceDays);

                // Map to Snake Case for Supabase
                const newRecord = {
                    id: `2026-01-${user.employee_code || user.id}`,
                    month: '2026-01',
                    user_id: user.id,
                    employee_code: user.employee_code || 'NV-NEW',
                    full_name: user.name || user.full_name,
                    position: user.role,
                    department: user.dept,

                    basic_salary: base.basic_salary,
                    actual_work_days: actualWorkDays,

                    allowance_meal: base.allowance_meal,
                    allowance_fuel: base.allowance_fuel,
                    allowance_phone: base.allowance_phone,
                    allowance_attendance: base.allowance_attendance,
                    total_allowance_actual: 0, // calc

                    income_mental_health: base.income_mental_health,
                    income_overtime: 0,
                    income_quality: base.income_quality,
                    income_special: base.income_special,
                    income_officer: base.income_officer,
                    income_kpi: 0,
                    total_additional: 0, // calc

                    total_actual_income: 0,
                    insurance_company: 0,
                    insurance_employee: 0,
                    advance_payment: 0,
                    total_income: 0,
                    net_pay: 0
                };

                // Calculations
                newRecord.total_allowance_actual = newRecord.allowance_meal + newRecord.allowance_fuel + newRecord.allowance_phone + newRecord.allowance_attendance;
                newRecord.total_additional = newRecord.income_mental_health + newRecord.income_overtime + newRecord.income_quality + newRecord.income_special + newRecord.income_officer + newRecord.income_kpi;
                newRecord.total_actual_income = newRecord.basic_salary + newRecord.total_allowance_actual + newRecord.total_additional;

                newRecord.insurance_company = newRecord.basic_salary * 0.215;
                newRecord.insurance_employee = newRecord.basic_salary * 0.105;

                newRecord.total_income = newRecord.total_actual_income;
                newRecord.net_pay = newRecord.total_actual_income - newRecord.insurance_employee - newRecord.advance_payment;

                return newRecord;
            }).filter(r => r.employee_code !== 'NV013' && r.employee_code !== '24009' && r.full_name !== 'Nguyễn Thị Hào');

            await supabase.from('payroll').upsert(newRecords);

            // Explicitly remove if it existed from previous runs (Check both Code and Name variants)
            await supabase.from('payroll').delete().eq('month', '2026-01').in('employee_code', ['NV013', '24009']);
            await supabase.from('payroll').delete().eq('month', '2026-01').eq('full_name', 'Nguyễn Thị Hào');

            setSelectedMonth('2026-01');
            addNotification({ id: `JAN26-${Date.now()}`, title: 'Thành công', message: `Đã tạo bảng lương T1/2026 cho ${newRecords.length} nhân sự.`, type: 'success', time: 'Vừa xong', read: false });

        } catch (e) {
            console.error(e);
            addNotification({ id: `ERR-GEN-${Date.now()}`, title: 'Lỗi', message: 'Có lỗi xảy ra khi tạo bảng lương.', type: 'error', time: 'Now', read: false });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="p-6 h-full flex flex-col bg-white/50 dark:bg-slate-800/50 backdrop-blur-3xl rounded-[3rem] shadow-2xl border border-white/20 ring-1 ring-white/20">
            {/* 1. Hero Banner */}
            <HeroBanner
                icon={DollarSign}
                title="Thu Nhập & Lương"
                subtitle="Payroll System"
                description="Quản lý chi trả lương, thưởng và các chế độ phúc lợi cho nhân sự định kỳ hàng tháng."
                badge="Finance & HR"
                badgeIcon={Sparkles}
                secondBadge={`Kỳ lương: ${selectedMonth.split('-')[1]}/${selectedMonth.split('-')[0]}`}
                stats={[
                    { icon: Wallet, label: 'Tổng chi trả', value: new Intl.NumberFormat('en-US', { notation: "compact" }).format(filteredRecords.reduce((sum, r) => sum + (r.netPay || 0), 0)), color: 'from-emerald-400 to-green-500' },
                    { icon: Calculator, label: 'Nhân sự', value: filteredRecords.length, color: 'from-blue-400 to-indigo-500' },
                ]}
                gradientFrom="from-emerald-600"
                gradientVia="via-teal-600"
                gradientTo="to-cyan-600"
                accentColor="emerald"
            />

            {/* 2. Action Toolbar */}
            <div className="flex flex-col lg:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm mb-6">
                {/* Search Bar */}
                <div className="w-full lg:flex-1 relative group max-w-md">
                    <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Tìm kiếm nhân sự..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-900/50 border-none outline-none rounded-xl text-slate-700 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium"
                    />
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
                    <button
                        onClick={loadNov2025Data}
                        className="px-4 py-2.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 rounded-xl font-bold text-sm shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center gap-2"
                    >
                        <Upload size={16} /> <span className="hidden sm:inline">T11/2025</span>
                    </button>
                    <button
                        onClick={importDec2025Data}
                        className="px-4 py-2.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 rounded-xl font-bold text-sm shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center gap-2"
                    >
                        <Upload size={16} /> <span className="hidden sm:inline">T12/2025</span>
                    </button>
                    <button
                        onClick={generateJan2026}
                        disabled={isGenerating}
                        className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-500/30 hover:bg-emerald-500 transition-all flex items-center gap-2 disabled:opacity-70"
                    >
                        {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                        {isGenerating ? 'Đang xử lý...' : 'Dự kiến T1/2026'}
                    </button>
                </div>
            </div>

            {/* spreadsheet Table */}
            <div className="w-full border border-white/20 dark:border-white/10 rounded-[1.5rem] bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl relative overflow-x-auto shadow-inner mb-6">
                <table className="w-full text-xs text-left border-collapse min-w-[2400px]">
                    <thead className="sticky top-0 z-20 shadow-md">
                        <tr className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-white/10">
                            <th className="p-3 border border-slate-200 dark:border-white/10" rowSpan={2} style={{ width: 50 }}>STT</th>
                            <th className="p-3 border border-slate-200 dark:border-white/10" rowSpan={2} style={{ width: 80 }}>Mã NV</th>
                            <th className="p-3 border border-slate-200 dark:border-white/10" rowSpan={2} style={{ width: 180 }}>Họ và tên</th>
                            <th className="p-3 border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-900" rowSpan={2} style={{ width: 120 }}>Chức vụ</th>
                            <th className="p-3 border border-slate-200 dark:border-white/10 text-right bg-slate-100 dark:bg-slate-900" rowSpan={2} style={{ width: 100 }}>Lương CB</th>
                            <th className="p-3 border border-slate-200 dark:border-white/10 text-center bg-slate-100 dark:bg-slate-900" rowSpan={2} style={{ width: 60 }}>Ngày công</th>
                            <th className="p-2 border border-slate-200 dark:border-white/10 text-center bg-slate-200 dark:bg-slate-800" colSpan={5}>Phụ cấp</th>
                            <th className="p-2 border border-slate-200 dark:border-white/10 text-center bg-slate-200 dark:bg-slate-800" colSpan={7}>Thu nhập tăng thêm</th>
                            <th className="p-3 border border-slate-200 dark:border-white/10 text-right bg-emerald-100 dark:bg-emerald-900/40 min-w-[100px]" rowSpan={2}>T.Nhập thực tế</th>
                            <th className="p-2 border border-slate-200 dark:border-white/10 text-center bg-slate-200 dark:bg-slate-800" colSpan={2}>BHXH (21.5% / 10.5%)</th>
                            <th className="p-3 border border-slate-200 dark:border-white/10 text-right bg-slate-100 dark:bg-slate-900" rowSpan={2}>Tạm ứng/Phạt</th>
                            <th className="p-3 border border-slate-200 dark:border-white/10 text-right bg-yellow-100 dark:bg-yellow-900/40 font-bold text-yellow-600 dark:text-yellow-500 min-w-[100px]" rowSpan={2}>Thực lĩnh</th>
                        </tr>
                        <tr className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/10">
                            {/* Allowances Subheaders */}
                            <th className="p-2 border border-slate-200 dark:border-white/10 text-right min-w-[100px]">Tiền ăn</th>
                            <th className="p-2 border border-slate-200 dark:border-white/10 text-right min-w-[100px]">Xăng xe</th>
                            <th className="p-2 border border-slate-200 dark:border-white/10 text-right min-w-[100px]">Điện thoại</th>
                            <th className="p-2 border border-slate-200 dark:border-white/10 text-right min-w-[100px]">Chuyên cần</th>
                            <th className="p-2 border border-slate-200 dark:border-white/10 text-right min-w-[100px] font-bold text-slate-700 dark:text-slate-200">Tổng PC</th>

                            {/* Additional Income Subheaders */}
                            <th className="p-2 border border-slate-200 dark:border-white/10 text-right min-w-[100px]">SK Tinh thần</th>
                            <th className="p-2 border border-slate-200 dark:border-white/10 text-right min-w-[100px]">Thêm giờ</th>
                            <th className="p-2 border border-slate-200 dark:border-white/10 text-right min-w-[100px]">Chất lượng</th>
                            <th className="p-2 border border-slate-200 dark:border-white/10 text-right min-w-[100px]">Đặc thù</th>
                            <th className="p-2 border border-slate-200 dark:border-white/10 text-right min-w-[100px]">Cán bộ</th>
                            <th className="p-2 border border-slate-200 dark:border-white/10 text-right min-w-[100px]">KPI/DS</th>
                            <th className="p-2 border border-slate-200 dark:border-white/10 text-right min-w-[100px] font-bold text-slate-700 dark:text-slate-200">Tổng tăng</th>

                            {/* Insurance Subheaders */}
                            <th className="p-2 border border-slate-200 dark:border-white/10 text-right min-w-[100px]">Công ty</th>
                            <th className="p-2 border border-slate-200 dark:border-white/10 text-right min-w-[100px]">NLĐ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredRecords.length === 0 ? (
                            <tr>
                                <td colSpan={24} className="p-12 text-center text-slate-500 italic">
                                    Chưa có dữ liệu lương cho tháng {selectedMonth}. Hãy nhập file Excel hoặc thêm dữ liệu mẫu.
                                </td>
                            </tr>
                        ) : (
                            filteredRecords.map((record, idx) => (
                                <EditableRow
                                    key={record.id}
                                    record={record}
                                    idx={idx}
                                    updateRecord={(updater) => {
                                        const updated = updater(record);
                                        updatePayrollRecord(updated);
                                    }}
                                />
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="mt-2 flex flex-col xl:flex-row gap-8 items-start">
                {/* Chart (Right) */}
                <div className="w-full flex flex-col p-6 bg-white/60 dark:bg-slate-800/60 backdrop-blur-2xl rounded-[2rem] border border-white/20 shadow-xl">
                    <h3 className="text-slate-900 dark:text-white font-bold mb-6 text-xl flex items-center gap-2">
                        <span className="p-2 bg-emerald-100 dark:bg-emerald-500/20 rounded-lg text-emerald-600 dark:text-emerald-400">📈</span>
                        Biểu đồ biến động thu nhập
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                        {employeeNames.map((name, index) => (
                            <div key={name} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-2xl p-4 shadow-lg hover:shadow-xl transition-shadow flex flex-col relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-bl-full -mr-4 -mt-4"></div>
                                <h4 className="text-slate-700 dark:text-slate-300 font-bold mb-3 text-xs truncate z-10" title={name}>
                                    <span className="text-emerald-600 dark:text-emerald-500 mr-2">#{index + 1}</span>
                                    {name}
                                </h4>
                                <div className="h-[120px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={chartData} margin={{ top: 5, right: 25, left: 25, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.3} vertical={false} />
                                            <XAxis
                                                padding={{ left: 10, right: 10 }}
                                                dataKey="month"
                                                stroke="#64748b"
                                                tick={{ fontSize: 10 }}
                                                tickLine={false}
                                                axisLine={false}
                                                interval={0}
                                                tickFormatter={(value) => {
                                                    const [y, m] = value.split('-');
                                                    return `${m}/${y}`;
                                                }}
                                            />
                                            <YAxis
                                                hide={true}
                                                domain={['auto', 'auto']}
                                            />
                                            <Tooltip
                                                content={({ active, payload, label }) => {
                                                    if (active && payload && payload.length) {
                                                        const currentVal = Number(payload[0].value);
                                                        const currentMonth = String(label || '');
                                                        const [year, month] = currentMonth.split('-');

                                                        // Find prev data
                                                        const currentIndex = chartData.findIndex((item: any) => item.month === currentMonth);
                                                        let changeElem = null;

                                                        if (currentIndex > 0) {
                                                            const prevData = chartData[currentIndex - 1];
                                                            const prevVal = Number(prevData[name] || 0);
                                                            if (prevVal > 0) {
                                                                const diff = currentVal - prevVal;
                                                                const percent = (diff / prevVal) * 100;
                                                                const isPositive = diff >= 0;
                                                                changeElem = (
                                                                    <div className={`flex items-center gap-1 font-medium ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                                                        {isPositive ? '+' : ''}{percent.toFixed(1)}%
                                                                        <span className="text-[10px] text-slate-500 opacity-70">(so tháng trước)</span>
                                                                    </div>
                                                                );
                                                            }
                                                        }

                                                        return (
                                                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-2 rounded shadow-xl text-xs z-50">
                                                                <p className="text-slate-500 dark:text-slate-400 mb-1 font-mono">{month}/{year}</p>
                                                                <p className="font-bold text-slate-900 dark:text-white text-base font-mono min-w-[100px]">
                                                                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(currentVal)}
                                                                </p>
                                                                {changeElem}
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                            <Line
                                                type="linear"
                                                dataKey={name}
                                                stroke={COLORS[index % COLORS.length]}
                                                strokeWidth={2}
                                                dot={{ r: 3, strokeWidth: 1, fill: COLORS[index % COLORS.length] }} // Use color for dot fill in light mode potentially, but kept simple
                                                activeDot={{ r: 5 }}
                                                connectNulls={true}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

function EditableRow({ record, idx, updateRecord }: {
    record: PayrollRecord;
    idx: number;
    updateRecord: (updater: (prev: PayrollRecord) => PayrollRecord) => void
}) {

    // Helper for number inputs
    const NumberCell = ({ value, field, readOnly = false, className = '' }: { value: number, field: keyof PayrollRecord, readOnly?: boolean, className?: string }) => (
        <td className={`p-0 border-r border-slate-200 dark:border-white/5 relative group ${className}`}>
            <input
                type="number"
                value={value}
                readOnly={readOnly}
                onChange={(e) => {
                    if (readOnly) return;
                    const val = Number(e.target.value);
                    updateRecord(prev => {
                        const next = { ...prev, [field]: val };
                        // Recalculate Formulas
                        next.totalAllowanceActual = next.allowanceMeal + next.allowanceFuel + next.allowancePhone + next.allowanceAttendance;
                        next.totalAdditional = next.incomeMentalHealth + next.incomeOvertime + next.incomeQuality + next.incomeSpecial + next.incomeOfficer + next.incomeKPI;

                        // Assuming Basic Salary is fixed base, Actual Income = Basic + Allow + Add
                        next.totalActualIncome = next.basicSalary + next.totalAllowanceActual + next.totalAdditional;

                        // Auto-calc Insurance if not manual override? 
                        // next.insuranceCompany = next.basicSalary * 0.215;
                        // next.insuranceEmployee = next.basicSalary * 0.105;

                        next.totalIncome = next.totalActualIncome + next.insuranceCompany;
                        next.netPay = next.totalActualIncome - next.insuranceEmployee - next.advancePayment;

                        return next;
                    });
                }}
                className={`w-full h-full bg-transparent px-2 py-3 text-right focus:outline-none focus:bg-indigo-500/10 dark:focus:bg-indigo-500/20 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${readOnly ? 'cursor-default text-slate-400' : 'text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-white/5'}`}
            />
        </td>
    );

    const format = (num: number) => num ? new Intl.NumberFormat('vi-VN').format(num) : '0';

    return (
        <tr className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border-b border-slate-200 dark:border-white/5 font-mono">
            <td className="p-3 border-r border-slate-200 dark:border-white/5 text-slate-500 dark:text-slate-400">{idx + 1}</td>
            <td className="p-3 border-r border-slate-200 dark:border-white/5 font-bold text-slate-700 dark:text-slate-300">{record.employeeCode}</td>
            <td className="p-3 border-r border-slate-200 dark:border-white/5 text-slate-900 dark:text-white truncate max-w-[180px]">{record.fullName}</td>
            <td className="p-3 border-r border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-400">{record.position}</td>

            <NumberCell value={record.basicSalary} field="basicSalary" />
            <NumberCell value={record.actualWorkDays} field="actualWorkDays" className="text-center" />

            <NumberCell value={record.allowanceMeal} field="allowanceMeal" />
            <NumberCell value={record.allowanceFuel} field="allowanceFuel" />
            <NumberCell value={record.allowancePhone} field="allowancePhone" />
            <NumberCell value={record.allowanceAttendance} field="allowanceAttendance" />
            <td className="p-2 border-r border-slate-200 dark:border-white/5 text-right font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/5">{format(record.totalAllowanceActual)}</td>

            <NumberCell value={record.incomeMentalHealth} field="incomeMentalHealth" />
            <NumberCell value={record.incomeOvertime} field="incomeOvertime" />
            <NumberCell value={record.incomeQuality} field="incomeQuality" />
            <NumberCell value={record.incomeSpecial} field="incomeSpecial" />
            <NumberCell value={record.incomeOfficer} field="incomeOfficer" />
            <NumberCell value={record.incomeKPI} field="incomeKPI" />
            <td className="p-2 border-r border-slate-200 dark:border-white/5 text-right font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/5">{format(record.totalAdditional)}</td>

            <td className="p-2 border-r border-slate-200 dark:border-white/5 text-right font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-white/5">{format(record.totalActualIncome)}</td>

            <NumberCell value={record.insuranceCompany} field="insuranceCompany" />
            <NumberCell value={record.insuranceEmployee} field="insuranceEmployee" className="text-red-600 dark:text-red-400" />
            <NumberCell value={record.advancePayment} field="advancePayment" />

            <td className="p-3 border-r border-slate-200 dark:border-white/5 text-right font-bold text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-500/10 text-lg">
                {format(record.netPay)}
            </td>
        </tr>
    );
}

export default Income;
