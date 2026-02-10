import { useEffect, useState } from 'react';
import { Cloud, CloudRain, CloudSnow, Sun, CloudDrizzle, Wind, Droplets, Eye, Gauge } from 'lucide-react';
import { getWeatherForCurrentLocation, WeatherData, isWeatherDataFresh } from '../services/weatherService';
import clsx from 'clsx';

const WeatherWidget = () => {
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [permissionDenied, setPermissionDenied] = useState(false);
    const [debugInfo, setDebugInfo] = useState<string>('');

    const fetchWeather = async () => {
        try {
            console.log('[WeatherWidget] Fetching weather data...');
            setDebugInfo('Đang lấy dữ liệu...');
            setError(null);
            setPermissionDenied(false);
            setLoading(true);

            const data = await getWeatherForCurrentLocation();
            console.log('[WeatherWidget] Weather data received:', data);

            if (!data || !data.current) {
                throw new Error('Invalid weather data received');
            }

            setWeather(data);
            setDebugInfo('Thành công!');
            setLoading(false);
        } catch (err) {
            console.error('[WeatherWidget] Error fetching weather:', err);
            const errorMessage = err instanceof Error ? err.message : 'Không thể lấy thông tin thời tiết';
            setError(errorMessage);
            setDebugInfo(`Lỗi: ${errorMessage}`);
            setLoading(false);

            // Check for permission error
            if (errorMessage.includes('từ chối') || errorMessage.includes('PERMISSION_DENIED') || errorMessage.includes('denied')) {
                setPermissionDenied(true);
            }
        }
    };

    useEffect(() => {
        // Initial fetch
        console.log('[WeatherWidget] Component mounted, starting fetch...');
        fetchWeather();

        // Auto-refresh every 30 minutes
        const interval = setInterval(() => {
            if (weather && !isWeatherDataFresh(weather.timestamp)) {
                console.log('[WeatherWidget] Auto-refreshing weather data...');
                fetchWeather();
            }
        }, 30 * 60 * 1000); // 30 minutes

        return () => {
            console.log('[WeatherWidget] Component unmounting, clearing interval');
            clearInterval(interval);
        };
    }, []); // Empty dependency array - only run on mount

    // Get weather icon component based on condition
    const getWeatherIcon = (icon: string) => {
        const code = icon.substring(0, 2);
        const size = 32;

        switch (code) {
            case '01': return <Sun size={size} className="text-yellow-400" />;
            case '02': case '03': case '04': return <Cloud size={size} className="text-slate-400" />;
            case '09': return <CloudDrizzle size={size} className="text-blue-400" />;
            case '10': return <CloudRain size={size} className="text-blue-500" />;
            case '13': return <CloudSnow size={size} className="text-blue-200" />;
            case '11': return <CloudRain size={size} className="text-purple-500" />;
            default: return <Sun size={size} className="text-yellow-400" />;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center gap-3 px-4 py-2 bg-white/40 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-white/10">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 animate-pulse" />
                <div className="space-y-1">
                    <div className="h-4 w-24 bg-white/50 dark:bg-white/10 rounded animate-pulse" />
                    <div className="h-3 w-32 bg-white/30 dark:bg-white/5 rounded animate-pulse" />
                </div>
            </div>
        );
    }

    if (error || permissionDenied) {
        return (
            <div className="px-4 py-2 bg-white/40 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-white/10">
                <div className="flex items-center gap-2">
                    <Cloud size={20} className="text-slate-400" />
                    <div className="flex-1">
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {permissionDenied ? '🔒 Cần quyền vị trí' : '⚠️ Không có dữ liệu'}
                        </p>
                        <div className="flex gap-2 items-center mt-0.5">
                            <button
                                onClick={fetchWeather}
                                className="text-[10px] text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 font-medium underline"
                            >
                                🔄 Thử lại
                            </button>
                            {import.meta.env.DEV && debugInfo && (
                                <span className="text-[9px] text-slate-500 dark:text-slate-400" title={debugInfo}>
                                    {debugInfo.substring(0, 20)}...
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!weather || !weather.current) {
        console.log('[WeatherWidget] No weather data, showing fallback');
        return (
            <div className="px-4 py-2 bg-white/40 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-white/10">
                <div className="flex items-center gap-2">
                    <Cloud size={20} className="text-slate-400" />
                    <div>
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Đang tải...
                        </p>
                        <button
                            onClick={fetchWeather}
                            className="text-[10px] text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 font-medium mt-0.5 underline"
                        >
                            Thử lại
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const { location, current } = weather;

    return (
        <div className="group relative">
            {/* Compact View */}
            <div className={clsx(
                "flex items-center gap-3 px-4 py-2",
                "bg-white/40 dark:bg-white/5 backdrop-blur-xl",
                "rounded-2xl border border-white/60 dark:border-white/10",
                "hover:bg-white/60 dark:hover:bg-white/10",
                "transition-all duration-300 cursor-pointer"
            )}>
                {/* Weather Icon */}
                {getWeatherIcon(current.icon)}

                {/* Weather Info */}
                <div className="flex flex-col">
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-bold text-slate-800 dark:text-white">
                            {current.temp}°
                        </span>
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                            {location.city}
                        </span>
                    </div>
                    <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-tight">
                        {current.description}
                    </p>
                </div>
            </div>

            {/* Expanded View on Hover */}
            <div className={clsx(
                "absolute top-full right-0 mt-2 w-64",
                "bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl",
                "rounded-2xl border border-white/60 dark:border-white/20",
                "shadow-2xl overflow-hidden",
                "opacity-0 invisible group-hover:opacity-100 group-hover:visible",
                "transition-all duration-300 transform",
                "group-hover:translate-y-0 translate-y-2",
                "z-50"
            )}>
                {/* Header */}
                <div className="p-4 bg-gradient-to-br from-blue-500/20 to-purple-500/20 dark:from-blue-500/10 dark:to-purple-500/10">
                    <div className="flex items-center justify-between mb-2">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                                {location.city}
                            </h3>
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                                {location.country}
                            </p>
                        </div>
                        {getWeatherIcon(current.icon)}
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold text-slate-800 dark:text-white">
                            {current.temp}°
                        </span>
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                            Cảm giác {current.feelsLike}°
                        </span>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                        {current.description}
                    </p>
                </div>

                {/* Weather Stats */}
                <div className="p-4 grid grid-cols-2 gap-3">
                    {/* Humidity */}
                    <div className="flex items-center gap-2">
                        <Droplets size={16} className="text-blue-500" />
                        <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Độ ẩm</p>
                            <p className="text-sm font-semibold text-slate-800 dark:text-white">
                                {current.humidity}%
                            </p>
                        </div>
                    </div>

                    {/* Wind Speed */}
                    <div className="flex items-center gap-2">
                        <Wind size={16} className="text-slate-500" />
                        <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Gió</p>
                            <p className="text-sm font-semibold text-slate-800 dark:text-white">
                                {current.windSpeed} km/h
                            </p>
                        </div>
                    </div>

                    {/* Pressure */}
                    <div className="flex items-center gap-2">
                        <Gauge size={16} className="text-purple-500" />
                        <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Áp suất</p>
                            <p className="text-sm font-semibold text-slate-800 dark:text-white">
                                {current.pressure} hPa
                            </p>
                        </div>
                    </div>

                    {/* Visibility */}
                    <div className="flex items-center gap-2">
                        <Eye size={16} className="text-green-500" />
                        <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Tầm nhìn</p>
                            <p className="text-sm font-semibold text-slate-800 dark:text-white">
                                {current.visibility} km
                            </p>
                        </div>
                    </div>
                </div>

                {/* Location Coordinates */}
                <div className="px-4 pb-4">
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center">
                        📍 {location.lat.toFixed(4)}, {location.lon.toFixed(4)}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default WeatherWidget;
