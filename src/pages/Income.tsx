import React, { useState, useMemo } from 'react';
import { useData, PayrollRecord } from '../context/DataContext';
import { Upload, Search, ZoomIn, ZoomOut } from 'lucide-react';



const SAMPLE_PAYROLL_RECORDS: PayrollRecord[] = [
    {
        userId: '', id: '2026-01-NV002', month: '2026-01', employeeCode: 'NV002', fullName: 'Lê Thị Nga', position: '',
        basicSalary: 5500000, actualWorkDays: 25,
        allowanceMeal: 2000000, allowanceFuel: 0, allowancePhone: 0, allowanceAttendance: 3000000, totalAllowanceActual: 5000000,
        incomeMentalHealth: 500000, incomeOvertime: 0, incomeQuality: 0, incomeSpecial: 0, incomeOfficer: 0, incomeKPI: 0, totalAdditional: 1640000,
        totalActualIncome: 12140000, insuranceCompany: 1182500, insuranceEmployee: 577500, advancePayment: 0, totalIncome: 13322500, netPay: 11562500, department: ''
    },
    {
        userId: '', id: '2026-01-NV004', month: '2026-01', employeeCode: 'NV004', fullName: 'Lê Trần Thiện Tâm', position: '',
        basicSalary: 5000000, actualWorkDays: 25,
        allowanceMeal: 2000000, allowanceFuel: 0, allowancePhone: 0, allowanceAttendance: 1500000, totalAllowanceActual: 3500000,
        incomeMentalHealth: 500000, incomeOvertime: 810000, incomeQuality: 200000, incomeSpecial: 0, incomeOfficer: 0, incomeKPI: 200000, totalAdditional: 1710000,
        totalActualIncome: 10210000, insuranceCompany: 1075000, insuranceEmployee: 525000, advancePayment: 0, totalIncome: 11285000, netPay: 9685000, department: ''
    },
    {
        userId: '', id: '2026-01-NV005', month: '2026-01', employeeCode: 'NV005', fullName: 'Nguyễn Ngọc Sơn', position: '',
        basicSalary: 5500000, actualWorkDays: 25,
        allowanceMeal: 2000000, allowanceFuel: 2000000, allowancePhone: 2000000, allowanceAttendance: 3000000, totalAllowanceActual: 9000000,
        incomeMentalHealth: 500000, incomeOvertime: 0, incomeQuality: 0, incomeSpecial: 0, incomeOfficer: 0, incomeKPI: 0, totalAdditional: 500000,
        totalActualIncome: 15000000, insuranceCompany: 1182500, insuranceEmployee: 577500, advancePayment: 0, totalIncome: 16182500, netPay: 14422500, department: ''
    },
    {
        userId: '', id: '2026-01-NV006', month: '2026-01', employeeCode: 'NV006', fullName: 'Hà Ngọc Doanh', position: '',
        basicSalary: 5000000, actualWorkDays: 25,
        allowanceMeal: 2000000, allowanceFuel: 0, allowancePhone: 1000000, allowanceAttendance: 2500000, totalAllowanceActual: 5500000,
        incomeMentalHealth: 500000, incomeOvertime: 510000, incomeQuality: 0, incomeSpecial: 0, incomeOfficer: 0, incomeKPI: 200000, totalAdditional: 1210000,
        totalActualIncome: 11710000, insuranceCompany: 1075000, insuranceEmployee: 525000, advancePayment: 0, totalIncome: 12785000, netPay: 11185000, department: ''
    },
    {
        userId: '', id: '2026-01-NV017', month: '2026-01', employeeCode: 'NV017', fullName: 'Trần Hải Lưu', position: '',
        basicSalary: 5000000, actualWorkDays: 25,
        allowanceMeal: 2000000, allowanceFuel: 2000000, allowancePhone: 2500000, allowanceAttendance: 2000000, totalAllowanceActual: 8500000,
        incomeMentalHealth: 500000, incomeOvertime: 420000, incomeQuality: 300000, incomeSpecial: 0, incomeOfficer: 0, incomeKPI: 0, totalAdditional: 1220000,
        totalActualIncome: 14720000, insuranceCompany: 1075000, insuranceEmployee: 525000, advancePayment: 0, totalIncome: 15795000, netPay: 14195000, department: ''
    },
    {
        userId: '', id: '2026-01-NV008', month: '2026-01', employeeCode: 'NV008', fullName: 'Phan Thị Hải', position: '',
        basicSalary: 5000000, actualWorkDays: 25,
        allowanceMeal: 2000000, allowanceFuel: 1000000, allowancePhone: 1000000, allowanceAttendance: 3000000, totalAllowanceActual: 7000000,
        incomeMentalHealth: 0, incomeOvertime: 0, incomeQuality: 0, incomeSpecial: 0, incomeOfficer: 0, incomeKPI: 0, totalAdditional: 1733333,
        totalActualIncome: 13733333, insuranceCompany: 1075000, insuranceEmployee: 525000, advancePayment: 0, totalIncome: 14808333, netPay: 13208333, department: ''
    },
    {
        userId: '', id: '2026-01-NV009', month: '2026-01', employeeCode: 'NV009', fullName: 'Nguyễn Thị Quỳnh Nga', position: '',
        basicSalary: 5000000, actualWorkDays: 25,
        allowanceMeal: 2000000, allowanceFuel: 0, allowancePhone: 0, allowanceAttendance: 2000000, totalAllowanceActual: 4000000,
        incomeMentalHealth: 0, incomeOvertime: 0, incomeQuality: 0, incomeSpecial: 0, incomeOfficer: 0, incomeKPI: 0, totalAdditional: 1538462,
        totalActualIncome: 10538462, insuranceCompany: 1075000, insuranceEmployee: 525000, advancePayment: 0, totalIncome: 11613462, netPay: 10013462, department: ''
    },
    {
        userId: '', id: '2026-01-NV011', month: '2026-01', employeeCode: 'NV011', fullName: 'Lê Thị Ánh Nguyệt', position: '',
        basicSalary: 5000000, actualWorkDays: 25,
        allowanceMeal: 2000000, allowanceFuel: 1000000, allowancePhone: 1000000, allowanceAttendance: 2000000, totalAllowanceActual: 6000000,
        incomeMentalHealth: 500000, incomeOvertime: 720000, incomeQuality: 700000, incomeSpecial: 0, incomeOfficer: 0, incomeKPI: 0, totalAdditional: 1920000,
        totalActualIncome: 12920000, insuranceCompany: 1075000, insuranceEmployee: 525000, advancePayment: 0, totalIncome: 13995000, netPay: 12395000, department: ''
    },
    {
        userId: '', id: '2026-01-NV012', month: '2026-01', employeeCode: 'NV012', fullName: 'Nguyễn Mạnh Thành', position: '',
        basicSalary: 5000000, actualWorkDays: 25,
        allowanceMeal: 2000000, allowanceFuel: 2000000, allowancePhone: 2000000, allowanceAttendance: 3000000, totalAllowanceActual: 9000000,
        incomeMentalHealth: 500000, incomeOvertime: 420000, incomeQuality: 500000, incomeSpecial: 0, incomeOfficer: 0, incomeKPI: 0, totalAdditional: 1420000,
        totalActualIncome: 15420000, insuranceCompany: 1075000, insuranceEmployee: 525000, advancePayment: 0, totalIncome: 16495000, netPay: 14895000, department: ''
    },
    {
        userId: '', id: '2026-01-NV014', month: '2026-01', employeeCode: 'NV014', fullName: 'Đinh Hoàng Ngọc Hân', position: '',
        basicSalary: 5000000, actualWorkDays: 25,
        allowanceMeal: 2000000, allowanceFuel: 0, allowancePhone: 1000000, allowanceAttendance: 2000000, totalAllowanceActual: 5000000,
        incomeMentalHealth: 500000, incomeOvertime: 990000, incomeQuality: 0, incomeSpecial: 0, incomeOfficer: 0, incomeKPI: 200000, totalAdditional: 1690000,
        totalActualIncome: 11690000, insuranceCompany: 1075000, insuranceEmployee: 525000, advancePayment: 0, totalIncome: 12765000, netPay: 11165000, department: ''
    },
];

