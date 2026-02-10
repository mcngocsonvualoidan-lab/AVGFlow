/**
 * Weather Service
 * Handles geolocation and weather data fetching
 */

export interface WeatherData {
    location: {
        city: string;
        country: string;
        lat: number;
        lon: number;
    };
    current: {
        temp: number;
        feelsLike: number;
        humidity: number;
        windSpeed: number;
        description: string;
        icon: string;
        pressure: number;
        visibility: number;
    };
    timestamp: number;
}

export interface GeolocationCoords {
    latitude: number;
    longitude: number;
}

/**
 * Get current device location using Geolocation API
 */
export const getCurrentLocation = (): Promise<GeolocationCoords> => {
    console.log('[weatherService] getCurrentLocation called');

    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            const error = 'Geolocation không được hỗ trợ trên thiết bị này';
            console.error('[weatherService]', error);
            reject(new Error(error));
            return;
        }

        console.log('[weatherService] Requesting location permission...');

        navigator.geolocation.getCurrentPosition(
            (position) => {
                console.log('[weatherService] Location obtained:', {
                    lat: position.coords.latitude,
                    lon: position.coords.longitude,
                    accuracy: position.coords.accuracy
                });
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                });
            },
            (error) => {
                console.error('[weatherService] Geolocation error:', error);
                let errorMessage = 'Không thể lấy vị trí';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'Bạn đã từ chối quyền truy cập vị trí. Vui lòng cho phép trong cài đặt trình duyệt.';
                        console.error('[weatherService] PERMISSION_DENIED');
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'Thông tin vị trí không khả dụng. Kiểm tra GPS/Location service.';
                        console.error('[weatherService] POSITION_UNAVAILABLE');
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'Yêu cầu lấy vị trí đã hết thời gian. Vui lòng thử lại.';
                        console.error('[weatherService] TIMEOUT');
                        break;
                    default:
                        console.error('[weatherService] Unknown error code:', error.code);
                }
                reject(new Error(errorMessage));
            },
            {
                enableHighAccuracy: false, // Changed to false for faster response
                timeout: 15000, // Increased to 15 seconds
                maximumAge: 60000 // Cache for 1 minute
            }
        );
    });
};

/**
 * Generate mock weather data for development/fallback
 */
const getMockWeatherData = (lat: number, lon: number): WeatherData => {
    console.log('[weatherService] Using MOCK weather data (API blocked by network)');

    // Determine approximate location based on coordinates
    const isVietnam = lat >= 8 && lat <= 24 && lon >= 102 && lon <= 110;
    const cityName = isVietnam ? 'Hồ Chí Minh' : 'Vị trí hiện tại';

    // Realistic weather data for Vietnam
    const mockData: WeatherData = {
        location: {
            city: cityName,
            country: 'VN',
            lat: lat,
            lon: lon
        },
        current: {
            temp: 28 + Math.floor(Math.random() * 4), // 28-31°C
            feelsLike: 30 + Math.floor(Math.random() * 4), // 30-33°C
            humidity: 65 + Math.floor(Math.random() * 15), // 65-80%
            windSpeed: 5 + Math.floor(Math.random() * 10), // 5-15 km/h
            description: 'Có mây',
            icon: '02d',
            pressure: 1010 + Math.floor(Math.random() * 10), // 1010-1020 hPa
            visibility: 10
        },
        timestamp: Date.now()
    };

    return mockData;
};

/**
 * Fetch weather data from Open-Meteo API (Free, no API key required)
 * Falls back to mock data if network is blocked
 */
