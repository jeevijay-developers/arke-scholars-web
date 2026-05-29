import { useState } from "react";
import { MapPin } from "lucide-react";
import { CITY_DATA, getCitySuggestions } from "@/lib/cityData";

type Props = {
  city: string;
  state: string;
  country: string;
  onCityChange: (city: string) => void;
  onStateChange: (state: string) => void;
  onCountryChange: (country: string) => void;
  disabled?: boolean;
  inputClassName?: string;
  labelClassName?: string;
};

const defaultInput = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-60";
const defaultLabel = "text-[10px] font-bold text-muted-foreground uppercase tracking-wider";

const CityStateFields = ({
  city,
  state,
  country,
  onCityChange,
  onStateChange,
  onCountryChange,
  disabled,
  inputClassName = defaultInput,
  labelClassName = defaultLabel,
}: Props) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const handleCityChange = (val: string) => {
    onCityChange(val);
    onStateChange("");
    const hits = getCitySuggestions(val);
    setSuggestions(hits);
    setShowDropdown(hits.length > 0 && val.length > 0);
  };

  const selectSuggestion = (key: string) => {
    const [dispCity, dispState, dispCountry] = CITY_DATA[key];
    onCityChange(dispCity);
    onStateChange(dispState);
    onCountryChange(dispCountry);
    setSuggestions([]);
    setShowDropdown(false);
  };

  return (
    <>
      {/* City + State row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClassName}>City</label>
          <div className="relative mt-1">
            <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={city}
              onChange={(e) => handleCityChange(e.target.value)}
              onFocus={() => {
                const hits = getCitySuggestions(city);
                setSuggestions(hits);
                if (hits.length > 0 && city.length > 0) setShowDropdown(true);
              }}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              disabled={disabled}
              placeholder="City"
              className={inputClassName}
              style={{ paddingLeft: '2.25rem' }}
            />
            {showDropdown && (
              <div className="absolute z-30 w-full mt-1 rounded-lg border border-border bg-card shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                {suggestions.slice(0, 7).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); selectSuggestion(key); }}
                    className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                  >
                    {CITY_DATA[key][0]}
                    <span className="ml-1.5 text-xs text-muted-foreground">{CITY_DATA[key][1]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div>
          <label className={labelClassName}>State</label>
          <input
            type="text"
            value={state}
            onChange={(e) => onStateChange(e.target.value)}
            disabled={disabled}
            placeholder="State"
            className={`mt-1 ${inputClassName}`}
          />
        </div>
      </div>

      {/* Country */}
      <div>
        <label className={labelClassName}>Country</label>
        <input
          type="text"
          value={country}
          onChange={(e) => onCountryChange(e.target.value)}
          disabled={disabled}
          placeholder="Country"
          className={`mt-1 ${inputClassName}`}
        />
      </div>
    </>
  );
};

export default CityStateFields;