const Income = () => {
    const { payrollRecords, addPayrollRecord, updatePayrollRecord, addNotification } = useData();
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [searchTerm, setSearchTerm] = useState('');
    const [zoomLevel, setZoomLevel] = useState(1);

    const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.1, 1.5));
    const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.1, 0.5));

    // Filter Logic
    const filteredRecords = useMemo(() => {
        return payrollRecords.filter(r => {
            const matchesMonth = r.month === selectedMonth;
            const matchesSearch = r.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                r.employeeCode.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesMonth && matchesSearch;
        });
    }, [payrollRecords, selectedMonth, searchTerm]);







    const loadNov2025Data = () => {
        const recordsToLoad = SAMPLE_PAYROLL_RECORDS.map(r => ({
            ...r,
            month: '2025-11',
            id: `2025-11-${r.employeeCode}`, // Unique ID for Nov 2025
            department:
                ['NV002', 'NV004', 'NV005', 'NV006', 'NV017'].includes(r.employeeCode) ? 'Khối Văn Phòng' :
                    ['NV008', 'NV009'].includes(r.employeeCode) ? 'Phát Triển RDI' :
                        ['NV011', 'NV012'].includes(r.employeeCode) ? 'Dự Án' : // Assuming group based on visual separation
                            'Trợ Lý TCT'
        }));

        recordsToLoad.forEach(r => {
            // No need to delete first if we trust setDoc (overwrite)
            addPayrollRecord(r);
        });

        setSelectedMonth('2025-11');
        addNotification({
            id: `LOAD-NOV-${Date.now()}`,
            title: 'Đã nạp dữ liệu T11/2025',
            message: 'Dữ liệu mẫu tháng 11/2025 đã được tải vào hệ thống.',
            type: 'success',
            time: 'Vừa xong',
            read: false
        });
    };



    return (
        <div className="p-6 h-[calc(100vh-80px)] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-2">Bảng Thanh Toán Thu Nhập</h1>
                    <p className="text-slate-400">Quản lý lương, thưởng và phụ cấp nhân sự</p>
                </div>
                <div className="flex gap-3 items-center">
                    <div className="flex items-center bg-[#1e293b] rounded-lg border border-white/10 px-3 py-2 mr-2">
                        <span className="text-slate-400 text-xs mr-2">Tháng:</span>
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="bg-transparent text-white focus:outline-none text-sm"
                        />
                    </div>
                    <button
                        onClick={loadNov2025Data}
                        className="px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-600/50 rounded-lg transition-all font-medium text-sm flex items-center gap-2"
                    >
                        <Upload size={16} /> Bảng lương T11/2025
                    </button>
                </div>
            </div>

            {/* Toolbar */}

            <div className="flex justify-between items-center gap-4 mb-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Tìm theo tên hoặc mã NV..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-[#1e293b] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:ring-1 focus:ring-emerald-500"
                    />
                </div>

                {/* Zoom Controls */}
                <div className="flex items-center gap-2 bg-[#1e293b] rounded-lg border border-white/10 p-1">
                    <button onClick={handleZoomOut} className="p-1.5 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors" title="Thu nhỏ">
                        <ZoomOut size={16} />
                    </button>
                    <span className="text-xs font-mono text-slate-300 min-w-[3rem] text-center">{Math.round(zoomLevel * 100)}%</span>
                    <button onClick={handleZoomIn} className="p-1.5 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors" title="Phóng to">
                        <ZoomIn size={16} />
                    </button>
                </div>
            </div>

            {/* Spreadsheet Table */}
            <div className="flex-1 overflow-auto border border-white/10 rounded-xl bg-[#1e293b]/50 backdrop-blur-sm relative custom-scrollbar">
                <table className="w-full text-xs text-left border-collapse min-w-[2400px]" style={{ zoom: zoomLevel }}>
                    <thead className="sticky top-0 z-20 shadow-md">
                        <tr className="bg-slate-900 text-slate-300 font-bold">
                            <th className="p-3 border border-white/10 sticky left-0 bg-slate-900 z-30" rowSpan={2} style={{ width: 50 }}>STT</th>
                            <th className="p-3 border border-white/10 sticky left-[50px] bg-slate-900 z-30" rowSpan={2} style={{ width: 80 }}>Mã NV</th>
                            <th className="p-3 border border-white/10 sticky left-[130px] bg-slate-900 z-30" rowSpan={2} style={{ width: 180 }}>Họ và tên</th>
                            <th className="p-3 border border-white/10 bg-slate-900" rowSpan={2} style={{ width: 120 }}>Chức vụ</th>
                            <th className="p-3 border border-white/10 text-right bg-slate-900" rowSpan={2} style={{ width: 100 }}>Lương CB</th>
                            <th className="p-3 border border-white/10 text-center bg-slate-900" rowSpan={2} style={{ width: 60 }}>Ngày công</th>
                            <th className="p-2 border border-white/10 text-center bg-slate-800" colSpan={5}>Phụ cấp</th>
                            <th className="p-2 border border-white/10 text-center bg-slate-800" colSpan={7}>Thu nhập tăng thêm</th>
                            <th className="p-3 border border-white/10 text-right bg-emerald-900/40 min-w-[100px]" rowSpan={2}>T.Nhập thực tế</th>
                            <th className="p-2 border border-white/10 text-center bg-slate-800" colSpan={2}>BHXH (21.5% / 10.5%)</th>
                            <th className="p-3 border border-white/10 text-right bg-slate-900" rowSpan={2}>Tạm ứng/Phạt</th>
                            <th className="p-3 border border-white/10 text-right bg-yellow-900/40 font-bold text-yellow-500 min-w-[100px]" rowSpan={2}>Thực lĩnh</th>
                        </tr>
                        <tr className="bg-slate-800 text-slate-400">
                            {/* Allowances Subheaders */}
                            <th className="p-2 border border-white/10 text-right min-w-[100px]">Tiền ăn</th>
                            <th className="p-2 border border-white/10 text-right min-w-[100px]">Xăng xe</th>
                            <th className="p-2 border border-white/10 text-right min-w-[100px]">Điện thoại</th>
                            <th className="p-2 border border-white/10 text-right min-w-[100px]">Chuyên cần</th>
                            <th className="p-2 border border-white/10 text-right min-w-[100px] font-bold text-slate-200">Tổng PC</th>

                            {/* Additional Income Subheaders */}
                            <th className="p-2 border border-white/10 text-right min-w-[100px]">SK Tinh thần</th>
                            <th className="p-2 border border-white/10 text-right min-w-[100px]">Thêm giờ</th>
                            <th className="p-2 border border-white/10 text-right min-w-[100px]">Chất lượng</th>
                            <th className="p-2 border border-white/10 text-right min-w-[100px]">Đặc thù</th>
                            <th className="p-2 border border-white/10 text-right min-w-[100px]">Cán bộ</th>
                            <th className="p-2 border border-white/10 text-right min-w-[100px]">KPI/DS</th>
                            <th className="p-2 border border-white/10 text-right min-w-[100px] font-bold text-slate-200">Tổng tăng</th>

                            {/* Insurance Subheaders */}
                            <th className="p-2 border border-white/10 text-right min-w-[100px]">Công ty</th>
                            <th className="p-2 border border-white/10 text-right min-w-[100px]">NLĐ</th>
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
        </div>
    );
};