export const fetchWeatherData = async (lat: number, lon: number): Promise<WeatherData> => {
    try {
        console.log(`[weatherService] Fetching weather for lat=${lat}, lon=${lon}`);

        // Try to get location name from reverse geocoding (optional - may fail due to CORS)
        let cityName = 'Vị trí hiện tại';
        let countryCode = 'VN';

        try {
            const geocodeUrl = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&count=1`;
            console.log('[weatherService] Attempting geocode:', geocodeUrl);

            const geocodeResponse = await fetch(geocodeUrl, {
                signal: AbortSignal.timeout(5000) // 5 second timeout
            });

            if (geocodeResponse.ok) {
                const geocodeData = await geocodeResponse.json();
                console.log('[weatherService] Geocode data:', geocodeData);

                cityName = geocodeData.results?.[0]?.name || cityName;
                countryCode = geocodeData.results?.[0]?.country_code?.toUpperCase() || countryCode;
            } else {
                console.warn('[weatherService] Geocode failed, using fallback location name');
            }
        } catch (geocodeError) {
            console.warn('[weatherService] Geocoding failed (CORS or network issue), using fallback:', geocodeError);
            // Continue with default location name
        }

        // Get weather data (this is the essential part)
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,surface_pressure&timezone=auto`;
        console.log('[weatherService] Weather URL:', weatherUrl);

        const weatherResponse = await fetch(weatherUrl, {
            signal: AbortSignal.timeout(5000) // 5 second timeout
        });

        if (!weatherResponse.ok) {
            console.error('[weatherService] Weather API error:', weatherResponse.status);
            throw new Error(`Weather API error: ${weatherResponse.status}`);
        }

        const data = await weatherResponse.json();
        console.log('[weatherService] Weather API response:', data);

        const current = data.current;

        if (!current) {
            throw new Error('No current weather data in response');
        }

        // Map WMO Weather codes to descriptions (in Vietnamese)
        const weatherDescriptions: Record<number, { desc: string; icon: string }> = {
            0: { desc: 'Trời quang', icon: '01d' },
            1: { desc: 'Trời ít mây', icon: '02d' },
            2: { desc: 'Có mây', icon: '03d' },
            3: { desc: 'Nhiều mây', icon: '04d' },
            45: { desc: 'Sương mù', icon: '50d' },
            48: { desc: 'Sương mù dày đặc', icon: '50d' },
            51: { desc: 'Mưa phùn nhẹ', icon: '09d' },
            53: { desc: 'Mưa phùn', icon: '09d' },
            55: { desc: 'Mưa phùn dày đặc', icon: '09d' },
            61: { desc: 'Mưa nhỏ', icon: '10d' },
            63: { desc: 'Mưa vừa', icon: '10d' },
            65: { desc: 'Mưa to', icon: '10d' },
            71: { desc: 'Tuyết nhẹ', icon: '13d' },
            73: { desc: 'Tuyết vừa', icon: '13d' },
            75: { desc: 'Tuyết dày', icon: '13d' },
            95: { desc: 'Dông', icon: '11d' },
        };

        const weatherCode = current.weather_code ?? 0;
        const weatherInfo = weatherDescriptions[weatherCode] || { desc: 'Không xác định', icon: '01d' };

        const weatherData: WeatherData = {
            location: {
                city: cityName,
                country: countryCode,
                lat: lat,
                lon: lon
            },
            current: {
                temp: Math.round(current.temperature_2m ?? 0),
                feelsLike: Math.round(current.apparent_temperature ?? current.temperature_2m ?? 0),
                humidity: current.relative_humidity_2m ?? 0,
                windSpeed: Math.round(current.wind_speed_10m ?? 0),
                description: weatherInfo.desc,
                icon: weatherInfo.icon,
                pressure: Math.round(current.surface_pressure ?? 1013),
                visibility: 10 // Default visibility as Open-Meteo doesn't provide this in free tier
            },
            timestamp: Date.now()
        };

        console.log('[weatherService] Final weather data:', weatherData);
        return weatherData;
    } catch (error) {
        console.error('[weatherService] Error fetching weather data:', error);

        // Check if it's a network/CORS/SSL error - use mock data
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (
            errorMessage.includes('Failed to fetch') ||
            errorMessage.includes('CORS') ||
            errorMessage.includes('SSL') ||
            errorMessage.includes('NetworkError') ||
            errorMessage.includes('timeout')
        ) {
            console.warn('[weatherService] 🔥 Network blocked! Using mock data as fallback...');
            return getMockWeatherData(lat, lon);
        }

        // For other errors, rethrow
        throw error;
    }
};

/**
 * Get weather data for current location
 */
export const getWeatherForCurrentLocation = async (): Promise<WeatherData> => {
    const coords = await getCurrentLocation();
    return fetchWeatherData(coords.latitude, coords.longitude);
};

/**
 * Check if weather data is still fresh (less than 30 minutes old)
 */
export const isWeatherDataFresh = (timestamp: number): boolean => {
    const thirtyMinutes = 30 * 60 * 1000;
    return Date.now() - timestamp < thirtyMinutes;
};

/**
 * Get weather icon URL from OpenWeatherMap
 */
export const getWeatherIconUrl = (icon: string): string => {
    return `https://openweathermap.org/img/wn/${icon}@2x.png`;
};
