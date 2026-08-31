import React, { useState, useMemo } from 'react';
import { Task, CapacitySettings } from '../types';
import { 
  findAvailableSlotOnDate, 
  AvailableSlotResult, 
  toISODateString, 
  addMinutesToTime, 
  parse12HourToMinutes,
  getDayOfWeekFromDate
} from '../utils/timeUtils';
import { 
  Calendar, 
  Clock, 
  Sparkles, 
  ArrowRight, 
  X, 
  Search, 
  Check, 
  Zap, 
  Layers, 
  AlertCircle,
  TrendingUp,
  RotateCcw
} from 'lucide-react';

interface RescheduleModalProps {
  task: Task;
  allTasks: Task[];
  capacitySettings: CapacitySettings;
  onConfirmReschedule: (task: Task, newDate: string, newStartTime: string, newEndTime: string) => void;
  onClose: () => void;
}

export const RescheduleModal: React.FC<RescheduleModalProps> = ({
  task,
  allTasks,
  capacitySettings,
  onConfirmReschedule,
  onClose
}) => {
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlotResult | null>(null);
  const [customDaysOffset, setCustomDaysOffset] = useState<number>(3);
  const [customDate, setCustomDate] = useState<string>(toISODateString(new Date()));
  const [viewMode, setViewMode] = useState<'presets' | 'scanner' | 'custom'>('presets');

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Helper to compute slot for a specific day offset
  const getSlotForDayOffset = (days: number, fromCurrentTimeOnDay0 = true): AvailableSlotResult | null => {
    const target = new Date();
    target.setDate(target.getDate() + days);
    const dateStr = toISODateString(target);
    const earliestAllowed = (days === 0 && fromCurrentTimeOnDay0) ? currentMinutes + 5 : undefined;

    return findAvailableSlotOnDate(
      dateStr,
      task.appointedMinutes,
      allTasks,
      capacitySettings.dayStartTime,
      capacitySettings.dayEndTime,
      earliestAllowed
    );
  };

  // Preset slots: Today, Tomorrow, +3d, +7d, +10d, +30d, +100d
  const presets = useMemo(() => {
    return [
      { label: 'Next Slot Today', sub: 'Today', days: 0, icon: Zap, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/50' },
      { label: 'Tomorrow Slot', sub: '+1 Day', days: 1, icon: Calendar, color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/50' },
      { label: 'In 3 Days', sub: '+3 Days', days: 3, icon: Sparkles, color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/50' },
      { label: 'In 1 Week', sub: '+7 Days', days: 7, icon: TrendingUp, color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/50' },
      { label: 'In 10 Days', sub: '+10 Days', days: 10, icon: Clock, color: 'text-teal-500 bg-teal-50 dark:bg-teal-950/50' },
      { label: 'In 30 Days', sub: '+30 Days (1 Mo)', days: 30, icon: RotateCcw, color: 'text-rose-500 bg-rose-50 dark:bg-rose-950/50' },
      { label: 'In 100 Days', sub: '+100 Days', days: 100, icon: Layers, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/50' },
    ].map(p => {
      const slot = getSlotForDayOffset(p.days, true);
      return {
        ...p,
        slot
      };
    });
  }, [task.appointedMinutes, allTasks, capacitySettings]);

  // 100-Day Smart Scanner: Scans the next 100 days to find earliest 6 available slots with low load
  const scannedSlots = useMemo(() => {
    const results: AvailableSlotResult[] = [];
    for (let d = 0; d <= 100 && results.length < 6; d++) {
      const slot = getSlotForDayOffset(d, true);
      if (slot) {
        results.push(slot);
      }
    }
    return results;
  }, [task.appointedMinutes, allTasks, capacitySettings]);

  // Custom date slot calculation
  const customSlot = useMemo(() => {
    if (!customDate) return null;
    return findAvailableSlotOnDate(
      customDate,
      task.appointedMinutes,
      allTasks,
      capacitySettings.dayStartTime,
      capacitySettings.dayEndTime
    );
  }, [customDate, task.appointedMinutes, allTasks, capacitySettings]);

  // Initial auto-selection to best immediate slot
  React.useEffect(() => {
    const firstValid = presets.find(p => p.slot !== null)?.slot;
    if (firstValid && !selectedSlot) {
      setSelectedSlot(firstValid);
    }
  }, [presets]);

  const handleApplyReschedule = () => {
    if (!selectedSlot) return;
    onConfirmReschedule(task, selectedSlot.date, selectedSlot.startTime, selectedSlot.endTime);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-theme-card border border-theme-border rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 animate-slide-up max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-start justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-purple-500/20">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-theme-text font-display">
                  Intelligent Slot Finder & Reschedule
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  {task.projectCode}
                </span>
              </div>
              <p className="text-xs text-theme-muted">
                Task: <strong className="text-theme-text font-openSans">{task.title}</strong> ({task.appointedMinutes}m duration)
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-theme-card-hover text-theme-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* View Mode Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-theme-card-hover rounded-xl border border-theme-border text-xs font-bold shrink-0">
          <button
            onClick={() => setViewMode('presets')}
            className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              viewMode === 'presets' 
                ? 'bg-theme-card text-blue-600 dark:text-blue-400 shadow-sm' 
                : 'text-theme-muted hover:text-theme-text'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Quick Horizons (Today, +3, +7, +10, +100d)</span>
          </button>
          <button
            onClick={() => setViewMode('scanner')}
            className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              viewMode === 'scanner' 
                ? 'bg-theme-card text-purple-600 dark:text-purple-400 shadow-sm' 
                : 'text-theme-muted hover:text-theme-text'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>100-Day Smart Scanner</span>
          </button>
          <button
            onClick={() => setViewMode('custom')}
            className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              viewMode === 'custom' 
                ? 'bg-theme-card text-emerald-600 dark:text-emerald-400 shadow-sm' 
                : 'text-theme-muted hover:text-theme-text'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Custom Date Finder</span>
          </button>
        </div>

        {/* Content Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          
          {/* TAB 1: QUICK HORIZON PRESETS */}
          {viewMode === 'presets' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {presets.map((p, idx) => {
                const IconComponent = p.icon;
                const isSelected = selectedSlot?.date === p.slot?.date && selectedSlot?.startTime === p.slot?.startTime;
                const isAvailable = p.slot !== null;

                return (
                  <div
                    key={idx}
                    onClick={() => isAvailable && setSelectedSlot(p.slot)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative ${
                      !isAvailable
                        ? 'opacity-40 bg-theme-card-hover/40 border-dashed border-theme-border cursor-not-allowed'
                        : isSelected
                          ? 'bg-blue-50/90 dark:bg-blue-950/60 border-blue-500 shadow-md ring-2 ring-blue-500/30'
                          : 'bg-theme-card border-theme-border hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${p.color}`}>
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-theme-text">
                            {p.label}
                          </div>
                          <div className="text-[10px] text-theme-muted font-medium">
                            {p.sub}
                          </div>
                        </div>
                      </div>

                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                    </div>

                    {/* Slot Details */}
                    <div className="mt-2.5 pt-2 border-t border-theme-border/60 flex items-center justify-between text-xs font-mono">
                      {isAvailable ? (
                        <>
                          <div className="space-y-0.5">
                            <span className="text-[11px] font-bold text-theme-text block font-sans">
                              {p.slot?.date} ({p.slot?.dayOfWeek.slice(0, 3)})
                            </span>
                            <span className="text-blue-600 dark:text-blue-400 font-bold">
                              {p.slot?.startTime} - {p.slot?.endTime}
                            </span>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-theme-card-hover font-sans text-theme-muted font-semibold">
                            {Math.floor((p.slot?.remainingCapacityMinutes || 0) / 60)}h remaining
                          </span>
                        </>
                      ) : (
                        <span className="text-[11px] text-red-500 font-sans font-semibold">
                          No slot available (Day Full)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 2: 100-DAY SMART SCANNER */}
          {viewMode === 'scanner' && (
            <div className="space-y-2.5">
              <div className="text-xs font-semibold text-theme-muted flex items-center gap-1.5 pb-1">
                <Search className="w-3.5 h-3.5 text-purple-500" />
                <span>Top recommended conflict-free windows across the next 100 days:</span>
              </div>

              <div className="space-y-2">
                {scannedSlots.map((slot, idx) => {
                  const isSelected = selectedSlot?.date === slot.date && selectedSlot?.startTime === slot.startTime;

                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedSlot(slot)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-purple-50/90 dark:bg-purple-950/60 border-purple-500 shadow-md ring-2 ring-purple-500/30'
                          : 'bg-theme-card border-theme-border hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950 flex items-center justify-center text-purple-600 font-bold text-xs font-mono">
                          #{idx + 1}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-theme-text font-display flex items-center gap-1.5">
                            <span>{slot.date}</span>
                            <span className="text-theme-muted font-normal">({slot.dayOfWeek})</span>
                          </div>
                          <div className="text-xs font-mono font-bold text-purple-600 dark:text-purple-400">
                            {slot.startTime} - {slot.endTime} ({task.appointedMinutes}m)
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right hidden sm:block">
                          <div className="text-[10px] text-theme-muted font-medium">Scheduled Load:</div>
                          <div className="text-xs font-mono font-bold text-theme-text">
                            {Math.floor(slot.scheduledMinutesOnDay / 60)}h {slot.scheduledMinutesOnDay % 60}m
                          </div>
                        </div>
                        <div className={`w-6 h-6 rounded-full border flex items-center justify-center ${
                          isSelected ? 'bg-purple-600 border-purple-600 text-white' : 'border-theme-border'
                        }`}>
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: CUSTOM DATE FINDER */}
          {viewMode === 'custom' && (
            <div className="space-y-4 p-4 rounded-2xl bg-theme-card-hover/40 border border-theme-border">
              <div className="space-y-2">
                <label className="text-xs font-bold text-theme-text flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Choose Target Date:</span>
                </label>
                <input
                  type="date"
                  value={customDate}
                  min={toISODateString(new Date())}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-theme-border bg-theme-card text-theme-text text-sm font-semibold focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Custom Slot Calculated Output */}
              {customSlot ? (
                <div 
                  onClick={() => setSelectedSlot(customSlot)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                    selectedSlot?.date === customSlot.date
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 shadow-md ring-2 ring-emerald-500/30'
                      : 'bg-theme-card border-theme-border hover:border-emerald-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5 font-display">
                      <Sparkles className="w-4 h-4 text-emerald-500" />
                      Calculated Earliest Free Slot:
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {customSlot.startTime} - {customSlot.endTime}
                    </span>
                  </div>

                  <div className="text-xs text-theme-text">
                    On <strong>{customSlot.date} ({customSlot.dayOfWeek})</strong> with {Math.floor(customSlot.remainingCapacityMinutes / 60)}h remaining capacity budget.
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-red-50/50 dark:bg-red-950/20 border border-red-300 dark:border-red-800 text-center space-y-1">
                  <div className="text-xs font-bold text-red-600 dark:text-red-400 flex items-center justify-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    <span>No available time slots found on selected date.</span>
                  </div>
                  <p className="text-[11px] text-theme-muted">
                    This day has exceeded working hours capacity or has no continuous {task.appointedMinutes}m open gap.
                  </p>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Selected Slot Summary & Action Footer */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/80 to-purple-50/80 dark:from-blue-950/40 dark:to-purple-950/40 border border-blue-200 dark:border-blue-900/60 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div>
            <div className="text-[11px] font-bold text-theme-muted uppercase tracking-wider">
              Selected Reschedule Target:
            </div>
            {selectedSlot ? (
              <div className="text-sm font-bold text-theme-text font-display flex items-center gap-2">
                <span>{selectedSlot.date} ({selectedSlot.dayOfWeek.slice(0, 3)})</span>
                <span className="text-blue-600 dark:text-blue-400 font-mono font-black">
                  • {selectedSlot.startTime} - {selectedSlot.endTime}
                </span>
              </div>
            ) : (
              <div className="text-xs text-red-500 font-semibold">
                Please choose an available slot
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-theme-border bg-theme-card hover:bg-theme-card-hover text-xs font-bold text-theme-text transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={!selectedSlot}
              onClick={handleApplyReschedule}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-xs font-black shadow-lg shadow-blue-500/25 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Reschedule to this Slot</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