const EditableRow: React.FC<{
    record: PayrollRecord;
    idx: number;
    updateRecord: (updater: (prev: PayrollRecord) => PayrollRecord) => void
}> = ({ record, idx, updateRecord }) => {

    // Helper for number inputs
    const NumberCell = ({ value, field, readOnly = false, className = '' }: { value: number, field: keyof PayrollRecord, readOnly?: boolean, className?: string }) => (
        <td className={`p-0 border-r border-white/5 relative group ${className}`}>
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
                        // Note: If Basic Salary implies Pro-rating: val / 26 * actualWorkDays?
                        // For now we assume Basic Salary IS the base component of Actual.
                        next.totalActualIncome = next.basicSalary + next.totalAllowanceActual + next.totalAdditional;

                        // Auto-calc Insurance if not manual override? 
                        // Let's assume Insurance is fixed 21.5% and 10.5% of Basic Salary for now (standard VN)
                        // next.insuranceCompany = next.basicSalary * 0.215;
                        // next.insuranceEmployee = next.basicSalary * 0.105;

                        next.totalIncome = next.totalActualIncome + next.insuranceCompany;
                        next.netPay = next.totalActualIncome - next.insuranceEmployee - next.advancePayment;

                        return next;
                    });
                }}
                className={`w-full h-full bg-transparent px-2 py-3 text-right focus:outline-none focus:bg-indigo-500/20 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${readOnly ? 'cursor-default text-slate-400' : 'text-white hover:bg-white/5'}`}
            />
        </td>
    );

    const format = (num: number) => num ? new Intl.NumberFormat('vi-VN').format(num) : '0';

    return (
        <tr className="hover:bg-white/5 transition-colors border-b border-white/5 font-mono">
            <td className="p-3 border-r border-white/5 sticky left-0 bg-[#0f172a] z-10">{idx + 1}</td>
            <td className="p-3 border-r border-white/5 sticky left-[50px] bg-[#0f172a] z-10 font-bold text-slate-300">{record.employeeCode}</td>
            <td className="p-3 border-r border-white/5 sticky left-[130px] bg-[#0f172a] z-10 text-white truncate max-w-[180px]">{record.fullName}</td>
            <td className="p-3 border-r border-white/5">{record.position}</td>

            <NumberCell value={record.basicSalary} field="basicSalary" />
            <NumberCell value={record.actualWorkDays} field="actualWorkDays" className="text-center" />

            <NumberCell value={record.allowanceMeal} field="allowanceMeal" />
            <NumberCell value={record.allowanceFuel} field="allowanceFuel" />
            <NumberCell value={record.allowancePhone} field="allowancePhone" />
            <NumberCell value={record.allowanceAttendance} field="allowanceAttendance" />
            <td className="p-2 border-r border-white/5 text-right font-bold text-emerald-400 bg-emerald-500/5">{format(record.totalAllowanceActual)}</td>

            <NumberCell value={record.incomeMentalHealth} field="incomeMentalHealth" />
            <NumberCell value={record.incomeOvertime} field="incomeOvertime" />
            <NumberCell value={record.incomeQuality} field="incomeQuality" />
            <NumberCell value={record.incomeSpecial} field="incomeSpecial" />
            <NumberCell value={record.incomeOfficer} field="incomeOfficer" />
            <NumberCell value={record.incomeKPI} field="incomeKPI" />
            <td className="p-2 border-r border-white/5 text-right font-bold text-emerald-400 bg-emerald-500/5">{format(record.totalAdditional)}</td>

            <td className="p-2 border-r border-white/5 text-right font-bold text-white bg-white/5">{format(record.totalActualIncome)}</td>

            <NumberCell value={record.insuranceCompany} field="insuranceCompany" />
            <NumberCell value={record.insuranceEmployee} field="insuranceEmployee" className="text-red-400" />
            <NumberCell value={record.advancePayment} field="advancePayment" />

            <td className="p-3 border-r border-white/5 text-right font-bold text-yellow-400 bg-yellow-500/10 text-lg">
                {format(record.netPay)}
            </td>
        </tr>
    );
};

export default Income;
