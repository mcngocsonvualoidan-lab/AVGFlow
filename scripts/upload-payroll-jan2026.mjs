/**
 * Upload Payroll Data - January 2026
 * Data source: Google Sheets "BẢNG THANH TOÁN THU NHẬP - THÁNG 01 NĂM 2026"
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyDfEtxQTXzxq_4P42VLWgoeZViD1C9Xw-E",
    authDomain: "avgflow-dd822.firebaseapp.com",
    projectId: "avgflow-dd822",
    storageBucket: "avgflow-dd822.firebasestorage.app",
    messagingSenderId: "210885567448",
    appId: "1:210885567448:web:c9b7d5a1471ad06565c8ad",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Mapping: employeeCode -> { userId, fullName, position, department }
const employeeMap = {
    'NV002': { userId: '8', fullName: 'Lê Thị Nga', position: 'Chuyên viên Pháp lý', department: 'Khối Văn phòng' },
    'NV004': { userId: '4', fullName: 'Lê Trần Thiện Tâm', position: 'Chuyên viên', department: 'Khối Văn phòng' },
    'NV005': { userId: '6', fullName: 'Nguyễn Ngọc Sơn', position: 'Giám đốc điều hành', department: 'Khối Văn phòng' },
    'NV006': { userId: '7', fullName: 'Hà Ngọc Doanh', position: 'Chuyên viên', department: 'Khối Văn phòng' },
    'NV017': { userId: '2', fullName: 'Trần Hải Lưu', position: 'Chuyên viên Nhân sự', department: 'Khối Văn phòng' },
    'NV011': { userId: '5', fullName: 'Lê Thị Ánh Nguyệt', position: 'Trưởng phòng HC-NS', department: 'Khối Văn phòng' },
    'NV012': { userId: '3', fullName: 'Nguyễn Mạnh Thành', position: 'Trưởng phòng Tài chính', department: 'Khối Văn phòng' },
    'NV014': { userId: '1', fullName: 'Đinh Hoàng Ngọc Hân', position: 'Chuyên viên', department: 'Khối Văn phòng' },
    'NV008': { userId: '10', fullName: 'Phan Thị Hải', position: 'Chuyên viên', department: 'Nghiên cứu phát triển RDI' },
    'NV009': { userId: '9', fullName: 'Nguyễn Thị Quỳnh Nga', position: 'Chuyên viên', department: 'Nghiên cứu phát triển RDI' },
};

// Payroll data for January 2026 from the Google Sheets
// Columns from the sheet (mapped to PayrollRecord fields):
// Col 4: basicSalary (Lương căn bản)
// Col 5: actualWorkDays (Ngày công thực tế) 
// Col 6: allowanceMeal (Phụ cấp ăn trưa)
// Col 7: allowanceFuel (Xăng xe)
// Col 8: allowancePhone (Điện thoại)
// Col 9: allowanceAttendance (Chuyên cần)
// Col 10: totalAllowanceActual (Tổng phụ cấp thực tế)
// Col 10-sub: incomeMentalHealth (Sức khỏe tinh thần) - 500,000
// Col 11: incomeOvertime (OT - Thêm giờ)
// Col 12: incomeQuality (Chất lượng VHKL)
// Col 15: incomeKPI (KPI)
// Col 19: totalAdditional (Tổng thu nhập thêm)
// Col 20: totalActualIncome (Tổng thu nhập thực tế)
// Col 21: insuranceCompany (BHXH Công ty)
// Col 22: insuranceEmployee (BHXH Nhân viên)
// Col 14: advancePayment (Tạm ứng/Phạt)  
// Col 26: totalIncome (Tổng thu nhập)
// Col 28: netPay (Thực lĩnh)

const payrollData = [
    {
        employeeCode: 'NV002',
        basicSalary: 6000000,
        actualWorkDays: 27,
        allowanceMeal: 2000000,
        allowanceFuel: 0,
        allowancePhone: 0,
        allowanceAttendance: 3000000,
        totalAllowanceActual: 5000000,
        incomeMentalHealth: 500000,
        incomeOvertime: 1950000,
        incomeQuality: 540000,
        incomeSpecial: 0,
        incomeOfficer: 0,
        incomeKPI: 2990000,
        totalAdditional: 2990000,
        totalActualIncome: 13990000,
        insuranceCompany: 1290000,
        insuranceEmployee: 630000,
        advancePayment: 0,
        totalIncome: 16717000,
        netPay: 14797000,
    },
    {
        employeeCode: 'NV004',
        basicSalary: 5500000,
        actualWorkDays: 27,
        allowanceMeal: 2000000,
        allowanceFuel: 0,
        allowancePhone: 0,
        allowanceAttendance: 1500000,
        totalAllowanceActual: 3500000,
        incomeMentalHealth: 500000,
        incomeOvertime: 1395000,
        incomeQuality: 420000,
        incomeSpecial: 0,
        incomeOfficer: 0,
        incomeKPI: 2315000,
        totalAdditional: 2315000,
        totalActualIncome: 11315000,
        insuranceCompany: 1182500,
        insuranceEmployee: 577500,
        advancePayment: 0,
        totalIncome: 12497500,
        netPay: 10737500,
    },
    {
        employeeCode: 'NV005',
        basicSalary: 6000000,
        actualWorkDays: 26,
        allowanceMeal: 2000000,
        allowanceFuel: 2000000,
        allowancePhone: 2000000,
        allowanceAttendance: 3000000,
        totalAllowanceActual: 8666667,
        incomeMentalHealth: 500000,
        incomeOvertime: 30000,
        incomeQuality: 0,
        incomeSpecial: 0,
        incomeOfficer: 0,
        incomeKPI: 530000,
        totalAdditional: 530000,
        totalActualIncome: 14974444,
        insuranceCompany: 1290000,
        insuranceEmployee: 630000,
        advancePayment: 15400000,
        totalIncome: 16264444,
        netPay: 14344444,
    },
    {
        employeeCode: 'NV006',
        basicSalary: 5500000,
        actualWorkDays: 24.5,
        allowanceMeal: 2000000,
        allowanceFuel: 0,
        allowancePhone: 1000000,
        allowanceAttendance: 2500000,
        totalAllowanceActual: 4990741,
        incomeMentalHealth: 500000,
        incomeOvertime: 465000,
        incomeQuality: 0,
        incomeSpecial: 0,
        incomeOfficer: 0,
        incomeKPI: 965000,
        totalAdditional: 965000,
        totalActualIncome: 10946481,
        insuranceCompany: 1182500,
        insuranceEmployee: 577500,
        advancePayment: 0,
        totalIncome: 12128981,
        netPay: 10368981,
    },
    {
        employeeCode: 'NV017',
        basicSalary: 5500000,
        actualWorkDays: 27,
        allowanceMeal: 2000000,
        allowanceFuel: 2000000,
        allowancePhone: 1000000,
        allowanceAttendance: 2500000,
        totalAllowanceActual: 7500000,
        incomeMentalHealth: 500000,
        incomeOvertime: 780000,
        incomeQuality: 270000,
        incomeSpecial: 0,
        incomeOfficer: 0,
        incomeKPI: 1550000,
        totalAdditional: 1550000,
        totalActualIncome: 14550000,
        insuranceCompany: 1182500,
        insuranceEmployee: 577500,
        advancePayment: 0,
        totalIncome: 15732500,
        netPay: 13972500,
    },
    {
        employeeCode: 'NV011',
        basicSalary: 5500000,
        actualWorkDays: 26.5,
        allowanceMeal: 2000000,
        allowanceFuel: 1000000,
        allowancePhone: 1000000,
        allowanceAttendance: 2000000,
        totalAllowanceActual: 5888889,
        incomeMentalHealth: 500000,
        incomeOvertime: 1410000,
        incomeQuality: 480000,
        incomeSpecial: 0,
        incomeOfficer: 2000000,
        incomeKPI: 4390000,
        totalAdditional: 4390000,
        totalActualIncome: 15677037,
        insuranceCompany: 1182500,
        insuranceEmployee: 577500,
        advancePayment: 0,
        totalIncome: 16859537,
        netPay: 15099537,
    },
    {
        employeeCode: 'NV012',
        basicSalary: 5500000,
        actualWorkDays: 27,
        allowanceMeal: 2000000,
        allowanceFuel: 2000000,
        allowancePhone: 2000000,
        allowanceAttendance: 3000000,
        totalAllowanceActual: 9000000,
        incomeMentalHealth: 500000,
        incomeOvertime: 930000,
        incomeQuality: 240000,
        incomeSpecial: 0,
        incomeOfficer: 4500000,
        incomeKPI: 6170000,
        totalAdditional: 6170000,
        totalActualIncome: 20670000,
        insuranceCompany: 1182500,
        insuranceEmployee: 577500,
        advancePayment: 15400000,
        totalIncome: 21852500,
        netPay: 20092500,
    },
    {
        employeeCode: 'NV014',
        basicSalary: 5500000,
        actualWorkDays: 27,
        allowanceMeal: 2000000,
        allowanceFuel: 0,
        allowancePhone: 1000000,
        allowanceAttendance: 2000000,
        totalAllowanceActual: 5000000,
        incomeMentalHealth: 500000,
        incomeOvertime: 1620000,
        incomeQuality: 420000,
        incomeSpecial: 0,
        incomeOfficer: 0,
        incomeKPI: 2540000,
        totalAdditional: 2540000,
        totalActualIncome: 13040000,
        insuranceCompany: 1182500,
        insuranceEmployee: 577500,
        advancePayment: 0,
        totalIncome: 17707420,
        netPay: 15947420,
    },
    {
        employeeCode: 'NV008',
        basicSalary: 5500000,
        actualWorkDays: 24,
        allowanceMeal: 2000000,
        allowanceFuel: 1000000,
        allowancePhone: 1000000,
        allowanceAttendance: 3000000,
        totalAllowanceActual: 6222222,
        incomeMentalHealth: 0,
        incomeOvertime: 0,
        incomeQuality: 0,
        incomeSpecial: 0,
        incomeOfficer: 0,
        incomeKPI: 1579487,
        totalAdditional: 1579487,
        totalActualIncome: 12690598,
        insuranceCompany: 1182500,
        insuranceEmployee: 577500,
        advancePayment: 15400000,
        totalIncome: 13873098,
        netPay: 12113098,
    },
    {
        employeeCode: 'NV009',
        basicSalary: 5500000,
        actualWorkDays: 26,
        allowanceMeal: 2000000,
        allowanceFuel: 0,
        allowancePhone: 0,
        allowanceAttendance: 2000000,
        totalAllowanceActual: 3851852,
        incomeMentalHealth: 0,
        incomeOvertime: 0,
        incomeQuality: 0,
        incomeSpecial: 0,
        incomeOfficer: 0,
        incomeKPI: 1474359,
        totalAdditional: 1474359,
        totalActualIncome: 10622507,
        insuranceCompany: 1182500,
        insuranceEmployee: 577500,
        advancePayment: 0,
        totalIncome: 11805007,
        netPay: 10045007,
    },
];

const MONTH = '2026-01';

async function uploadPayroll() {
    console.log(`📊 Uploading payroll data for ${MONTH}...`);
    console.log(`   Total employees: ${payrollData.length}\n`);

    for (const data of payrollData) {
        const emp = employeeMap[data.employeeCode];
        if (!emp) {
            console.warn(`⚠️ Unknown employee code: ${data.employeeCode}, skipping.`);
            continue;
        }

        const recordId = `${MONTH}_${data.employeeCode}`;
        const record = {
            id: recordId,
            month: MONTH,
            userId: emp.userId,
            employeeCode: data.employeeCode,
            fullName: emp.fullName,
            position: emp.position,
            department: emp.department,
            basicSalary: data.basicSalary,
            actualWorkDays: data.actualWorkDays,
            allowanceMeal: data.allowanceMeal,
            allowanceFuel: data.allowanceFuel,
            allowancePhone: data.allowancePhone,
            allowanceAttendance: data.allowanceAttendance,
            totalAllowanceActual: data.totalAllowanceActual,
            incomeMentalHealth: data.incomeMentalHealth,
            incomeOvertime: data.incomeOvertime,
            incomeQuality: data.incomeQuality,
            incomeSpecial: data.incomeSpecial,
            incomeOfficer: data.incomeOfficer,
            incomeKPI: data.incomeKPI,
            totalAdditional: data.totalAdditional,
            totalActualIncome: data.totalActualIncome,
            insuranceCompany: data.insuranceCompany,
            insuranceEmployee: data.insuranceEmployee,
            advancePayment: data.advancePayment,
            totalIncome: data.totalIncome,
            netPay: data.netPay,
        };

        try {
            await setDoc(doc(db, 'payroll', recordId), record);
            console.log(`  ✅ ${emp.fullName} (${data.employeeCode}) — Net: ${data.netPay.toLocaleString('vi-VN')}đ`);
        } catch (err) {
            console.error(`  ❌ Error for ${emp.fullName}:`, err);
        }
    }

    console.log('\n🎉 Upload complete!');
    process.exit(0);
}

uploadPayroll();
