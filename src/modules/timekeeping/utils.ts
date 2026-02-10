import { getLunarDate } from '@dqcai/vn-lunar';

export const HOLIDAYS_2026 = [
    { date: '2026-01-01', name: 'Tết Dương lịch' },
    { date: '2026-02-14', name: 'Nghỉ Tết (27/12 ÂL)' }, // Sat - 27 Tet
    // 2026-02-15 is Sunday - regular weekend, not holiday (28/12 ÂL)
    { date: '2026-02-16', name: 'Giao thừa (29/12 ÂL)' }, // Mon - New Year's Eve (no 30th this year!)
    { date: '2026-02-17', name: 'Mùng 1 Tết (1/1 ÂL)' }, // Tue - Lunar New Year Day 1
    { date: '2026-02-18', name: 'Mùng 2 Tết (2/1 ÂL)' }, // Wed - Day 2
    { date: '2026-02-19', name: 'Mùng 3 Tết (3/1 ÂL)' }, // Thu - Day 3
    { date: '2026-02-20', name: 'Mùng 4 Tết (4/1 ÂL)' }, // Fri - Day 4
    { date: '2026-02-21', name: 'Mùng 5 Tết (5/1 ÂL)' }, // Sat - Day 5
    // 2026-02-22 is Sunday - regular weekend, not holiday (6/1 ÂL)
    { date: '2026-04-27', name: 'Giỗ Tổ Hùng Vương (10/3 ÂL)' },
    { date: '2026-04-30', name: 'Giải phóng miền Nam' },
    { date: '2026-05-01', name: 'Quốc tế Lao động' },
    { date: '2026-09-02', name: 'Quốc khánh' },
    { date: '2026-09-03', name: 'Nghỉ liền kề Quốc khánh' },
];

export const formatDateISO = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const getMonthDays = (month: number, year: number) => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const days = [];
    for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(year, month - 1, i);
        const dateStr = formatDateISO(date); // YYYY-MM-DD

        // Find holiday
        const holiday = HOLIDAYS_2026.find(h => h.date === dateStr);

        // Lunar Date
        const lunar = getLunarDate(i, month, year);

        days.push({
            date: dateStr,
            day: i,
            weekday: date.getDay(), // 0 = Sun
            isWeekend: date.getDay() === 0, // Sunday
            holiday: holiday ? holiday.name : null,
            lunarDay: lunar.day,
            lunarMonth: lunar.month
        });
    }
    return days;
};

export const calculateWorkingDays = (month: number, year: number) => {
    const days = getMonthDays(month, year);
    // Count days that are NOT Sunday and NOT Holiday
    return days.filter(d => !d.isWeekend && !d.holiday).length;
};
