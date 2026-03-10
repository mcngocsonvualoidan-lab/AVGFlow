import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';
import { useLanguage } from '../../context/LanguageContext';

const formatDate = (date: Date | string, type: 'time-h' | 'time-m' | 'date' | 'full') => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';

    if (type === 'time-h') return d.getHours().toString().padStart(2, '0');
    if (type === 'time-m') return d.getMinutes().toString().padStart(2, '0');
    if (type === 'date') return d.toLocaleDateString('en-GB'); // dd/mm/yyyy
    if (type === 'full') return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '');
    return '';
};

interface GlassDatePickerProps {
    selected?: Date;
    onSelect: (date: Date) => void;
    onClose: () => void;
    onSave?: () => void;
    minDate?: Date;
    errorMessagePrefix?: string;
}

export const GlassDatePicker: React.FC<GlassDatePickerProps> = ({ selected, onSelect, onClose, onSave, minDate, errorMessagePrefix = 'Thời gian' }) => {
    const { t } = useLanguage();

    const effectiveMinDate = minDate || new Date();
    const initialDate = selected && selected > effectiveMinDate ? selected : effectiveMinDate;

    const [viewDate, setViewDate] = useState(initialDate);
    const [time, setTime] = useState({
        h: formatDate(initialDate, 'time-h'),
        m: formatDate(initialDate, 'time-m')
    });
    const [selectingHour, setSelectingHour] = useState(true);
    const [showAnalogClock, setShowAnalogClock] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');

    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    const startDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
    const offset = startDay === 0 ? 6 : startDay - 1;

    const validateDeadline = (date: Date): boolean => {
        if (minDate && date < minDate) {
            setErrorMessage(`${errorMessagePrefix} không hợp lệ`);
            setTimeout(() => setErrorMessage(''), 3000);
            return false;
        }
        setErrorMessage('');
        return true;
    };

    const handleDateClick = (day: number) => {
        const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
        newDate.setHours(parseInt(time.h), parseInt(time.m));

        if (validateDeadline(newDate)) {
            onSelect(newDate);
        }
    };

    const handleTimeChange = (type: 'h' | 'm', val: string) => {
        let numVal = parseInt(val);
        if (isNaN(numVal)) numVal = 0;

        if (type === 'h') {
            if (numVal > 23) numVal = 0;
            if (numVal < 0) numVal = 23;
        }
        if (type === 'm') {
            if (numVal > 59) numVal = 0;
            if (numVal < 0) numVal = 59;
        }

        const cleanVal = numVal.toString().padStart(2, '0');
        const newTime = { ...time, [type]: cleanVal };
        setTime(newTime);

        const testDate = new Date(viewDate);
        testDate.setHours(parseInt(newTime.h), parseInt(newTime.m));

        if (validateDeadline(testDate)) {
            onSelect(testDate);
        }
    };

    const handleClockClick = (value: number) => {
        if (selectingHour) {
            handleTimeChange('h', value.toString());
            setSelectingHour(false);
        } else {
            handleTimeChange('m', value.toString());
        }
    };

    const changeMonth = (delta: number) => {
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + delta, 1));
    };

    const hourAngle = selectingHour
        ? (parseInt(time.h) % 12) * 30 - 90
        : (parseInt(time.m) / 60) * 360 - 90;

    const clockNumbers = selectingHour
        ? Array.from({ length: 24 }, (_, i) => i) // 0-23 for hours
        : [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]; // Minutes in 5-min intervals

    return (
        <div className="p-3 md:p-5 rounded-3xl border border-slate-200/80 dark:border-indigo-500/20 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8)] bg-white/95 dark:bg-slate-950 backdrop-blur-2xl animate-in zoom-in-95 duration-200 relative z-[110]">
            {errorMessage && (
                <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-xl">
                    <p className="text-sm font-semibold text-red-600 dark:text-red-400 text-center">
                        ⚠️ {errorMessage}
                    </p>
                </div>
            )}

            <div className="flex flex-col md:flex-row gap-2 md:gap-5 pb-4 max-h-[85vh] md:max-h-none overflow-y-auto">
                {/* LEFT: Calendar */}
                <div className="w-full md:w-[280px]">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                        <span className="font-bold text-lg text-slate-800 dark:text-white tracking-tight">
                            {t.common.datePicker.months[viewDate.getMonth()]}, {viewDate.getFullYear()}
                        </span>
                        <div className="flex gap-1">
                            <button onClick={(e) => { e.stopPropagation(); changeMonth(-1); }} className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors">
                                <ChevronDown className="rotate-90" size={18} />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); changeMonth(1); }} className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors">
                                <ChevronDown className="-rotate-90" size={18} />
                            </button>
                        </div>
                    </div>


                    {/* Calendar Grid */}
                    <div>
                        <div className="grid grid-cols-7 text-center mb-2">
                            {t.common.datePicker.weekdays.map(d => <span key={d} className="text-[9px] md:text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase">{d}</span>)}
                        </div>
                        <div className="grid grid-cols-7 gap-0.5 md:gap-1">
                            {[...Array(offset)].map((_, i) => <div key={`empty-${i}`} />)}
                            {[...Array(daysInMonth)].map((_, i) => {
                                const d = i + 1;
                                const dateToCheck = new Date(viewDate.getFullYear(), viewDate.getMonth(), d);
                                dateToCheck.setHours(23, 59, 59, 999); // End of day

                                const isSelected = selected &&
                                    selected.getDate() === d &&
                                    selected.getMonth() === viewDate.getMonth() &&
                                    selected.getFullYear() === viewDate.getFullYear();
                                const isToday = new Date().getDate() === d &&
                                    new Date().getMonth() === viewDate.getMonth() &&
                                    new Date().getFullYear() === viewDate.getFullYear();
                                const isPast = minDate ? dateToCheck < minDate : false;

                                return (
                                    <button
                                        key={d}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (!isPast) handleDateClick(d);
                                        }}
                                        disabled={isPast}
                                        className={clsx(
                                            "w-8 h-8 md:w-9 md:h-9 text-sm font-semibold rounded-xl flex items-center justify-center transition-all duration-200",
                                            isPast
                                                ? "text-slate-300 dark:text-slate-700 cursor-not-allowed opacity-50"
                                                : isSelected
                                                    ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/40 scale-105"
                                                    : isToday
                                                        ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-300 dark:ring-indigo-500/30 hover:scale-105"
                                                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 hover:scale-105"
                                        )}
                                    >
                                        {d}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>

                {/* Divider */}
                <div className="hidden md:block w-px bg-slate-200 dark:bg-white/10" />
                <div className="md:hidden w-full h-px bg-slate-200 dark:bg-white/10" />

                {/* RIGHT: Time Picker */}
                <div className="w-full md:w-[260px] flex flex-col min-h-0 md:min-h-[380px] overflow-visible">
                    <div className="flex items-center justify-between mb-1 md:mb-3">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t.common.datePicker.time}</span>
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowAnalogClock(!showAnalogClock); }}
                            className="text-xs font-medium text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        >
                            {showAnalogClock ? 'Bàn phím' : 'Đồng hồ'}
                        </button>
                    </div>

                    {!showAnalogClock ? (
                        /* Digital Time Input */
                        <div className="flex-1 flex items-center justify-center">
                            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-200/80 dark:border-white/5">
                                <div className="flex flex-col items-center gap-1">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleTimeChange('h', (parseInt(time.h) + 1).toString()); }}
                                        className="text-slate-400 hover:text-indigo-500 transition-colors p-1"
                                    >
                                        <ChevronDown className="rotate-180" size={16} />
                                    </button>
                                    <input
                                        type="text"
                                        value={time.h}
                                        onChange={(e) => handleTimeChange('h', e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-16 h-14 bg-white dark:bg-slate-800 rounded-xl text-center text-2xl font-bold text-slate-800 dark:text-white border border-slate-200 dark:border-white/10 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                    />
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleTimeChange('h', (parseInt(time.h) - 1).toString()); }}
                                        className="text-slate-400 hover:text-indigo-500 transition-colors p-1"
                                    >
                                        <ChevronDown size={16} />
                                    </button>
                                </div>

                                <span className="text-3xl font-bold text-slate-400 dark:text-slate-500">:</span>

                                <div className="flex flex-col items-center gap-1">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleTimeChange('m', (parseInt(time.m) + 1).toString()); }}
                                        className="text-slate-400 hover:text-indigo-500 transition-colors p-1"
                                    >
                                        <ChevronDown className="rotate-180" size={16} />
                                    </button>
                                    <input
                                        type="text"
                                        value={time.m}
                                        onChange={(e) => handleTimeChange('m', e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-16 h-14 bg-white dark:bg-slate-800 rounded-xl text-center text-2xl font-bold text-slate-800 dark:text-white border border-slate-200 dark:border-white/10 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                    />
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleTimeChange('m', (parseInt(time.m) - 1).toString()); }}
                                        className="text-slate-400 hover:text-indigo-500 transition-colors p-1"
                                    >
                                        <ChevronDown size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Analog Clock */
                        <div className="flex flex-col items-center flex-1 justify-center pb-1 md:pb-6">
                            {/* Time Display */}
                            <div className="flex items-center justify-center gap-1 mb-1 md:mb-3">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setSelectingHour(true); }}
                                    className={clsx(
                                        "px-3 py-1.5 rounded-xl text-2xl font-bold transition-all",
                                        selectingHour
                                            ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400"
                                            : "text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"
                                    )}
                                >
                                    {time.h}
                                </button>
                                <span className="text-2xl font-bold text-slate-300 dark:text-slate-600">:</span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setSelectingHour(false); }}
                                    className={clsx(
                                        "px-3 py-1.5 rounded-xl text-2xl font-bold transition-all",
                                        !selectingHour
                                            ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400"
                                            : "text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"
                                    )}
                                >
                                    {time.m}
                                </button>
                            </div>

                            {/* Clock Face */}
                            <div className="relative w-40 h-40 md:w-48 md:h-48 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 shadow-inner border border-slate-200/50 dark:border-white/10">
                                {/* Clock center dot */}
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-indigo-500 rounded-full z-20 shadow-lg shadow-indigo-500/50" />

                                {/* Clock hand */}
                                <div
                                    className="absolute top-1/2 left-1/2 origin-left h-1 bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full z-10 transition-transform duration-300"
                                    style={{
                                        width: selectingHour && parseInt(time.h) >= 12 ? (typeof window !== 'undefined' && window.innerWidth < 768 ? '36px' : '50px') : (typeof window !== 'undefined' && window.innerWidth < 768 ? '66px' : '78px'),
                                        transform: `translateY(-50%) rotate(${hourAngle}deg)`
                                    }}
                                />

                                {/* Clock numbers */}
                                {clockNumbers.map((num, i) => {
                                    const angle = selectingHour
                                        ? (num < 12 ? num * 30 : (num - 12) * 30) - 90
                                        : (i * 30) - 90;
                                    const isInner = selectingHour && num >= 12;
                                    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
                                    const center = isMobile ? 80 : 96;
                                    const radius = isInner ? (isMobile ? 36 : 50) : (isMobile ? 66 : 78);
                                    const x = Math.cos((angle * Math.PI) / 180) * radius + center;
                                    const y = Math.sin((angle * Math.PI) / 180) * radius + center;
                                    const isActive = selectingHour
                                        ? parseInt(time.h) === num
                                        : parseInt(time.m) === num;

                                    return (
                                        <button
                                            key={num}
                                            onClick={(e) => { e.stopPropagation(); handleClockClick(num); }}
                                            className={clsx(
                                                "absolute flex items-center justify-center rounded-full transition-all duration-200 font-semibold z-20",
                                                isActive
                                                    ? "w-7 h-7 md:w-8 md:h-8 -ml-3.5 md:-ml-4 -mt-3.5 md:-mt-4 bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/40 scale-110"
                                                    : isInner
                                                        ? "w-5 h-5 md:w-6 md:h-6 -ml-2.5 md:-ml-3 -mt-2.5 md:-mt-3 text-slate-400 dark:text-slate-500 text-[9px] md:text-[10px] hover:bg-slate-200 dark:hover:bg-white/10"
                                                        : "w-6 h-6 md:w-7 md:h-7 -ml-3 md:-ml-3.5 -mt-3 md:-mt-3.5 text-slate-600 dark:text-slate-300 text-[11px] md:text-xs hover:bg-slate-200 dark:hover:bg-white/10"
                                            )}
                                            style={{ left: x, top: y }}
                                        >
                                            {num}
                                        </button>
                                    );
                                })}
                            </div>

                            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                                {selectingHour ? 'Chọn giờ' : 'Chọn phút'}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex gap-3 mt-2 md:mt-5 pt-2 md:pt-4 border-t border-slate-200/80 dark:border-white/5">
                <button
                    onClick={(e) => { e.stopPropagation(); onClose(); }}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-semibold text-sm transition-all"
                >
                    Huỷ
                </button>
                <button
                    onClick={(e) => { 
                        e.stopPropagation(); 
                        if (onSave) {
                            onSave();
                        } else {
                            onClose(); 
                        }
                    }}
                    className="flex-1 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl font-semibold text-sm shadow-lg shadow-indigo-500/30 transition-all hover:scale-[1.02]"
                >
                    {t.common.datePicker.done}
                </button>
            </div>
        </div>
    )
}
