import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sun, Moon, Cloud, CloudSun, CloudFog, CloudDrizzle, 
  CloudRain, Snowflake, CloudLightning, Wind, Droplets, 
  Thermometer, MapPin, Search, RefreshCw, X, AlertCircle, Check
} from "lucide-react";

interface WeatherData {
  temp: number;
  apparentTemp: number;
  condition: string;
  code: number;
  humidity: number;
  wind: number;
  isDay: boolean;
  city: string;
}

interface WeatherCardProps {
  theme?: "dark" | "purple" | "blue" | "neon" | "cyberpunk" | "classic";
}

export default function WeatherCard({ theme = "dark" }: WeatherCardProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchingCity, setSearchingCity] = useState<boolean>(false);

  // Default coordinates to Lahore as a secure fallback
  const defaultLat = 31.5204;
  const defaultLon = 74.3587;
  const defaultCity = "Lahore, PK";

  const isCyberpunk = theme === "cyberpunk" || theme === "neon";
  const isClassic = theme === "classic" || theme === "purple" || theme === "blue";

  // Active theme configuration mappings
  const themeStyles = {
    dark: "bg-white/5 border-white/10 text-white hover:border-violet-500/30",
    purple: "bg-purple-950/20 border-purple-800/30 text-purple-200 hover:border-purple-500/30",
    blue: "bg-blue-950/20 border-blue-800/30 text-blue-200 hover:border-blue-500/30",
    neon: "bg-black/80 border-cyan-500/20 text-cyan-400 hover:border-fuchsia-500/40",
    cyberpunk: "bg-neutral-950 border-cyan-500/20 text-cyan-300 hover:border-pink-500/30",
    classic: "bg-neutral-900 border-amber-500/30 text-amber-200 hover:border-amber-400/40",
  };

  const activeStyles = themeStyles[theme] || themeStyles.dark;

  // Weather code visual mapper helper
  const getWeatherDetails = (code: number, isDay: boolean = true) => {
    switch (code) {
      case 0:
        return { 
          desc: isDay ? "Clear Sky" : "Clear Night", 
          icon: isDay ? <Sun className="w-8 h-8 text-amber-400 animate-spin-slow" /> : <Moon className="w-8 h-8 text-sky-200" />, 
          bg: "from-amber-500/10 to-orange-500/5 border-amber-500/20" 
        };
      case 1:
      case 2:
      case 3:
        return { 
          desc: code === 1 ? "Mainly Clear" : code === 2 ? "Partly Cloudy" : "Overcast", 
          icon: <CloudSun className="w-8 h-8 text-blue-300" />, 
          bg: "from-blue-500/10 to-slate-500/5 border-blue-500/20" 
        };
      case 45:
      case 48:
        return { 
          desc: "Foggy Conditions", 
          icon: <CloudFog className="w-8 h-8 text-teal-300" />, 
          bg: "from-teal-500/10 to-zinc-500/5 border-teal-500/20" 
        };
      case 51:
      case 53:
      case 55:
      case 56:
      case 57:
        return { 
          desc: "Drizzling", 
          icon: <CloudDrizzle className="w-8 h-8 text-indigo-300 animate-pulse" />, 
          bg: "from-indigo-500/10 to-blue-500/5 border-indigo-500/20" 
        };
      case 61:
      case 63:
      case 65:
      case 80:
      case 81:
      case 82:
        return { 
          desc: "Rainy", 
          icon: <CloudRain className="w-8 h-8 text-blue-400" />, 
          bg: "from-blue-600/10 to-indigo-600/5 border-blue-600/20" 
        };
      case 66:
      case 67:
        return { 
          desc: "Freezing Rain", 
          icon: <Snowflake className="w-8 h-8 text-cyan-200" />, 
          bg: "from-cyan-500/10 to-blue-500/5 border-cyan-500/20" 
        };
      case 71:
      case 73:
      case 75:
      case 77:
      case 85:
      case 86:
        return { 
          desc: "Snowing", 
          icon: <Snowflake className="w-8 h-8 text-sky-200 animate-pulse" />, 
          bg: "from-sky-400/10 to-indigo-400/5 border-sky-400/20" 
        };
      case 95:
      case 96:
      case 99:
        return { 
          desc: "Thunderstorm", 
          icon: <CloudLightning className="w-8 h-8 text-fuchsia-400" />, 
          bg: "from-purple-600/10 to-pink-500/5 border-purple-600/20" 
        };
      default:
        return { 
          desc: "Unknown Conditions", 
          icon: <Cloud className="w-8 h-8 text-gray-400" />, 
          bg: "from-gray-500/10 to-neutral-500/5 border-gray-500/20" 
        };
    }
  };

  const fetchWeather = async (lat: number, lon: number, locationName: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day&timezone=auto`
      );

      if (!response.ok) {
        throw new Error("Unable to contact Open-Meteo weather servers.");
      }

      const data = await response.json();
      const current = data.current;

      const details = getWeatherDetails(current.weather_code, current.is_day === 1);

      setWeather({
        temp: current.temperature_2m,
        apparentTemp: current.apparent_temperature,
        condition: details.desc,
        code: current.weather_code,
        humidity: current.relative_humidity_2m,
        wind: current.wind_speed_10m,
        isDay: current.is_day === 1,
        city: locationName
      });
    } catch (e: any) {
      console.error("Weather load error:", e);
      setError(e?.message || "Failed to load weather statistics.");
    } finally {
      setLoading(false);
    }
  };

  const getDeviceLocationAndWeather = () => {
    setLoading(true);
    setError(null);

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser device.");
      // Fallback
      fetchWeather(defaultLat, defaultLon, defaultCity);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        
        // Reverse geocoding of browser location to fetch readable city/state name (Free Nominatim Service)
        let resolvedCity = "Device Location";
        try {
          const geoResp = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`
          );
          if (geoResp.ok) {
            const geoData = await geoResp.json();
            resolvedCity = geoData.address.city || geoData.address.town || geoData.address.village || geoData.address.state || "Device Location";
            if (geoData.address.country_code) {
              resolvedCity += `, ${geoData.address.country_code.toUpperCase()}`;
            }
          }
        } catch (e) {
          console.warn("Silent reverse geo-lookup failed, falling back to label:", e);
        }

        fetchWeather(lat, lon, resolvedCity);
      },
      (geoError) => {
        console.warn("Geolocation permission error/timeout:", geoError.message);
        // Fallback to default location
        fetchWeather(defaultLat, defaultLon, defaultCity);
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 600000 }
    );
  };

  const handleCitySearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearchingCity(true);
    try {
      const lookupResp = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchQuery.trim())}&count=1&language=en&format=json`
      );

      if (!lookupResp.ok) throw new Error("Location lookup failed.");

      const lookupData = await lookupResp.json();
      if (!lookupData.results || lookupData.results.length === 0) {
        throw new Error(`No matching location found for "${searchQuery}".`);
      }

      const topResult = lookupData.results[0];
      const matchName = `${topResult.name}, ${topResult.country_code ? topResult.country_code.toUpperCase() : ""}`;
      
      await fetchWeather(topResult.latitude, topResult.longitude, matchName);
      setSearchOpen(false);
      setSearchQuery("");
    } catch (err: any) {
      console.error("City search failure:", err);
      // Give readable feedback on the form and disappear after 3 seconds
      setError(err?.message || "City index lookup failed.");
    } finally {
      setSearchingCity(false);
    }
  };

  useEffect(() => {
    getDeviceLocationAndWeather();
  }, []);

  const details = weather ? getWeatherDetails(weather.code, weather.isDay) : null;

  return (
    <div className={`p-4.5 rounded-2xl border transition-all duration-300 relative overflow-hidden backdrop-blur-xl shrink-0 select-none flex flex-col gap-3 ${activeStyles} ${details ? `bg-gradient-to-br ${details.bg}` : "bg-white/5"}`}>
      
      {/* Upper header section */}
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-1.5 text-white/90">
          <MapPin size={14} className="opacity-70 text-violet-400" />
          <span className="text-xs font-semibold tracking-wide truncate max-w-[150px] font-sans">
            {loading ? "Detecting..." : weather?.city || "Unknown Spot"}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button 
            type="button"
            onClick={() => setSearchOpen(!searchOpen)} 
            className="p-1.5 rounded-md hover:bg-white/5 text-white/50 hover:text-white transition-colors active:scale-95 cursor-pointer"
            title="Search different city"
          >
            <Search size={13} />
          </button>
          <button 
            type="button"
            onClick={getDeviceLocationAndWeather} 
            disabled={loading}
            className={`p-1.5 rounded-md hover:bg-white/5 text-white/50 hover:text-white transition-colors active:scale-95 cursor-pointer ${loading ? "animate-spin" : ""}`}
            title="Refresh weather data"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Slide-out City Search drawer form */}
      <AnimatePresence>
        {searchOpen && (
          <motion.form 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            onSubmit={handleCitySearch}
            className="flex items-center gap-1.5 overflow-hidden border-b border-white/5 pb-2 w-full"
          >
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search global city (e.g. London, Dubai)..."
              disabled={searchingCity}
              className="flex-1 bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-white/30 font-sans focus:outline-none focus:ring-1 focus:ring-violet-500/50"
              autoFocus
            />
            <button 
              type="submit" 
              disabled={searchingCity || !searchQuery.trim()}
              className="p-1.5 bg-violet-600/80 hover:bg-violet-500 text-white rounded-lg active:scale-95 transition-all cursor-pointer disabled:opacity-40"
            >
              {searchingCity ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Main Core Display Section */}
      <div className="flex items-center justify-between min-h-[50px] w-full">
        {loading ? (
          <div className="flex items-center gap-2.5">
            <RefreshCw className="w-5 h-5 text-violet-400 animate-spin" />
            <span className="text-[11px] text-white/50 font-mono uppercase tracking-widest">Hydrating data...</span>
          </div>
        ) : error && !weather ? (
          <div className="flex items-start gap-2.5 text-red-400/90 pr-2">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Telemetry Error</span>
              <span className="text-[10px] opacity-80 leading-snug">{error}</span>
            </div>
          </div>
        ) : weather ? (
          <>
            {/* Condition and Temp */}
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-black/10 flex items-center justify-center border border-white/5">
                {details?.icon}
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-bold tracking-tight text-white leading-none font-sans flex items-start">
                  {Math.round(weather.temp)}
                  <span className="text-sm font-semibold select-none text-white/60 ml-0.5 mt-0.5">°C</span>
                </span>
                <span className="text-[11px] font-medium tracking-wide text-white/70 mt-1 capitalize font-sans">
                  {weather.condition}
                </span>
              </div>
            </div>

            {/* Extra climate metrics */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-right text-[10px] font-mono text-white/50 bg-black/10 px-3 py-2 rounded-xl border border-white/5">
              <div className="flex items-center gap-1 justify-end">
                <Thermometer size={9} className="opacity-50 text-amber-400" />
                <span>Feels: {Math.round(weather.apparentTemp)}°C</span>
              </div>
              <div className="flex items-center gap-1 justify-end">
                <Droplets size={9} className="opacity-50 text-sky-400" />
                <span>Hum: {weather.humidity}%</span>
              </div>
              <div className="flex items-center gap-1 justify-end col-span-2 mt-0.5">
                <Wind size={9} className="opacity-50 text-indigo-400" />
                <span>Wind: {weather.wind} km/h</span>
              </div>
            </div>
          </>
        ) : null}
      </div>

      {/* Tiny banner to toast transient lookup geocode error if current weather is still displayed */}
      {error && weather && (
        <div className="text-[9px] text-red-400/80 font-mono mt-1 text-center bg-red-400/5 py-1 rounded border border-red-500/10">
          Search Error: {error}
        </div>
      )}
    </div>
  );
}
