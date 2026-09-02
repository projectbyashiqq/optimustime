import React, { useState, useRef, useEffect } from 'react';
import { Clock, Check, Sun, Moon, ChevronUp, ChevronDown, Sparkles } from 'lucide-react';
import { formatMinutesTo12Hour, parse12HourToMinutes } from '../utils/timeUtils';

interface TimePickerProps {
  value: string; // e.g. "09:30 AM"
  onChange: (timeStr: string) => void;
  label?: string;
  className?: string;
  disabled?: boolean;
}

export const TimePicker: React.FC<TimePickerProps> = ({
  value,
  onChange,
  label,
  className = '',
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse incoming value "09:30 AM"
  const parseCurrentValue = () => {
    const isNowPm = new Date().getHours() >= 12;
    const defaultTime = isNowPm ? '02:00 PM' : '09:00 AM';
    const cleaned = (value || defaultTime).trim().toUpperCase();
    const match = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
    if (match) {
      return {
        hours: parseInt(match[1], 10),
        minutes: parseInt(match[2], 10),
        period: match[3] as 'AM' | 'PM'
      };
    }
    return { hours: isNowPm ? 2 : 9, minutes: 0, period: (isNowPm ? 'PM' : 'AM') as 'AM' | 'PM' };
  };

  const parsed = parseCurrentValue();
  const [selectedHours, setSelectedHours] = useState(parsed.hours);
  const [selectedMinutes, setSelectedMinutes] = useState(parsed.minutes);
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>(parsed.period);

  useEffect(() => {
    const p = parseCurrentValue();
    setSelectedHours(p.hours);
    setSelectedMinutes(p.minutes);
    setSelectedPeriod(p.period);
  }, [value]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const emitTimeChange = (h: number, m: number, p: 'AM' | 'PM') => {
    const paddedH = h.toString().padStart(2, '0');
    const paddedM = m.toString().padStart(2, '0');
    const formatted = `${paddedH}:${paddedM} ${p}`;
    onChange(formatted);
  };

  const handleHourSelect = (h: number) => {
    setSelectedHours(h);
    emitTimeChange(h, selectedMinutes, selectedPeriod);
  };

  const handleMinuteSelect = (m: number) => {
    setSelectedMinutes(m);
    emitTimeChange(selectedHours, m, selectedPeriod);
  };

  const handlePeriodSelect = (p: 'AM' | 'PM') => {
    setSelectedPeriod(p);
    emitTimeChange(selectedHours, selectedMinutes, p);
  };

  const handleSetCurrentTime = () => {
    const now = new Date();
    let h = now.getHours();
    const m = Math.round(now.getMinutes() / 5) * 5 % 60;
    const p = h >= 12 ? 'PM' : 'AM';
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;

    setSelectedHours(h);
    setSelectedMinutes(m);
    setSelectedPeriod(p);
    emitTimeChange(h, m, p);
  };

  const handleAdjustMinutes = (delta: number) => {
    const currentMin = parse12HourToMinutes(value);
    const newTotal = ((currentMin + delta) % 1440 + 1440) % 1440;
    const newFormatted = formatMinutesTo12Hour(newTotal);
    onChange(newFormatted);
  };

  const hoursList = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const minuteList = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="text-[11px] font-bold text-theme-text flex items-center gap-1 mb-1">
          <Clock className="w-3.5 h-3.5 text-blue-500" />
          {label}
        </label>
      )}

      {/* Clickable Time Input Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-xs px-3 py-2 rounded-xl bg-theme-card border border-theme-border text-theme-text hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono font-bold flex items-center justify-between gap-2 shadow-sm transition-all text-left cursor-pointer"
      >
        <span className="text-xs sm:text-sm tracking-wide text-blue-600 dark:text-blue-400 whitespace-nowrap">
          {value || (new Date().getHours() >= 12 ? '02:00 PM' : '09:00 AM')}
        </span>
        <Clock className="w-4 h-4 text-theme-muted shrink-0" />
      </button>

      {/* Interactive Clock Popover Modal */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 z-50 w-72 glass-panel rounded-2xl p-4 shadow-2xl border border-blue-200 dark:border-blue-800 animate-slide-up space-y-4">
          
          {/* Digital Time Header + AM/PM Toggle */}
          <div className="flex items-center justify-between bg-blue-50/70 dark:bg-blue-950/40 p-3 rounded-xl border border-blue-200 dark:border-blue-900">
            <div className="font-mono text-2xl font-black tracking-wider text-blue-700 dark:text-blue-300">
              {selectedHours.toString().padStart(2, '0')} : {selectedMinutes.toString().padStart(2, '0')}
            </div>

            {/* Clickable AM / PM Switcher */}
            <div className="flex items-center p-1 bg-theme-card rounded-xl border border-theme-border shadow-inner">
              <button
                type="button"
                onClick={() => handlePeriodSelect('AM')}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1 ${
                  selectedPeriod === 'AM'
                    ? 'bg-amber-500 text-white shadow-md'
                    : 'text-theme-muted hover:text-theme-text'
                }`}
              >
                <Sun className="w-3 h-3" />
                <span>AM</span>
              </button>

              <button
                type="button"
                onClick={() => handlePeriodSelect('PM')}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1 ${
                  selectedPeriod === 'PM'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-theme-muted hover:text-theme-text'
                }`}
              >
                <Moon className="w-3 h-3" />
                <span>PM</span>
              </button>
            </div>
          </div>

          {/* Hours Grid */}
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-theme-muted uppercase tracking-wider">
              Select Hour
            </div>
            <div className="grid grid-cols-6 gap-1">
              {hoursList.map((h) => {
                const isSelected = selectedHours === h;
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => handleHourSelect(h)}
                    className={`py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-md scale-105'
                        : 'bg-theme-card-hover text-theme-text hover:bg-theme-border'
                    }`}
                  >
                    {h}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Minutes Grid */}
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-theme-muted uppercase tracking-wider">
              Select Minute (5m intervals)
            </div>
            <div className="grid grid-cols-6 gap-1">
              {minuteList.map((m) => {
                const isSelected = selectedMinutes === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleMinuteSelect(m)}
                    className={`py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-md scale-105'
                        : 'bg-theme-card-hover text-theme-text hover:bg-theme-border'
                    }`}
                  >
                    {m.toString().padStart(2, '0')}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Presets & Done */}
          <div className="flex items-center justify-between pt-2 border-t border-theme-border text-xs">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleSetCurrentTime}
                className="px-2 py-1 rounded-lg bg-theme-card-hover hover:bg-theme-border text-theme-muted text-[11px] font-semibold"
              >
                Now
              </button>
              <button
                type="button"
                onClick={() => handleAdjustMinutes(15)}
                className="px-2 py-1 rounded-lg bg-theme-card-hover hover:bg-theme-border text-theme-muted text-[11px] font-semibold"
              >
                +15m
              </button>
              <button
                type="button"
                onClick={() => handleAdjustMinutes(30)}
                className="px-2 py-1 rounded-lg bg-theme-card-hover hover:bg-theme-border text-theme-muted text-[11px] font-semibold"
              >
                +30m
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 shadow-sm"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Done</span>
            </button>
          </div>

        </div>
      )}
    </div>
  );
};
