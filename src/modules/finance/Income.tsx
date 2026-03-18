import { useState, useMemo, useEffect } from 'react';
import { useData, PayrollRecord } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
// import { supabase } from '../../utils/supabaseClient';
import { Search, DollarSign, Wallet, Calculator, Sparkles, ShieldAlert, Lock } from 'lucide-react';
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
    const { payrollRecords, updatePayrollRecord, refreshData, users } = useData();
    const { currentUser, isAdminView } = useAuth();
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [searchTerm, setSearchTerm] = useState('');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_isGenerating, _setIsGenerating] = useState(false);

    // Admin check: only admin users in admin view can edit payroll
    const appUser = users.find(u => u.email === currentUser?.email);
    const isSuperAdmin = ['mcngocsonvualoidan@gmail.com', 'ccmartech.com@gmail.com'].includes(currentUser?.email || '');
    const canEditPayroll = (appUser?.isAdmin || isSuperAdmin) && isAdminView;

    // Force refresh on mount to ensure data is present
    useEffect(() => {
        refreshData();
    }, []);

    // Auto-select latest month with data if current view is empty
    useEffect(() => {
        if (payrollRecords.length > 0) {
            const hasDataForCurrent = payrollRecords.some(r => r.month === selectedMonth);
            if (!hasDataForCurrent) {
                // Find latest month
                const months = Array.from(new Set(payrollRecords.map(r => r.month))).sort().reverse();
                if (months.length > 0) {
                    setSelectedMonth(months[0]);
                }
            }
        }
    }, [payrollRecords]);

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

    // Hardcoded data import functions removed as data is now persisted in Supabase.
    // Use the Refresh button to load existing data.

    /* generateJan2026 function - hidden along with its UI button
    const generateJan2026 = async () => {
        _setIsGenerating(true);
        // ... function body preserved as comment ...
        _setIsGenerating(false);
    };
    */

    return (
        <div className="p-6 h-full flex flex-col gap-6">
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
                    {/* Month Picker */}
                    <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="px-4 py-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 rounded-xl font-bold text-sm shadow-sm outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />

                    {/* Hidden utility buttons - temporarily disabled per user request */}
                    {/* <button onClick={() => refreshData()} ... /> */}
                    {/* <button ... Khôi phục Dữ liệu ... /> */}
                    {/* <button ... Dự kiến T1/2026 ... /> */}
                </div>
            </div>

            {/* Read-Only Banner for non-admin users */}
            {!canEditPayroll && (
                <div className="flex items-center gap-3 px-5 py-3.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 rounded-2xl mb-4 shadow-sm">
                    <div className="p-2 bg-amber-100 dark:bg-amber-800/40 rounded-xl">
                        <ShieldAlert size={20} className="text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-amber-800 dark:text-amber-300">Chế độ chỉ xem</p>
                        <p className="text-xs text-amber-600 dark:text-amber-400/80">Bảng thu nhập chỉ được chỉnh sửa bởi quản trị viên. Liên hệ Admin nếu cần cập nhật.</p>
                    </div>
                    <Lock size={16} className="ml-auto text-amber-400 dark:text-amber-600" />
                </div>
            )}

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
                                    updateRecord={updatePayrollRecord}
                                    canEdit={canEditPayroll}
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
            {/* Debug Info */}
            <div className="text-xs text-slate-400 font-mono mt-4 p-4 border border-slate-200 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                <p><strong>DEBUG INFO:</strong></p>
                <p>Selected Month: {selectedMonth}</p>
                <p>Total Records Loaded: {payrollRecords.length}</p>
                <p>Filtered Records: {filteredRecords.length}</p>
                <p>Available Months: {Array.from(new Set(payrollRecords.map(r => r.month))).join(', ')}</p>
            </div>
        </div>
    );
};

function EditableRow({ record, idx, updateRecord, canEdit = false }: {
    record: PayrollRecord;
    idx: number;
    updateRecord: (id: string, data: Partial<PayrollRecord>) => void;
    canEdit?: boolean;
}) {

    // All cells are read-only if user doesn't have edit permission
    const isReadOnly = !canEdit;

    // Helper for number inputs
    const NumberCell = ({ value, field, readOnly = false, className = '' }: { value: number | undefined, field: keyof PayrollRecord, readOnly?: boolean, className?: string }) => {
        const effectiveReadOnly = isReadOnly || readOnly;
        return (
            <td className={`p-0 border-r border-slate-200 dark:border-white/5 relative group ${className}`}>
                <input
                    type="number"
                    value={value || 0}
                    readOnly={effectiveReadOnly}
                    tabIndex={effectiveReadOnly ? -1 : 0}
                    onChange={(e) => {
                        if (effectiveReadOnly) return;
                        const val = Number(e.target.value);

                        // Create a copy to calculate dependent fields
                        const next = { ...record, [field]: val };

                        // Recalculate Formulas
                        next.totalAllowanceActual = (next.allowanceMeal || 0) + (next.allowanceFuel || 0) + (next.allowancePhone || 0) + (next.allowanceAttendance || 0);
                        next.totalAdditional = (next.incomeMentalHealth || 0) + (next.incomeOvertime || 0) + (next.incomeQuality || 0) + (next.incomeSpecial || 0) + (next.incomeOfficer || 0) + (next.incomeKPI || 0);

                        // Actual Income
                        next.totalActualIncome = (next.basicSalary || 0) + next.totalAllowanceActual + next.totalAdditional;

                        next.totalIncome = next.totalActualIncome + (next.insuranceCompany || 0);
                        next.netPay = next.totalActualIncome - (next.insuranceEmployee || 0) - (next.advancePayment || 0);

                        // Send update
                        updateRecord(record.id, next);
                    }}
                    className={`w-full h-full bg-transparent px-2 py-3 text-right focus:outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${effectiveReadOnly ? 'cursor-default text-slate-500 dark:text-slate-400 select-none pointer-events-none' : 'text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-white/5 focus:bg-indigo-500/10 dark:focus:bg-indigo-500/20'}`}
                />
            </td>
        );
    };

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
