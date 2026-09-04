/**
 * Time utility functions for OptimusTime Time-Boxing and Automation Engines
 */

import { Task, BufferStatusNote, CapacitySettings, DaySlice24, DayBreakdown24Metrics, SignalNoiseType, NamedTimePeriod, TimePeriodSettings } from '../types';
import { detectSignalVsNoise } from './signalNoiseUtils';

export const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Generate collision-resistant unique project code
export function generateProjectCode(prefix = 'OPT'): string {
  const now = new Date();
  const yearShort = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${yearShort}${month}-${randomPart}`;
}

// Convert "09:30 AM", "2:15 PM", "12:pm", "12:00 Am", "14:30", "09:30:00 AM", etc. to minutes from midnight (0..1439)
// In Bangladesh timing:
// - 12:00 AM / 12:am / 12am -> 0 minutes (Midnight, Night, begins new date)
// - 12:00 PM / 12:pm / 12pm -> 720 minutes (Noon, Midday, Day time)
export function parse12HourToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const cleaned = timeStr.trim().toUpperCase();

  // 1. Flexible 12-hour: supports "12:00 AM", "12:00 PM", "12:pm", "12:am", "12pm", "12am", "12 PM", "12 AM", "12.00 PM", "12:00:00 AM", etc.
  const match12 = cleaned.match(/^(\d{1,2})(?:[:.](\d{1,2}))?(?:[:.]\d{1,2})?\s*:?\s*(AM|PM)$/);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = match12[2] ? parseInt(match12[2], 10) : 0;
    const period = match12[3];

    if (period === 'AM') {
      if (hours === 12) hours = 0; // 12:00 AM is 00:00 (Midnight, Night, New date)
    } else if (period === 'PM') {
      if (hours !== 12) hours += 12; // 12:00 PM remains 12:00 (720 min, Day time)
    }
    return ((hours * 60 + minutes) % 1440 + 1440) % 1440;
  }

  // 2. 24-hour military/ISO: "14:30", "09:00", "12:00", "00:00", "24:00", "23:59:00"
  const match24 = cleaned.match(/^(\d{1,2}):(\d{2})/);
  if (match24) {
    let hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);
    if (hours === 24) hours = 0;
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return ((hours * 60 + minutes) % 1440 + 1440) % 1440;
    }
  }

  return 0;
}

// Convert minutes from midnight (0..1439) to "09:30 AM"
export function formatMinutesTo12Hour(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  let hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const period = hours >= 12 ? 'PM' : 'AM';

  if (hours === 0) {
    hours = 12;
  } else if (hours > 12) {
    hours -= 12;
  }

  const paddedHours = hours.toString().padStart(2, '0');
  const paddedMinutes = minutes.toString().padStart(2, '0');
  return `${paddedHours}:${paddedMinutes} ${period}`;
}

// Convert minute count into human readable duration string (e.g. "2h 15m", "45m", "15h")
export function formatDurationHuman(mins: number): string {
  const cleanMins = Math.round(mins);
  const h = Math.floor(cleanMins / 60);
  const m = cleanMins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

// Add minutes to a 12-hour AM/PM string
export function addMinutesToTime(timeStr: string, minutesToAdd: number): string {
  const currentMin = parse12HourToMinutes(timeStr);
  return formatMinutesTo12Hour(currentMin + minutesToAdd);
}

export const BANGLADESH_TIMEZONE = 'Asia/Dhaka';

export type CircadianPeriodName = 'Night' | 'Morning' | 'Afternoon' | 'Evening';

/**
 * Resolves standard circadian period according to Bangladesh timing understanding:
 * - 12:00 AM (0 min) up to 04:59 AM (299 min): 'Night' (Deep Night & Rest, starts the new calendar date)
 * - 05:00 AM (300 min) up to 11:59 AM (719 min): 'Morning' (Dawn to Midday)
 * - 12:00 PM (720 min) up to 04:59 PM (1019 min): 'Afternoon' (Day time & Nutrition/Work)
 * - 05:00 PM (1020 min) up to 07:59 PM (1199 min): 'Evening' (Dusk & Wind-Down)
 * - 08:00 PM (1200 min) up to 11:59 PM (1439 min): 'Night' (Evening to Midnight)
 */
export function getStandardCircadianPeriod(minutesOrTimeStr: number | string): CircadianPeriodName {
  const mins = typeof minutesOrTimeStr === 'string'
    ? parse12HourToMinutes(minutesOrTimeStr)
    : ((minutesOrTimeStr % 1440) + 1440) % 1440;

  if (mins < 300) return 'Night';       // 12:00 AM - 04:59 AM: Night (New calendar date!)
  if (mins < 720) return 'Morning';     // 05:00 AM - 11:59 AM: Morning
  if (mins < 1020) return 'Afternoon';  // 12:00 PM - 04:59 PM: Afternoon (Day time!)
  if (mins < 1200) return 'Evening';    // 05:00 PM - 07:59 PM: Evening
  return 'Night';                       // 08:00 PM - 11:59 PM: Night
}

/**
 * Returns a Date object strictly adjusted to Bangladesh Standard Time (BST, Asia/Dhaka, UTC+6).
 * Ensures uniform Bangladesh Time precision irrespective of host OS or browser timezone settings.
 */
export function getBangladeshNow(date: Date = new Date()): Date {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: BANGLADESH_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '0';

  const year = parseInt(getPart('year'), 10);
  const month = parseInt(getPart('month'), 10) - 1;
  const day = parseInt(getPart('day'), 10);
  let hour = parseInt(getPart('hour'), 10);
  if (hour === 24) hour = 0;
  const minute = parseInt(getPart('minute'), 10);
  const second = parseInt(getPart('second'), 10);

  return new Date(year, month, day, hour, minute, second);
}

/**
 * Formats time components in Bangladesh Standard Time (BST).
 * Accurately recognizes 12:00 AM as Night (starts new date) and 12:00 PM as Day time.
 */
export function formatBangladeshTime(date: Date = new Date()): {
  hoursMinutes: string;
  seconds: string;
  period: 'AM' | 'PM';
  timeClean: string;
  full12Hour: string;
  circadianPeriod: CircadianPeriodName;
  isNight: boolean;
  isDay: boolean;
} {
  const bdNow = getBangladeshNow(date);
  const hours = bdNow.getHours();
  const minutes = bdNow.getMinutes().toString().padStart(2, '0');
  const seconds = bdNow.getSeconds().toString().padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = (hours % 12 || 12).toString().padStart(2, '0');
  const full12Hour = `${displayHours}:${minutes} ${period}`;
  const circadianPeriod = getStandardCircadianPeriod(hours * 60 + bdNow.getMinutes());
  const isNight = circadianPeriod === 'Night';
  const isDay = !isNight;

  return {
    hoursMinutes: full12Hour,
    seconds,
    period,
    timeClean: `${displayHours}:${minutes}`,
    full12Hour,
    circadianPeriod,
    isNight,
    isDay
  };
}

// Get current Bangladesh local time in 12-hour AM/PM format, rounded to nearest step (default: 15 minutes)
export function getCurrentRoundedTime12Hour(stepMinutes = 15): string {
  const now = getBangladeshNow();
  const totalMinutes = now.getHours() * 60 + now.getMinutes();
  const rounded = Math.ceil(totalMinutes / stepMinutes) * stepMinutes;
  return formatMinutesTo12Hour(rounded % 1440);
}

// Calculate difference in minutes between two 12-hour strings
export function diffTimeInMinutes(startTimeStr: string, endTimeStr: string): number {
  const start = parse12HourToMinutes(startTimeStr);
  let end = parse12HourToMinutes(endTimeStr);
  if (end < start) {
    // Crosses midnight
    end += 1440;
  }
  return end - start;
}

// Format date into standard display format e.g. "01 Jan 2026 (Monday)"
export function formatHeaderDate(date: Date = new Date()): string {
  const day = date.getDate().toString().padStart(2, '0');
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  const dayName = DAYS_OF_WEEK[date.getDay()];

  return `${day} ${month} ${year} (${dayName})`;
}

// Master Date Formatter: Always formats to "01 Jan 2026"
export function formatDisplayDate(dateInput: string | Date | undefined | null, includeDayName = false): string {
  if (!dateInput) return '';
  let d: Date;
  if (typeof dateInput === 'string') {
    if (dateInput.includes('T')) {
      d = new Date(dateInput);
    } else {
      const parts = dateInput.split('-').map(Number);
      if (parts.length === 3) {
        d = new Date(parts[0], parts[1] - 1, parts[2]);
      } else {
        d = new Date(dateInput);
      }
    }
  } else {
    d = dateInput;
  }
  if (isNaN(d.getTime())) return String(dateInput);
  const day = d.getDate().toString().padStart(2, '0');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[d.getMonth()];
  const year = d.getFullYear();
  const dateStr = `${day} ${month} ${year}`;
  if (includeDayName) {
    const dayName = DAYS_OF_WEEK[d.getDay()];
    return `${dateStr} (${dayName})`;
  }
  return dateStr;
}

// Format date to YYYY-MM-DD anchored in Bangladesh Standard Time by default
export function toISODateString(date?: Date): string {
  const target = date ? date : getBangladeshNow();
  const year = target.getFullYear();
  const month = (target.getMonth() + 1).toString().padStart(2, '0');
  const day = target.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns today's date (YYYY-MM-DD) strictly in Bangladesh Standard Time (BST, UTC+6).
 * At 12:00 AM midnight in Bangladesh, this immediately rolls over to the new date!
 */
export function getBangladeshTodayStr(): string {
  const bd = getBangladeshNow();
  const year = bd.getFullYear();
  const month = (bd.getMonth() + 1).toString().padStart(2, '0');
  const day = bd.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Get Day of Week from YYYY-MM-DD
export function getDayOfWeekFromDate(dateStr: string): string {
  if (!dateStr) return DAYS_OF_WEEK[new Date().getDay()];
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3) return DAYS_OF_WEEK[new Date().getDay()];
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return DAYS_OF_WEEK[d.getDay()];
}

// Check if two time ranges overlap
export function checkOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const s1 = parse12HourToMinutes(start1);
  let e1 = parse12HourToMinutes(end1);
  const s2 = parse12HourToMinutes(start2);
  let e2 = parse12HourToMinutes(end2);

  if (e1 <= s1) e1 += 1440;
  if (e2 <= s2) e2 += 1440;

  return Math.max(s1, s2) < Math.min(e1, e2);
}

/**
 * Detects all active tasks that overlap in time or are explicitly linked simultaneously with the given task on the same date.
 */
export function findSimultaneousTasks<T extends { id: string; taskDate: string; startTime: string; endTime: string; status: string; simultaneousWithIds?: string[]; recurrence?: string; selectedDays?: string[] }>(
  targetTask: T,
  allTasks: T[]
): T[] {
  if (!targetTask.startTime || !targetTask.endTime || targetTask.startTime === 'All Day') return [];
  return allTasks.filter(other => {
    if (other.id === targetTask.id) return false;
    if (other.status === 'Terminated' || other.status === 'Done') return false;
    if (other.startTime === 'All Day' || !other.startTime || !other.endTime) return false;

    // Check if both occur on the same target date (considering recurrence or same taskDate)
    const onSameDate = other.taskDate === targetTask.taskDate || isTaskScheduledForDate(other, targetTask.taskDate);
    if (!onSameDate) return false;

    // Check explicit simultaneous link
    const isExplicitlyLinked = !!((targetTask.simultaneousWithIds && targetTask.simultaneousWithIds.includes(other.id)) ||
      (other.simultaneousWithIds && other.simultaneousWithIds.includes(targetTask.id)));
    if (isExplicitlyLinked) return true;

    // Check time window overlap
    return checkOverlap(targetTask.startTime, targetTask.endTime, other.startTime, other.endTime);
  });
}

export interface TimeGap {
  startTime: string;
  endTime: string;
  durationMinutes: number;
  isSimultaneousSlot?: boolean;
  simultaneousTaskTitle?: string;
  simultaneousTaskId?: string;
}

// Find empty gaps between scheduled tasks, post-task buffers, and logged buffer notes for a day
export function findScheduleGaps(
  tasks: Array<{ startTime: string; endTime: string; status: string; bufferMinutes?: number; simultaneousWithIds?: string[]; title?: string; id?: string }>,
  dayStartTime = '06:00 AM',
  dayEndTime = '11:00 PM',
  bufferNotes: Array<{ startTime: string; endTime: string; date?: string }> = [],
  defaultBuffer = 15,
  sleepStartTime?: string,
  sleepEndTime?: string
): TimeGap[] {
  const dayStartMin = parse12HourToMinutes(dayStartTime);
  let dayEndMin = parse12HourToMinutes(dayEndTime);
  if (dayEndMin <= dayStartMin) dayEndMin += 1440;

  const activeTasks = tasks.filter(t => 
    t.status !== 'Terminated' && 
    t.status !== 'Reschedule' && 
    t.startTime && 
    t.endTime && 
    t.startTime !== 'All Day'
  );
  
  // Combine task intervals (including task + bufferMinutes) and logged bufferNotes intervals
  const taskIntervals: { start: number; end: number }[] = [];
  const simultaneousGaps: TimeGap[] = [];

  for (const t of activeTasks as Array<{ startTime: string; endTime: string; status: string; bufferMinutes?: number; actualEndTime?: string; completedBeforeTimeOccurred?: boolean; totalActualMinutes?: number; simultaneousWithIds?: string[]; title?: string; id?: string }>) {
    // If task was completed before its scheduled window even occurred:
    // The scheduled slot is NOT occupied by work—the entire scheduled slot is FREE TIME!
    if (t.status === 'Done' && t.completedBeforeTimeOccurred) {
      continue;
    }

    let s = parse12HourToMinutes(t.startTime);
    let e = parse12HourToMinutes(t.endTime);

    // Simultaneous tasks allow parallel concurrent work!
    // They DO NOT block the calendar, and are considered as available free slots with a marked sign.
    const isSimul = Boolean((t as any).isSimultaneous || (t.simultaneousWithIds && t.simultaneousWithIds.length > 0));
    if (isSimul) {
      if (e < s) e += 1440;
      if (dayEndMin > 1440 && s < dayStartMin) {
        s += 1440;
        e += 1440;
      }
      simultaneousGaps.push({
        startTime: t.startTime,
        endTime: t.endTime,
        durationMinutes: Math.max(0, e - s),
        isSimultaneousSlot: true,
        simultaneousTaskTitle: t.title,
        simultaneousTaskId: t.id
      });
      continue;
    }

    // If task is Done and finished early, only occupy up to its actual completion time + buffer!
    // The rest of its scheduled window is freed up as FREE TIME!
    if (t.status === 'Done') {
      if (t.actualEndTime) {
        const aEnd = parse12HourToMinutes(t.actualEndTime);
        if (aEnd <= s) {
          // Completed before the scheduled start time! That entire scheduled window is completely free!
          continue;
        }
        if (aEnd > s && aEnd < e) {
          e = aEnd;
        }
      } else if (t.totalActualMinutes && t.totalActualMinutes > 0 && t.totalActualMinutes < (e - s)) {
        e = s + t.totalActualMinutes;
      }
    }

    if (e < s) e += 1440;
    // If day spans cross midnight (e.g. 06:00 AM to 02:00 AM), late-night tasks starting after midnight belong to next 24h phase
    if (dayEndMin > 1440 && s < dayStartMin) {
      s += 1440;
      e += 1440;
    }
    const buf = t.bufferMinutes !== undefined ? t.bufferMinutes : defaultBuffer;
    taskIntervals.push({ start: s, end: e + buf });
  }

  const bufferIntervals = (bufferNotes || []).map(b => {
    let s = parse12HourToMinutes(b.startTime);
    let e = parse12HourToMinutes(b.endTime);
    if (e < s) e += 1440;
    if (dayEndMin > 1440 && s < dayStartMin) {
      s += 1440;
      e += 1440;
    }
    return { start: s, end: e };
  });

  // Block out sleep window intervals so that no work gaps are suggested during sleep
  const sleepIntervals: { start: number; end: number }[] = [];
  if (sleepStartTime && sleepEndTime) {
    const sStart = parse12HourToMinutes(sleepStartTime);
    const sEnd = parse12HourToMinutes(sleepEndTime);
    if (sStart < sEnd) {
      // Sleep entirely within same day (e.g. 02:15 AM to 09:00 AM)
      sleepIntervals.push({ start: sStart, end: sEnd });
    } else if (sStart > sEnd) {
      // Sleep spans across midnight (e.g. 11:00 PM to 06:00 AM)
      sleepIntervals.push({ start: sStart, end: 1440 });
      sleepIntervals.push({ start: 0, end: sEnd });
      if (dayEndMin > 1440) {
        sleepIntervals.push({ start: sStart + 1440, end: 2880 });
      }
    }
  }

  const intervals = [...taskIntervals, ...bufferIntervals, ...sleepIntervals].sort((a, b) => a.start - b.start);

  if (intervals.length === 0) {
    if (dayEndMin > dayStartMin) {
      return [{
        startTime: dayStartTime,
        endTime: dayEndTime,
        durationMinutes: dayEndMin - dayStartMin
      }];
    }
    return [];
  }

  // Merge overlapping intervals
  const merged: { start: number; end: number }[] = [];
  for (const interval of intervals) {
    if (merged.length === 0) {
      merged.push({ ...interval });
    } else {
      const last = merged[merged.length - 1];
      if (interval.start <= last.end) {
        last.end = Math.max(last.end, interval.end);
      } else {
        merged.push({ ...interval });
      }
    }
  }

  const gaps: TimeGap[] = [];
  let cursor = dayStartMin;

  for (const block of merged) {
    if (block.start > cursor) {
      const gapStart = Math.max(cursor, dayStartMin);
      const gapEnd = Math.min(block.start, dayEndMin);
      const gapDuration = gapEnd - gapStart;
      if (gapDuration >= 5) { // Highlight gaps >= 5 mins
        gaps.push({
          startTime: formatMinutesTo12Hour(gapStart),
          endTime: formatMinutesTo12Hour(gapEnd),
          durationMinutes: gapDuration
        });
      }
    }
    cursor = Math.max(cursor, block.end);
  }

  if (cursor < dayEndMin) {
    const gapDuration = dayEndMin - cursor;
    if (gapDuration >= 5) {
      gaps.push({
        startTime: formatMinutesTo12Hour(cursor),
        endTime: formatMinutesTo12Hour(dayEndMin),
        durationMinutes: gapDuration
      });
    }
  }

  if (simultaneousGaps.length > 0) {
    gaps.push(...simultaneousGaps);
    gaps.sort((a, b) => {
      let aStart = parse12HourToMinutes(a.startTime);
      let bStart = parse12HourToMinutes(b.startTime);
      if (dayEndMin > 1440 && aStart < dayStartMin) aStart += 1440;
      if (dayEndMin > 1440 && bStart < dayStartMin) bStart += 1440;
      return aStart - bStart;
    });
  }

  return gaps;
}

// Sound Synthesizer via Web Audio API (clean chimes without needing audio assets)
export function playNotificationChime(type: 'success' | 'alert' | 'timer' = 'alert') {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (type === 'success') {
      // Pleasant rising triad chime
      [523.25, 659.25, 783.99].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.1);
        osc.stop(ctx.currentTime + i * 0.1 + 0.5);
      });
    } else if (type === 'alert') {
      // Gentle warning double ding
      [880, 880].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.18);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.18);
        osc.stop(ctx.currentTime + i * 0.18 + 0.35);
      });
    } else if (type === 'timer') {
      // Stopwatch completion bell
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.4); // A5
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 1.2);
    }
  } catch (e) {
    console.warn('Audio chime playback omitted or unsupported:', e);
  }
}

/**
 * Evaluates whether a task occurs on a specific target date string (YYYY-MM-DD),
 * considering its Recurrence rule:
 * - 'None': Matches exact taskDate
 * - 'Daily': Matches any targetDate >= taskDate
 * - 'Selected Days': Matches if targetDate >= taskDate AND day of week is in selectedDays (e.g. ['Mon', 'Wed', 'Fri'])
 * - 'Weekly': Matches if targetDate >= taskDate AND day of week matches taskDate's day of week
 * - 'Monthly': Matches if targetDate >= taskDate AND day of month matches taskDate's day of month
 * - 'Yearly': Matches if targetDate >= taskDate AND month & day match taskDate's month & day
 */
/**
 * Calculates the exact FIRST valid scheduled date for a recurring task.
 * - If recurrence is 'None', returns the base date (e.g. today or user-selected date).
 * - If today matches the recurrence pattern (e.g. today is Sunday for 'Selected Days' [Sun, Wed], or 'Daily'):
 *   - Checks if startTime is strictly later than the current time today.
 *   - If startTime is later than current time today, returns today!
 *   - If startTime has already passed today, returns the NEXT matching occurrence (e.g. next Wednesday or tomorrow).
 */
export function calculateFirstRecurringDate(params: {
  recurrence?: string;
  selectedDays?: string[];
  startTime?: string;
  baseDate?: string;
  referenceNow?: Date;
}): string {
  const { recurrence, selectedDays = [], baseDate } = params;
  const now = params.referenceNow || new Date();
  const todayStr = toISODateString(now);

  // If baseDate is provided and on/after today, anchor to baseDate; otherwise anchor to today
  const startFromDateStr = baseDate && baseDate >= todayStr ? baseDate : todayStr;

  if (!recurrence || recurrence === 'None') {
    return startFromDateStr;
  }

  const [y, m, d] = startFromDateStr.split('-').map(Number);

  // Helper to test if a Date matches the recurrence pattern
  const matchesPattern = (dateObj: Date): boolean => {
    const dayShort = SHORT_DAYS[dateObj.getDay()];
    const dayFull = DAYS_OF_WEEK[dateObj.getDay()];

    if (recurrence === 'Daily') {
      return true;
    }

    if (recurrence === 'Selected Days') {
      if (!selectedDays || selectedDays.length === 0) return false;
      return selectedDays.some(sd => {
        const lower = sd.trim().toLowerCase();
        return lower === dayShort.toLowerCase() ||
               lower === dayFull.toLowerCase() ||
               lower.startsWith(dayShort.toLowerCase());
      });
    }

    if (recurrence === 'Weekly') {
      const sourceDate = new Date(y, m - 1, d);
      return dateObj.getDay() === sourceDate.getDay();
    }

    if (recurrence === 'Monthly') {
      return dateObj.getDate() === d;
    }

    if (recurrence === 'Yearly') {
      return dateObj.getMonth() === (m - 1) && dateObj.getDate() === d;
    }

    return false;
  };

  // Check if startFromDateStr itself matches the pattern (e.g. today or chosen future date)
  const baseObj = new Date(y, m - 1, d);
  if (matchesPattern(baseObj)) {
    return startFromDateStr;
  }

  // Otherwise scan up to 400 days into the future to find the first valid match
  for (let offset = 1; offset <= 400; offset++) {
    const candidate = new Date(y, m - 1, d + offset);
    if (matchesPattern(candidate)) {
      return toISODateString(candidate);
    }
  }

  return startFromDateStr;
}

/**
 * Checks if a task interval crosses midnight (e.g. 11:00 PM to 01:00 AM).
 */
export function taskCrossesMidnight(startTime?: string, endTime?: string): boolean {
  if (!startTime || !endTime || startTime === 'All Day' || endTime === 'All Day') return false;
  const s = parse12HourToMinutes(startTime);
  const e = parse12HourToMinutes(endTime);
  return e < s;
}

/**
 * Calculates the calendar end date for a task. If it crosses midnight, returns next day (YYYY-MM-DD).
 */
export function getTaskEndDate(taskDate: string, startTime?: string, endTime?: string): string {
  if (!taskDate) return '';
  if (taskCrossesMidnight(startTime, endTime)) {
    const [y, m, d] = taskDate.split('-').map(Number);
    const nextDay = new Date(y, m - 1, d + 1);
    return toISODateString(nextDay);
  }
  return taskDate;
}

/**
 * For a task that crosses midnight, gets its effective sub-interval for a specific calendar date.
 * E.g. For a 11:00 PM - 01:00 AM task:
 * - On taskDate (Day 1): startTime = "11:00 PM", endTime = "01:00 AM", isContinuation = false
 * - On endDate (Day 2): startTime = "12:00 AM", endTime = "01:00 AM", isContinuation = true
 */
export function getTaskIntervalForDate(
  task: { 
    taskDate: string; 
    startTime?: string; 
    endTime?: string; 
    crossesMidnight?: boolean; 
    endDate?: string;
    recurrence?: string;
    selectedDays?: string[];
    excludedDates?: string[];
  },
  targetDateStr: string
): { startTime: string; endTime: string; isContinuation: boolean; durationMinutes: number } {
  const s = task.startTime || '09:00 AM';
  const e = task.endTime || '10:00 AM';
  const crosses = task.crossesMidnight ?? taskCrossesMidnight(s, e);

  if (!crosses) {
    const sMin = parse12HourToMinutes(s);
    let eMin = parse12HourToMinutes(e);
    if (eMin < sMin) eMin += 1440;
    return {
      startTime: s,
      endTime: e,
      isContinuation: false,
      durationMinutes: eMin - sMin
    };
  }

  const effectiveEndDate = task.endDate || getTaskEndDate(task.taskDate, s, e);

  // Check if targetDateStr is Day 2 (Continuation day)
  const [ty, tm, td] = targetDateStr.split('-').map(Number);
  const yesterdayDate = new Date(ty, tm - 1, td - 1);
  const yesterdayStr = toISODateString(yesterdayDate);

  const isContinuationDay = 
    (targetDateStr === effectiveEndDate && targetDateStr !== task.taskDate) ||
    task.taskDate === yesterdayStr ||
    (task.recurrence && task.recurrence !== 'None' && isTaskScheduledForDate({ ...task, crossesMidnight: false }, yesterdayStr));

  if (isContinuationDay && targetDateStr !== task.taskDate) {
    const eMin = parse12HourToMinutes(e);
    return {
      startTime: '12:00 AM',
      endTime: e,
      isContinuation: true,
      durationMinutes: eMin
    };
  }

  // Otherwise targetDate is Day 1 (the start day, e.g. Friday)
  const sMin = parse12HourToMinutes(s);
  return {
    startTime: s,
    endTime: e,
    isContinuation: false,
    durationMinutes: 1440 - sMin
  };
}

export function isTaskScheduledForDate(task: {
  taskDate: string;
  startTime?: string;
  endTime?: string;
  endDate?: string;
  crossesMidnight?: boolean;
  recurrence?: string;
  selectedDays?: string[];
  excludedDates?: string[];
}, targetDateStr: string): boolean {
  if (!task.taskDate || !targetDateStr) return false;

  // Check if this date is explicitly excluded / deleted for this recurring series
  if (task.excludedDates && task.excludedDates.includes(targetDateStr)) {
    return false;
  }

  const recurrence = task.recurrence || 'None';

  // Check midnight crossing continuity: Does this task start on targetDateStr, or continue into targetDateStr?
  const crosses = task.crossesMidnight ?? (task.startTime && task.endTime ? taskCrossesMidnight(task.startTime, task.endTime) : false);
  const effectiveEndDate = task.endDate || (crosses && task.startTime && task.endTime ? getTaskEndDate(task.taskDate, task.startTime, task.endTime) : task.taskDate);
  const isStartDate = task.taskDate === targetDateStr;
  const isEndDate = crosses && effectiveEndDate === targetDateStr;

  // If NOT recurring: strict date match on start date OR continuation end date
  if (recurrence === 'None') {
    return isStartDate || isEndDate;
  }

  // A recurring task only applies on or after its first scheduled taskDate (anchor start date)
  if (targetDateStr < task.taskDate) return false;

  if (recurrence === 'Daily') {
    return true;
  }

  const [tYear, tMonth, tDay] = targetDateStr.split('-').map(Number);
  const targetDateObj = new Date(tYear, tMonth - 1, tDay);
  const targetDayShort = SHORT_DAYS[targetDateObj.getDay()]; // e.g. "Mon"
  const targetDayFull = DAYS_OF_WEEK[targetDateObj.getDay()]; // e.g. "Monday"

  if (recurrence === 'Selected Days') {
    if (!task.selectedDays || task.selectedDays.length === 0) return false;
    const matchesToday = task.selectedDays.some(d => {
      const lower = d.trim().toLowerCase();
      return lower === targetDayShort.toLowerCase() ||
             lower === targetDayFull.toLowerCase() ||
             lower.startsWith(targetDayShort.toLowerCase());
    });
    if (matchesToday) return true;

    // If task crosses midnight, check if yesterday was a matching selected day
    if (crosses) {
      const yesterdayObj = new Date(tYear, tMonth - 1, tDay - 1);
      const yestDayShort = SHORT_DAYS[yesterdayObj.getDay()];
      const yestDayFull = DAYS_OF_WEEK[yesterdayObj.getDay()];
      return task.selectedDays.some(d => {
        const lower = d.trim().toLowerCase();
        return lower === yestDayShort.toLowerCase() ||
               lower === yestDayFull.toLowerCase() ||
               lower.startsWith(yestDayShort.toLowerCase());
      });
    }
    return false;
  }

  const [sYear, sMonth, sDay] = task.taskDate.split('-').map(Number);
  const sourceDateObj = new Date(sYear, sMonth - 1, sDay);

  if (recurrence === 'Weekly') {
    if (targetDateObj.getDay() === sourceDateObj.getDay()) return true;
    if (crosses) {
      const yesterdayObj = new Date(tYear, tMonth - 1, tDay - 1);
      if (yesterdayObj.getDay() === sourceDateObj.getDay()) return true;
    }
    return false;
  }

  if (recurrence === 'Monthly') {
    if (tDay === sDay) return true;
    if (crosses) {
      const yesterdayObj = new Date(tYear, tMonth - 1, tDay - 1);
      if (yesterdayObj.getDate() === sDay) return true;
    }
    return false;
  }

  if (recurrence === 'Yearly') {
    if (tMonth === sMonth && tDay === sDay) return true;
    if (crosses) {
      const yesterdayObj = new Date(tYear, tMonth - 1, tDay - 1);
      if (yesterdayObj.getMonth() === sMonth && yesterdayObj.getDate() === sDay) return true;
    }
    return false;
  }

  return false;
}

/**
 * Calculates the next occurrence ISO date string for a recurring task after `fromDateStr`.
 */
export function getNextRecurrenceDate(task: {
  taskDate: string;
  recurrence?: string;
  selectedDays?: string[];
  excludedDates?: string[];
}, fromDateStr: string): string {
  const recurrence = task.recurrence || 'None';
  if (recurrence === 'None') return fromDateStr;

  const [year, month, day] = fromDateStr.split('-').map(Number);

  if (recurrence === 'Daily') {
    const nextDate = new Date(year, month - 1, day + 1);
    return toISODateString(nextDate);
  }

  // For Selected Days, Weekly, Monthly, Yearly:
  // Scan forward up to 400 days to find the next scheduled occurrence
  for (let offset = 1; offset <= 400; offset++) {
    const nextDate = new Date(year, month - 1, day + offset);
    const nextDateStr = toISODateString(nextDate);
    if (isTaskScheduledForDate(task, nextDateStr)) {
      return nextDateStr;
    }
  }

  const fallback = new Date(year, month - 1, day + 1);
  return toISODateString(fallback);
}

export interface AvailableSlotResult {
  date: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  scheduledMinutesOnDay: number;
  remainingCapacityMinutes: number;
  isRedLine: boolean;
  period?: CircadianPeriodName;
  reason?: string;
  isSimultaneousSlot?: boolean;
  simultaneousTaskTitle?: string;
  crossesMidnight?: boolean;
  endDate?: string;
  isAfterMidnight?: boolean;
}

export interface CurrentTaskSlotInfo {
  date: string;
  startTime: string;
  endTime?: string;
  id?: string;
  simultaneousWithIds?: string[];
}

/**
 * Finds MULTIPLE conflict-free available slots on a target date, strictly within waking hours [dayStartTime, dayEndTime],
 * completely avoiding sleep time, respecting existing tasks + buffers.
 * ONLY Free Time Zones and Simultaneous Tasks Zones are available.
 */
export function findAllAvailableSlotsOnDate(
  dateStr: string,
  durationMinutes: number,
  allTasks: Array<{ taskDate: string; startTime: string; endTime: string; bufferMinutes?: number; status: string; recurrence?: string; selectedDays?: string[]; id?: string; title?: string; simultaneousWithIds?: string[] }>,
  dayStartTime = '06:00 AM',
  dayEndTime = '11:00 PM',
  earliestAllowedMinutes?: number,
  maxSlotsPerDay = 12,
  ignoreTaskId?: string,
  sleepStartTime = '11:00 PM',
  sleepEndTime = '06:00 AM',
  currentTaskSlot?: CurrentTaskSlotInfo,
  defaultBufferMinutes = 0
): AvailableSlotResult[] {
  const now = new Date();
  const todayStr = toISODateString(now);

  // Strictly reject past dates - rescheduling or scheduling in the past is not permitted
  if (dateStr < todayStr) {
    return [];
  }

  const dayStartMin = parse12HourToMinutes(dayStartTime);
  let dayEndMin = parse12HourToMinutes(dayEndTime);
  if (dayEndMin <= dayStartMin) dayEndMin += 1440;

  // If target date is TODAY, ensure earliest possible minute is strictly in the future (at least now + 5 mins)
  const isToday = dateStr === todayStr;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const minFutureMinutes = currentMinutes + 5;

  let effectiveEarliest = earliestAllowedMinutes;
  if (isToday) {
    effectiveEarliest = Math.max(earliestAllowedMinutes ?? minFutureMinutes, minFutureMinutes);

    // If there is an active running task right now, no slot can start before that task completes
    const activeWorkingTask = allTasks.find(t => 
      t.status === 'Working' && 
      isTaskScheduledForDate(t, todayStr)
    );
    if (activeWorkingTask) {
      let aEnd = parse12HourToMinutes(activeWorkingTask.endTime);
      const aStart = parse12HourToMinutes(activeWorkingTask.startTime);
      if (aEnd < aStart) aEnd += 1440;
      if (dayEndMin > 1440 && aStart < dayStartMin) aEnd += 1440;
      const aEndWithBuf = aEnd + (activeWorkingTask.bufferMinutes !== undefined ? activeWorkingTask.bufferMinutes : defaultBufferMinutes);
      effectiveEarliest = Math.max(effectiveEarliest, aEndWithBuf);
    }
  }

  const effectiveStart = Math.max(dayStartMin, effectiveEarliest ?? dayStartMin);

  // If the earliest start time cannot fit the duration before dayEndMin, no slots can exist today
  if (effectiveStart + durationMinutes > dayEndMin) {
    return [];
  }

  const targetTaskId = currentTaskSlot?.id || ignoreTaskId;
  const targetSimultaneousIds = currentTaskSlot?.simultaneousWithIds || [];

  // Filter tasks that block available time:
  // ONLY FREE TIME ZONES AND SIMULTANEOUS TASKS ZONES ARE AVAILABLE.
  // 1. Any non-simultaneous task on dateStr blocks.
  // 2. Any task explicitly marked simultaneousWithIds DOES NOT block (this is an allowed simultaneous zone).
  // 3. For the task being rescheduled itself: on its current date, its current slot [startTime, endTime] is occupied,
  //    so candidate slots cannot partially overlap with the task itself (e.g. 12:10 AM - 01:44 AM overlapping 12:52 AM).
  const dayTasks = allTasks.filter(t => {
    if (!isTaskScheduledForDate(t, dateStr)) return false;
    if (t.status === 'Terminated' || t.status === 'Done') return false;
    if (!t.startTime || !t.endTime || t.startTime === 'All Day') return false;

    // If this is the target task being rescheduled:
    // It is moving away to a new slot, so its old slot is freed up and does NOT block the search!
    if (targetTaskId && t.id === targetTaskId) {
      return false;
    }

    // Check if t is explicitly simultaneous with target task
    const isSimultaneous = Boolean(
      (targetSimultaneousIds.length > 0 && t.id && targetSimultaneousIds.includes(t.id)) ||
      (t.simultaneousWithIds && targetTaskId && t.simultaneousWithIds.includes(targetTaskId))
    );

    // Simultaneous tasks DO NOT block (they form an allowed simultaneous tasks zone)
    if (isSimultaneous) {
      return false;
    }

    return true;
  });

  const scheduledMinutesOnDay = dayTasks.reduce((sum, t) => {
    return sum + Math.max(15, diffTimeInMinutes(t.startTime, t.endTime));
  }, 0);

  // Intervals including task + buffer
  const intervals = dayTasks.map(t => {
    let s = parse12HourToMinutes(t.startTime);
    let e = parse12HourToMinutes(t.endTime);
    if (e < s) e += 1440;
    if (dayEndMin > 1440 && s < dayStartMin) {
      s += 1440;
      e += 1440;
    }
    const buf = t.bufferMinutes !== undefined ? t.bufferMinutes : defaultBufferMinutes;
    return { start: s, end: e + buf };
  }).sort((a, b) => a.start - b.start);

  // Merge overlapping intervals
  const merged: { start: number; end: number }[] = [];
  for (const interval of intervals) {
    if (merged.length === 0) {
      merged.push({ ...interval });
    } else {
      const last = merged[merged.length - 1];
      if (interval.start <= last.end) {
        last.end = Math.max(last.end, interval.end);
      } else {
        merged.push({ ...interval });
      }
    }
  }

  // Find all free gaps strictly within waking hours [effectiveStart, dayEndMin]
  let cursor = effectiveStart;
  const gaps: { start: number; end: number }[] = [];

  for (const block of merged) {
    if (block.start > cursor) {
      const gapStart = Math.max(cursor, effectiveStart);
      const gapEnd = Math.min(block.start, dayEndMin);
      if (gapEnd > gapStart && (gapEnd - gapStart) >= durationMinutes) {
        gaps.push({ start: gapStart, end: gapEnd });
      }
    }
    cursor = Math.max(cursor, block.end);
  }

  if (cursor < dayEndMin) {
    const gapStart = Math.max(cursor, effectiveStart);
    if (dayEndMin - gapStart >= durationMinutes) {
      gaps.push({ start: gapStart, end: dayEndMin });
    }
  }

  const results: AvailableSlotResult[] = [];
  const dayOfWeek = getDayOfWeekFromDate(dateStr);
  const remainingCapacity = Math.max(0, (14 * 60) - scheduledMinutesOnDay - durationMinutes);
  const isRedLine = (scheduledMinutesOnDay + durationMinutes) > (14 * 60);

  // Helper to validate candidate slot:
  // Must be strictly within free time zone or simultaneous tasks zone,
  // never overlapping with system sleep, past times, or the current task's existing unchanged slot
  const tryAddCandidateSlot = (startMin: number): boolean => {
    if (results.length >= maxSlotsPerDay) return false;
    const endMin = startMin + durationMinutes;
    const startStr = formatMinutesTo12Hour(startMin);
    const endStr = formatMinutesTo12Hour(endMin);

    if (isTimeInSleepWindow(startStr, endStr, sleepStartTime, sleepEndTime)) {
      return false;
    }

    if (isToday && startMin < minFutureMinutes) {
      return false;
    }

    // Do not suggest the exact same unchanged start time back to the user
    if (currentTaskSlot && dateStr === currentTaskSlot.date && startStr === currentTaskSlot.startTime) {
      return false;
    }

    // Check if slot overlaps with any simultaneous task
    const simTask = allTasks.find(t => {
      if (!isTaskScheduledForDate(t, dateStr)) return false;
      if (t.status === 'Terminated' || t.status === 'Done') return false;
      if (!t.startTime || !t.endTime || t.startTime === 'All Day') return false;
      const isSim = Boolean(
        (targetSimultaneousIds.length > 0 && t.id && targetSimultaneousIds.includes(t.id)) ||
        (t.simultaneousWithIds && targetTaskId && t.simultaneousWithIds.includes(targetTaskId))
      );
      if (!isSim) return false;
      return checkOverlap(startStr, endStr, t.startTime, t.endTime);
    });

    const period: CircadianPeriodName = getStandardCircadianPeriod(startMin);

    // Calculate effective calendar date for the slot:
    // If startMin >= 1440 (e.g. 12:00 AM after midnight), the slot belongs to the NEXT calendar day!
    const daysToAdd = Math.floor(startMin / 1440);
    let effectiveDateStr = dateStr;
    let effectiveDayOfWeek = dayOfWeek;
    if (daysToAdd > 0) {
      const [y, m, d] = dateStr.split('-').map(Number);
      const nextDateObj = new Date(y, m - 1, d + daysToAdd);
      effectiveDateStr = toISODateString(nextDateObj);
      effectiveDayOfWeek = getDayOfWeekFromDate(effectiveDateStr);
    }

    const crosses = (startMin % 1440) + durationMinutes > 1440;
    let calculatedEndDate = effectiveDateStr;
    if (crosses) {
      const [sy, sm, sd] = effectiveDateStr.split('-').map(Number);
      calculatedEndDate = toISODateString(new Date(sy, sm - 1, sd + 1));
    }

    results.push({
      date: effectiveDateStr,
      dayOfWeek: effectiveDayOfWeek,
      startTime: startStr,
      endTime: endStr,
      scheduledMinutesOnDay,
      remainingCapacityMinutes: remainingCapacity,
      isRedLine,
      period,
      isSimultaneousSlot: Boolean(simTask),
      simultaneousTaskTitle: simTask ? (simTask as any).title : undefined,
      crossesMidnight: crosses,
      endDate: calculatedEndDate,
      isAfterMidnight: daysToAdd > 0
    });
    return true;
  };

  for (const gap of gaps) {
    if (results.length >= maxSlotsPerDay) break;
    tryAddCandidateSlot(gap.start);

    // If gap is large enough, add intermediate step slots (e.g. +30m or +60m)
    const step = Math.max(30, durationMinutes >= 90 ? 60 : 30);
    let nextStart = gap.start + step;
    while (nextStart + durationMinutes <= gap.end && results.length < maxSlotsPerDay) {
      tryAddCandidateSlot(nextStart);
      nextStart += step;
    }
  }

  return results;
}

/**
 * Finds the earliest available conflict-free slot for a given duration on a target date,
 * respecting already scheduled tasks + breaks/buffers, avoiding system sleep time.
 */
export function findAvailableSlotOnDate(
  dateStr: string,
  durationMinutes: number,
  allTasks: Array<{ taskDate: string; startTime: string; endTime: string; bufferMinutes?: number; status: string; recurrence?: string; selectedDays?: string[]; id?: string }>,
  dayStartTime = '06:00 AM',
  dayEndTime = '11:00 PM',
  earliestAllowedMinutes?: number,
  ignoreTaskId?: string,
  sleepStartTime = '11:00 PM',
  sleepEndTime = '06:00 AM',
  defaultBufferMinutes = 0
): AvailableSlotResult | null {
  const slots = findAllAvailableSlotsOnDate(
    dateStr,
    durationMinutes,
    allTasks,
    dayStartTime,
    dayEndTime,
    earliestAllowedMinutes,
    1,
    ignoreTaskId,
    sleepStartTime,
    sleepEndTime,
    undefined,
    defaultBufferMinutes
  );
  return slots.length > 0 ? slots[0] : null;
}

/**
 * Returns the exact Date range [start, end] for a given task,
 * seamlessly handling cross-midnight time spans (e.g. 11:00 PM on Sept 1 -> 01:00 AM on Sept 2).
 */
export function getTaskDateTimeRange(taskDateStr: string, startTimeStr: string, endTimeStr: string): { start: Date; end: Date } | null {
  if (!taskDateStr || !startTimeStr || !endTimeStr || startTimeStr === 'All Day' || endTimeStr === 'All Day') {
    return null;
  }
  const parts = taskDateStr.split('-').map(Number);
  if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return null;

  const [year, month, day] = parts;
  const startMinutes = parse12HourToMinutes(startTimeStr);
  const endMinutes = parse12HourToMinutes(endTimeStr);

  const start = new Date(year, month - 1, day, Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
  
  // If endMinutes <= startMinutes, the task crosses midnight into the next day
  const isOvernight = endMinutes <= startMinutes;
  const end = new Date(year, month - 1, isOvernight ? day + 1 : day, Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);

  return { start, end };
}

/**
 * Checks if a task is currently in its active running time slot right now.
 * Works seamlessly across midnight boundaries (e.g. 11:00 PM to 01:00 AM).
 */
export function isTaskInRunningSlot(taskDateStr: string, startTimeStr: string, endTimeStr: string, now: Date = new Date()): boolean {
  const range = getTaskDateTimeRange(taskDateStr, startTimeStr, endTimeStr);
  if (!range) return false;
  return now >= range.start && now < range.end;
}

/**
 * Checks if a task's scheduled end time has already elapsed (is Due / Overdue).
 * Accurately treats 01:00 AM in an overnight task (11:00 PM - 01:00 AM) as the NEXT day.
 */
export function isTaskPastDue(taskDateStr: string, startTimeStr: string, endTimeStr: string, now: Date = new Date()): boolean {
  const range = getTaskDateTimeRange(taskDateStr, startTimeStr, endTimeStr);
  if (!range) {
    // For tasks without specific times, check if task date is before today
    const todayStr = toISODateString(now);
    return taskDateStr < todayStr;
  }
  return now >= range.end;
}

/**
 * Checks if a task has exceeded the 6-hour (360 mins) inactivity threshold.
 * Uses exact anchor time respecting overnight next-day boundaries.
 */
export function isTaskAutoIncompleteExpired(
  taskDateStr: string,
  startTimeStr: string,
  endTimeStr: string,
  status: 'Pending' | 'Working',
  now: Date = new Date(),
  expireThresholdMinutes = 360
): boolean {
  const range = getTaskDateTimeRange(taskDateStr, startTimeStr, endTimeStr);
  if (!range) {
    const todayStr = toISODateString(now);
    return taskDateStr < todayStr;
  }

  // If Pending, expire 6 hours after scheduled start time
  // If Working, expire 6 hours after scheduled end time
  const anchorTime = status === 'Working' ? range.end.getTime() : range.start.getTime();
  const diffMs = now.getTime() - anchorTime;
  return diffMs >= expireThresholdMinutes * 60 * 1000;
}

export interface WeekDayInfo {
  date: Date;
  dateStr: string;
  dayName: string;
  shortDayName: string;
  dayNumber: number;
  isToday: boolean;
}

export function getWeekDays(referenceDate: Date = new Date(), startOnMonday = true): WeekDayInfo[] {
  const curr = new Date(referenceDate);
  curr.setHours(0, 0, 0, 0);
  const day = curr.getDay(); // 0 = Sunday
  const diff = startOnMonday ? (day === 0 ? -6 : 1 - day) : -day;
  const startOfWeek = new Date(curr);
  startOfWeek.setDate(curr.getDate() + diff);

  const todayStr = toISODateString(new Date());
  const days: WeekDayInfo[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    const dateStr = toISODateString(d);
    days.push({
      date: d,
      dateStr,
      dayName: DAYS_OF_WEEK[d.getDay()],
      shortDayName: SHORT_DAYS[d.getDay()],
      dayNumber: d.getDate(),
      isToday: dateStr === todayStr
    });
  }

  return days;
}

export interface MonthDayInfo {
  date: Date;
  dateStr: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
}

export function getMonthDays(year: number, monthIndex: number): MonthDayInfo[] {
  const todayStr = toISODateString(new Date());
  const firstDayOfMonth = new Date(year, monthIndex, 1);
  const lastDayOfMonth = new Date(year, monthIndex + 1, 0);

  // Determine starting weekday (0 = Sun, 1 = Mon ... with Mon as first column)
  let startDay = firstDayOfMonth.getDay(); // 0 = Sun
  startDay = startDay === 0 ? 6 : startDay - 1; // 0 = Mon, 6 = Sun

  const days: MonthDayInfo[] = [];

  // Previous month trailing days
  for (let i = startDay - 1; i >= 0; i--) {
    const d = new Date(year, monthIndex, 1 - (i + 1));
    const dateStr = toISODateString(d);
    days.push({
      date: d,
      dateStr,
      dayNumber: d.getDate(),
      isCurrentMonth: false,
      isToday: dateStr === todayStr
    });
  }

  // Current month days
  for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
    const d = new Date(year, monthIndex, i);
    const dateStr = toISODateString(d);
    days.push({
      date: d,
      dateStr,
      dayNumber: i,
      isCurrentMonth: true,
      isToday: dateStr === todayStr
    });
  }

  // Next month leading days to fill grid to multiple of 7
  const remaining = (7 - (days.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(year, monthIndex + 1, i);
    const dateStr = toISODateString(d);
    days.push({
      date: d,
      dateStr,
      dayNumber: d.getDate(),
      isCurrentMonth: false,
      isToday: dateStr === todayStr
    });
  }

  return days;
}

export function formatMonthYear(year: number, monthIndex: number): string {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return `${monthNames[monthIndex]} ${year}`;
}

/**
 * Dynamic typography scaling for task titles:
 * - Short title (<= 25 chars): larger, bold typography for maximum focus
 * - Medium title (26 - 55 chars): standard medium font size
 * - Long title (> 55 chars): auto-scaled slightly smaller with graceful line clamping
 */
export function getTaskTitleClasses(title: string, isDone = false, isInSleep = false, isWorking = false): string {
  const len = (title || '').trim().length;
  const colorClass = isDone 
    ? 'line-through text-theme-muted opacity-75' 
    : isWorking
    ? 'text-blue-600 dark:text-blue-400 font-black'
    : isInSleep 
    ? 'text-indigo-600 dark:text-indigo-300 drop-shadow-sm font-black' 
    : 'text-theme-text font-black';
  
  if (len <= 25) {
    return `text-lg sm:text-xl font-black font-display tracking-tight leading-snug ${colorClass}`;
  }
  if (len <= 55) {
    return `text-base sm:text-lg font-bold font-display tracking-normal leading-snug ${colorClass}`;
  }
  return `text-xs sm:text-sm font-bold font-display leading-snug line-clamp-2 ${colorClass}`;
}

export function getBufferActivityEmoji(tag: string): string {
  switch (tag) {
    case 'Break / Rest': return '🧘';
    case 'Coffee / Tea': return '☕';
    case 'Meal / Snack': return '🥪';
    case 'Walk / Exercise': return '🚶';
    case 'Reading / Learning': return '📚';
    case 'Power Nap': return '💤';
    case 'Quick Chores': return '🧹';
    case 'Social / Chat': return '💬';
    case 'Meditation': return '✨';
    case 'Entertainment': return '🎮';
    case 'Planning': return '🎯';
    default: return '📝';
  }
}

export function getBufferActivityColor(tag: string): { color: string; bgColor: string; borderColor: string } {
  switch (tag) {
    case 'Coffee / Tea':
    case 'Meal / Snack':
      return { color: '#D97706', bgColor: '#FEF3C7', borderColor: '#FDE68A' };
    case 'Walk / Exercise':
      return { color: '#059669', bgColor: '#D1FAE5', borderColor: '#A7F3D0' };
    case 'Reading / Learning':
      return { color: '#2563EB', bgColor: '#DBEAFE', borderColor: '#BFDBFE' };
    case 'Power Nap':
    case 'Meditation':
    case 'Break / Rest':
      return { color: '#7C3AED', bgColor: '#EDE9FE', borderColor: '#DDD6FE' };
    case 'Quick Chores':
      return { color: '#4B5563', bgColor: '#F3F4F6', borderColor: '#E5E7EB' };
    case 'Social / Chat':
      return { color: '#DB2777', bgColor: '#FCE7F3', borderColor: '#FBCFE8' };
    case 'Planning':
      return { color: '#0891B2', bgColor: '#CFFAFE', borderColor: '#A5F3FC' };
    default:
      return { color: '#D97706', bgColor: '#FEF3C7', borderColor: '#FDE68A' };
  }
}

/**
 * Computes a continuous 1,440-minute (24 Hours: 00:00 to 24:00) segmentation of the day.
 * Accounts for every single minute of the circadian cycle:
 * - Sleep Cycle (e.g. 11:00 PM to 06:00 AM)
 * - Work Tasks (Completed, Working, Pending, Hold)
 * - Post-Task Buffers
 * - Logged Buffer / Free Time Notes
 * - Unaccounted Free Time Gaps
 */
export function get24HourContinuousTimeline(
  dateStr: string,
  allTasks: Task[],
  bufferNotes: BufferStatusNote[],
  capacitySettings: CapacitySettings
): { slices: DaySlice24[]; metrics: DayBreakdown24Metrics } {
  const dayStartMin = parse12HourToMinutes(capacitySettings.dayStartTime);
  let dayEndMin = parse12HourToMinutes(capacitySettings.dayEndTime);
  if (dayEndMin <= dayStartMin) dayEndMin += 1440;

  // Filter tasks for this date (timed tasks only)
  const dayTasks = allTasks.filter(t => 
    isTaskScheduledForDate(t, dateStr) && 
    t.status !== 'Terminated' && 
    t.startTime && 
    t.endTime && 
    t.startTime !== 'All Day'
  );

  // Filter buffer notes for this date
  const dayBufferNotes = bufferNotes.filter(n => n.date === dateStr);

  // Build raw occupied intervals (0 to 1440 mins)
  interface RawInterval {
    start: number;
    end: number;
    type: DaySlice24['type'];
    title: string;
    task?: Task;
    bufferNote?: BufferStatusNote;
    category?: string;
    priority?: Task['priority'];
    signalNoise?: SignalNoiseType;
    snReason?: string;
  }

  const rawIntervals: RawInterval[] = [];

  // 1. Tasks & Post-Task Buffers

  // 2. Tasks
  for (const t of dayTasks) {
    // If task is Done and completed before its scheduled window even occurred:
    // The scheduled slot is NOT occupied by work—it is 100% FREE TIME (unaccounted_gap)!
    if (t.status === 'Done' && t.completedBeforeTimeOccurred) {
      continue;
    }

    let s = parse12HourToMinutes(t.startTime);
    let e = parse12HourToMinutes(t.endTime);

    // If task is Done and finished early, only occupy up to its actual completion time!
    // The remainder of its scheduled window automatically becomes an unaccounted_gap (Free Time)!
    if (t.status === 'Done') {
      if (t.actualEndTime) {
        const aEnd = parse12HourToMinutes(t.actualEndTime);
        if (aEnd > s && aEnd < e) {
          e = aEnd;
        }
      } else if (t.totalActualMinutes && t.totalActualMinutes > 0 && t.totalActualMinutes < (e - s)) {
        e = s + t.totalActualMinutes;
      }
    }

    if (e <= s) e += 1440;

    let sliceType: DaySlice24['type'] = 'work_pending';
    if (t.status === 'Done') sliceType = 'work_completed';
    else if (t.status === 'Working') sliceType = 'work_active';
    else if (t.status === 'Hold') sliceType = 'work_hold';

    // Normalize within 0..1440
    const clampedStart = Math.min(1440, Math.max(0, s));
    const clampedEnd = Math.min(1440, Math.max(clampedStart, e));

    if (clampedEnd > clampedStart) {
      const sn = detectSignalVsNoise({
        title: t.title,
        notes: t.notes || t.description,
        category: t.category,
        priority: t.priority,
        sliceType,
        explicitType: t.signalNoise
      });

      rawIntervals.push({
        start: clampedStart,
        end: clampedEnd,
        type: sliceType,
        title: t.title,
        task: t,
        category: t.category,
        priority: t.priority,
        signalNoise: sn.type,
        snReason: sn.reason
      });
    }

    // Post-task buffer if specified and task is active or done
    const buf = t.bufferMinutes || 0;
    if (buf > 0) {
      const bufStart = clampedEnd;
      const bufEnd = Math.min(1440, bufStart + buf);
      if (bufEnd > bufStart) {
        // Check if user already logged a buffer note during this post-task window
        const matchingNote = dayBufferNotes.find(n => {
          if (n.relatedTaskId === t.id) return true;
          const s = parse12HourToMinutes(n.startTime);
          let e = parse12HourToMinutes(n.endTime);
          if (e <= s) e += 1440;
          return s < bufEnd && e > bufStart;
        });

        // Only add placeholder task_buffer if NOT already logged as a user buffer note!
        if (!matchingNote) {
          rawIntervals.push({
            start: bufStart,
            end: bufEnd,
            type: 'task_buffer',
            title: `Buffer (${t.projectCode})`,
            task: t,
            signalNoise: 'signal',
            snReason: 'Mindful post-task transition buffer'
          });
        }
      }
    }
  }

  // 3. Buffer Status Notes logged by the user
  for (const note of dayBufferNotes) {
    let s = parse12HourToMinutes(note.startTime);
    let e = parse12HourToMinutes(note.endTime);
    if (e <= s) e += 1440;

    const clampedStart = Math.min(1440, Math.max(0, s));
    const clampedEnd = Math.min(1440, Math.max(clampedStart, e));

    if (clampedEnd > clampedStart) {
      const sn = detectSignalVsNoise({
        title: note.activityTag,
        notes: note.notes,
        tag: note.activityTag,
        energyLevel: note.energyLevel,
        sliceType: 'buffer_note',
        explicitType: note.signalNoise
      });

      rawIntervals.push({
        start: clampedStart,
        end: clampedEnd,
        type: 'buffer_note',
        title: `${getBufferActivityEmoji(note.activityTag)} ${note.activityTag}: ${note.notes || 'Free Time'}`,
        bufferNote: note,
        signalNoise: sn.type,
        snReason: sn.reason
      });
    }
  }

  // 3. Optional Auto Sleep Schedule (ONLY if user explicitly enabled it in Capacity Settings)
  if (capacitySettings.autoSleepScheduleEnabled) {
    const sleepStartMin = parse12HourToMinutes(capacitySettings.sleepStartTime || capacitySettings.dayEndTime || '11:00 PM');
    const sleepEndMin = parse12HourToMinutes(capacitySettings.sleepEndTime || capacitySettings.dayStartTime || '06:00 AM');

    // Helper to add sleep into unoccupied portions of a window [wStart, wEnd]
    const addSleepIntoUnoccupied = (wStart: number, wEnd: number) => {
      if (wEnd <= wStart) return;
      const occupiedInWindow = rawIntervals
        .filter(r => r.start < wEnd && r.end > wStart)
        .map(r => ({ start: Math.max(wStart, r.start), end: Math.min(wEnd, r.end) }))
        .sort((a, b) => a.start - b.start);

      let cur = wStart;
      for (const occ of occupiedInWindow) {
        if (occ.start > cur) {
          rawIntervals.push({
            start: cur,
            end: occ.start,
            type: 'sleep',
            title: 'Sleep Cycle & Rest',
            signalNoise: 'signal',
            snReason: 'Essential Circadian Recovery & Sleep'
          });
        }
        cur = Math.max(cur, occ.end);
      }
      if (cur < wEnd) {
        rawIntervals.push({
          start: cur,
          end: wEnd,
          type: 'sleep',
          title: 'Sleep Cycle & Rest',
          signalNoise: 'signal',
          snReason: 'Essential Circadian Recovery & Sleep'
        });
      }
    };

    // Morning sleep window (0 to sleepEndMin)
    if (sleepEndMin > 0) {
      addSleepIntoUnoccupied(0, Math.min(1440, sleepEndMin));
    }
    // Night sleep window (sleepStartMin to 1440)
    if (sleepStartMin < 1440) {
      addSleepIntoUnoccupied(Math.max(0, sleepStartMin), 1440);
    }
  }

  // Sort all intervals chronologically by start time.
  // Explicit priority: user buffer notes & tasks MUST take precedence over auto-sleep and generic task buffers
  rawIntervals.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    const typePriority = (type: DaySlice24['type']) => {
      if (type === 'buffer_note') return 1;
      if (type.startsWith('work_')) return 2;
      if (type === 'task_buffer') return 3;
      if (type === 'sleep') return 4;
      return 5;
    };
    const diff = typePriority(a.type) - typePriority(b.type);
    if (diff !== 0) return diff;
    return b.end - a.end;
  });

  // Stitch into continuous 1,440-minute slices
  const slices: DaySlice24[] = [];
  let cursor = 0;

  for (let i = 0; i < rawIntervals.length; i++) {
    const item = rawIntervals[i];

    // If there is an unoccupied gap between cursor and item.start
    if (item.start > cursor) {
      const gapDuration = item.start - cursor;
      slices.push({
        id: `gap_${cursor}_${item.start}`,
        type: 'unaccounted_gap',
        title: 'Unaccounted Free Time',
        startTime: formatMinutesTo12Hour(cursor),
        endTime: formatMinutesTo12Hour(item.start),
        startMinute: cursor,
        endMinute: item.start,
        durationMinutes: gapDuration,
        signalNoise: 'noise',
        isNoise: true,
        snReason: 'Unaccounted time window'
      });
      cursor = item.start;
    }

    // If item extends beyond current cursor
    if (item.end > cursor) {
      const sliceStart = Math.max(cursor, item.start);
      const sliceEnd = item.end;
      const duration = sliceEnd - sliceStart;
      const isNoise = item.signalNoise === 'noise';

      slices.push({
        id: `slice_${item.type}_${sliceStart}_${sliceEnd}_${Math.random().toString(36).substring(2, 6)}`,
        type: item.type,
        title: item.title,
        startTime: formatMinutesTo12Hour(sliceStart),
        endTime: formatMinutesTo12Hour(sliceEnd),
        startMinute: sliceStart,
        endMinute: sliceEnd,
        durationMinutes: duration,
        category: item.category,
        priority: item.priority,
        task: item.task,
        bufferNote: item.bufferNote,
        signalNoise: item.signalNoise || (isNoise ? 'noise' : 'signal'),
        isNoise,
        snReason: item.snReason
      });

      cursor = sliceEnd;
    }
  }

  // Trailing gap to complete the full 1,440-minute day
  if (cursor < 1440) {
    slices.push({
      id: `gap_${cursor}_1440`,
      type: 'unaccounted_gap',
      title: 'Unaccounted Free Time',
      startTime: formatMinutesTo12Hour(cursor),
      endTime: formatMinutesTo12Hour(1440),
      startMinute: cursor,
      endMinute: 1440,
      durationMinutes: 1440 - cursor,
      signalNoise: 'noise',
      isNoise: true,
      snReason: 'Unaccounted time window'
    });
  }

  // Calculate 24h Metrics
  let workMinutes = 0;
  let completedWorkMinutes = 0;
  let sleepMinutes = 0;
  let bufferLoggedMinutes = 0;
  let scheduledBufferMinutes = 0;
  let unaccountedMinutes = 0;
  let signalMinutes = 0;
  let noiseMinutes = 0;

  for (const s of slices) {
    if (s.type === 'work_completed') {
      workMinutes += s.durationMinutes;
      completedWorkMinutes += s.durationMinutes;
    } else if (s.type === 'work_active' || s.type === 'work_pending' || s.type === 'work_hold') {
      workMinutes += s.durationMinutes;
    } else if (s.type === 'sleep') {
      sleepMinutes += s.durationMinutes;
    } else if (s.type === 'buffer_note') {
      bufferLoggedMinutes += s.durationMinutes;
    } else if (s.type === 'task_buffer') {
      scheduledBufferMinutes += s.durationMinutes;
    } else if (s.type === 'unaccounted_gap') {
      unaccountedMinutes += s.durationMinutes;
    }

    // Signal vs Noise breakdown
    if (s.signalNoise === 'noise') {
      noiseMinutes += s.durationMinutes;
    } else if (s.signalNoise === 'signal' && s.type !== 'sleep') {
      signalMinutes += s.durationMinutes;
    }
  }

  const accountedMinutes = Math.min(1440, 1440 - unaccountedMinutes);
  const accountabilityScore = Math.min(100, Math.round((accountedMinutes / 1440) * 100));

  const awakeTotalTracked = signalMinutes + noiseMinutes;
  const signalRatio = awakeTotalTracked > 0 
    ? Math.min(100, Math.max(0, Math.round((signalMinutes / awakeTotalTracked) * 100))) 
    : 100;
  const snrMultiplier = noiseMinutes > 0 
    ? Number((signalMinutes / noiseMinutes).toFixed(2)) 
    : (signalMinutes > 0 ? 10.0 : 1.0);

  const metrics: DayBreakdown24Metrics = {
    totalMinutes: 1440,
    workMinutes,
    completedWorkMinutes,
    sleepMinutes,
    bufferLoggedMinutes,
    scheduledBufferMinutes,
    unaccountedMinutes,
    accountabilityScore,
    signalMinutes,
    noiseMinutes,
    signalRatio,
    snrMultiplier,
    noiseLeakMinutes: noiseMinutes
  };

  return { slices, metrics };
}

/**
 * Intelligent Emergency Cascading Reschedule Engine
 * Calculates optimal shift times or tomorrow-deferrals for all downstream tasks
 * when an uncontrollable emergency buffer occurs.
 * Strictly guarantees:
 * 1. Mandatory Schedules (isMandatorySchedule: true) NEVER MOVE or shift.
 * 2. Flexible tasks cascade around the emergency buffer and around mandatory tasks.
 * 3. Overflows past dayEndTime are deferred to tomorrow conflict-free.
 */
/**
 * Intelligent Emergency Cascading Reschedule Engine
 * Calculates optimal shift times for all impacted downstream tasks when an emergency buffer occurs.
 * 
 * CORE RULES:
 * 1. Mandatory Schedules (isMandatorySchedule: true) are 100% anchored and NEVER move.
 * 2. Flexible tasks are scheduled by default on TODAY starting immediately after the emergency buffer.
 * 3. Downstream flexible tasks cascade sequentially around emergency and mandatory blocks.
 * 4. Only tasks that exceed dayEndTime (e.g. 11:00 PM) are deferred to tomorrow conflict-free.
 */
/**
 * Intelligent Emergency Cascading Reschedule Engine
 * Calculates optimal shift times for all impacted downstream tasks when an emergency buffer occurs.
 * 
 * CORE RULES:
 * 1. Mandatory Schedules (isMandatorySchedule: true) are 100% anchored and NEVER move.
 * 2. Flexible tasks are scheduled by default on TODAY starting immediately after the emergency buffer.
 * 3. Downstream flexible tasks cascade sequentially around emergency and mandatory blocks.
 * 4. Only tasks that exceed dayEndTime (e.g. 11:00 PM) are deferred to tomorrow conflict-free.
 */
export function calculateEmergencyReschedule(
  emergencyStart: string,
  emergencyDuration: number,
  dateStr: string,
  allTasks: any[],
  capacitySettings?: { dayStartTime?: string; dayEndTime?: string }
): import('../types').TaskRescheduleProposal[] {
  const emergencyStartMin = parse12HourToMinutes(emergencyStart);
  const emergencyEndMin = emergencyStartMin + emergencyDuration;
  
  // Safe normalization of waking hours: default to 11:00 PM (1380 mins)
  const rawDayEnd = capacitySettings?.dayEndTime || '11:00 PM';
  const dayEndMin = parse12HourToMinutes(rawDayEnd) || 1380;
  const rawDayStart = capacitySettings?.dayStartTime || '06:00 AM';
  const dayStartMin = parse12HourToMinutes(rawDayStart) || 360;

  // Tomorrow's date string
  const [y, m, d] = dateStr.split('-').map(Number);
  const tomDate = new Date(y, m - 1, d);
  tomDate.setDate(tomDate.getDate() + 1);
  const tomorrowDateStr = toISODateString(tomDate);

  // Active tasks on this date (respecting recurring series, excluding done, terminated, or existing emergency buffer)
  const activeTasks = allTasks.filter(t => 
    isTaskScheduledForDate(t, dateStr) &&
    t.status !== 'Done' && 
    t.status !== 'Terminated' && 
    !t.isEmergencyBuffer &&
    t.startTime && 
    t.endTime &&
    t.startTime !== 'All Day'
  ).sort((a, b) => parse12HourToMinutes(a.startTime) - parse12HourToMinutes(b.startTime));

  // Existing active tasks on tomorrow's date to guarantee ZERO overlaps if anything overflows
  const simulatedTomorrowTasks: any[] = allTasks.filter(t =>
    isTaskScheduledForDate(t, tomorrowDateStr) &&
    t.status !== 'Done' &&
    t.status !== 'Terminated' &&
    !t.isEmergencyBuffer
  );

  // Get all mandatory locked tasks that CANNOT move
  const mandatoryTasks = activeTasks.filter(t => t.isMandatorySchedule);

  const proposals: import('../types').TaskRescheduleProposal[] = [];
  let currentCascadeCursor = emergencyEndMin;

  for (const task of activeTasks) {
    const origStartMin = parse12HourToMinutes(task.startTime);
    const origEndMin = parse12HourToMinutes(task.endTime);
    const taskDuration = task.appointedMinutes || Math.max(15, origEndMin - origStartMin);
    const buffer = task.bufferMinutes ?? 5;
    const isMandatory = !!task.isMandatorySchedule;

    // 1. If task ends strictly before emergency starts, it is unaffected
    if (origEndMin <= emergencyStartMin) {
      continue;
    }

    // 2. If task is locked with a Mandatory Schedule, it is 100% fixed and NEVER moves
    if (isMandatory) {
      proposals.push({
        taskId: task.id,
        taskTitle: task.title,
        projectCode: task.projectCode,
        priority: task.priority,
        currentDate: dateStr,
        currentStartTime: task.startTime,
        currentEndTime: task.endTime,
        currentDurationMinutes: taskDuration,
        proposedDate: dateStr,
        proposedStartTime: task.startTime,
        proposedEndTime: task.endTime,
        proposedDurationMinutes: taskDuration,
        action: 'keep',
        approved: false,
        isMandatory: true,
        notes: '🔒 Mandatory Schedule (Anchored • Never Shifts)'
      });

      // Advance cascade cursor past mandatory task if needed
      if (origEndMin > currentCascadeCursor) {
        currentCascadeCursor = Math.max(currentCascadeCursor, origEndMin + buffer);
      }
      continue;
    }

    // 3. For flexible (non-mandatory) tasks:
    // Schedule sequentially on TODAY starting after emergency cursor
    const isToday = dateStr === toISODateString(new Date());
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    let candidateStartMin = Math.max(currentCascadeCursor, dayStartMin);
    if (isToday) {
      candidateStartMin = Math.max(candidateStartMin, nowMin + 1);
    }

    // Jump past any overlapping mandatory tasks on this day
    let collisionWithMandatory = true;
    while (collisionWithMandatory) {
      collisionWithMandatory = false;
      const candidateEndMin = candidateStartMin + taskDuration;
      for (const mand of mandatoryTasks) {
        const mStart = parse12HourToMinutes(mand.startTime);
        const mEnd = parse12HourToMinutes(mand.endTime);
        if (candidateStartMin < mEnd && candidateEndMin > mStart) {
          candidateStartMin = mEnd + (mand.bufferMinutes ?? 5);
          collisionWithMandatory = true;
          break;
        }
      }
    }

    const candidateEndMin = candidateStartMin + taskDuration;

    // Check if the candidate slot fits on TODAY before dayEndTime
    if (candidateEndMin <= dayEndMin) {
      const isShifted = candidateStartMin !== origStartMin;
      const delayMins = candidateStartMin - origStartMin;

      proposals.push({
        taskId: task.id,
        taskTitle: task.title,
        projectCode: task.projectCode,
        priority: task.priority,
        currentDate: dateStr,
        currentStartTime: task.startTime,
        currentEndTime: task.endTime,
        currentDurationMinutes: taskDuration,
        proposedDate: dateStr,
        proposedStartTime: formatMinutesTo12Hour(candidateStartMin),
        proposedEndTime: formatMinutesTo12Hour(candidateEndMin),
        proposedDurationMinutes: taskDuration,
        action: isShifted ? 'shift_same_day' : 'keep',
        approved: isShifted,
        delayMinutes: isShifted ? delayMins : 0,
        isMandatory: false,
        notes: isShifted ? `Shifted to ${formatMinutesTo12Hour(candidateStartMin)} today` : 'Slot unaffected'
      });

      currentCascadeCursor = candidateEndMin + buffer;
    } else {
      // Overflows past dayEndMin -> defer to tomorrow conflict-free
      const tomSlot = getSmartNextFreeSlot(
        tomorrowDateStr,
        taskDuration,
        simulatedTomorrowTasks,
        [],
        task.id,
        buffer
      );

      proposals.push({
        taskId: task.id,
        taskTitle: task.title,
        projectCode: task.projectCode,
        priority: task.priority,
        currentDate: dateStr,
        currentStartTime: task.startTime,
        currentEndTime: task.endTime,
        currentDurationMinutes: taskDuration,
        proposedDate: tomorrowDateStr,
        proposedStartTime: tomSlot.startTime,
        proposedEndTime: tomSlot.endTime,
        proposedDurationMinutes: taskDuration,
        action: 'defer_tomorrow',
        approved: true,
        isMandatory: false,
        notes: `Day overflow -> Tomorrow (${tomorrowDateStr})`
      });

      simulatedTomorrowTasks.push({
        id: task.id,
        taskDate: tomorrowDateStr,
        startTime: tomSlot.startTime,
        endTime: tomSlot.endTime,
        appointedMinutes: taskDuration,
        bufferMinutes: buffer,
        status: 'Pending'
      });
    }
  }

  return proposals;
}

/**
 * Batch Strategy 1: Shift all flexible tasks forward by custom delay minutes
 */
export function calculateBatchShiftProposals(
  currentProposals: import('../types').TaskRescheduleProposal[],
  delayMins: number,
  emergencyEndMin: number,
  dateStr: string,
  allTasks: any[],
  capacitySettings?: { dayStartTime?: string; dayEndTime?: string }
): import('../types').TaskRescheduleProposal[] {
  const rawDayEnd = capacitySettings?.dayEndTime || '11:00 PM';
  const dayEndMin = parse12HourToMinutes(rawDayEnd) || 1380;
  const [y, m, d] = dateStr.split('-').map(Number);
  const tomDate = new Date(y, m - 1, d);
  tomDate.setDate(tomDate.getDate() + 1);
  const tomorrowStr = toISODateString(tomDate);

  const tomorrowTasks = allTasks.filter(t => 
    isTaskScheduledForDate(t, tomorrowStr) && 
    t.status !== 'Done' && 
    t.status !== 'Terminated' && 
    !t.isEmergencyBuffer
  );
  const simulatedTomorrowPool: any[] = [...tomorrowTasks];
  const mandatoryTasks = allTasks.filter(t => isTaskScheduledForDate(t, dateStr) && t.isMandatorySchedule);

  let cascadeCursor = emergencyEndMin;

  return currentProposals.map(p => {
    if (p.isMandatory) return p;

    const origTask = allTasks.find(t => t.id === p.taskId);
    const origStartMin = parse12HourToMinutes(p.currentStartTime);
    const dur = p.proposedDurationMinutes || p.currentDurationMinutes;
    const buffer = origTask?.bufferMinutes ?? 5;

    // Shift forward from original start time, but never before emergencyEndMin or previous cascadeCursor
    const isToday = dateStr === toISODateString(new Date());
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    let newStartMin = Math.max(origStartMin + delayMins, cascadeCursor);
    if (isToday) {
      newStartMin = Math.max(newStartMin, nowMin + 1);
    }

    // Avoid collision with mandatory tasks
    let collision = true;
    while (collision) {
      collision = false;
      const newEndMin = newStartMin + dur;
      for (const mand of mandatoryTasks) {
        const mStart = parse12HourToMinutes(mand.startTime);
        const mEnd = parse12HourToMinutes(mand.endTime);
        if (newStartMin < mEnd && newEndMin > mStart) {
          newStartMin = mEnd + (mand.bufferMinutes ?? 5);
          collision = true;
          break;
        }
      }
    }

    const newEndMin = newStartMin + dur;

    if (newEndMin <= dayEndMin) {
      cascadeCursor = newEndMin + buffer;
      return {
        ...p,
        proposedDate: dateStr,
        proposedStartTime: formatMinutesTo12Hour(newStartMin),
        proposedEndTime: formatMinutesTo12Hour(newEndMin),
        proposedDurationMinutes: dur,
        action: 'shift_same_day',
        approved: true,
        delayMinutes: newStartMin - origStartMin,
        notes: `Shifted +${newStartMin - origStartMin}m today`
      };
    } else {
      const tomSlot = getSmartNextFreeSlot(
        tomorrowStr,
        dur,
        simulatedTomorrowPool,
        [],
        p.taskId,
        buffer
      );

      simulatedTomorrowPool.push({
        id: p.taskId,
        taskDate: tomorrowStr,
        startTime: tomSlot.startTime,
        endTime: tomSlot.endTime,
        appointedMinutes: dur,
        bufferMinutes: buffer,
        status: 'Pending'
      });

      return {
        ...p,
        proposedDate: tomorrowStr,
        proposedStartTime: tomSlot.startTime,
        proposedEndTime: tomSlot.endTime,
        proposedDurationMinutes: dur,
        action: 'defer_tomorrow',
        approved: true,
        notes: `Moved to Tomorrow (${tomorrowStr})`
      };
    }
  });
}

/**
 * Batch Strategy 2: Defer all flexible tasks to a Target Date (Tomorrow +1d or +2d)
 */
export function calculateBatchDeferToTomorrowProposals(
  currentProposals: import('../types').TaskRescheduleProposal[],
  dateStr: string,
  allTasks: any[],
  daysOffset = 1
): import('../types').TaskRescheduleProposal[] {
  const [y, m, d] = dateStr.split('-').map(Number);
  const targetDate = new Date(y, m - 1, d);
  targetDate.setDate(targetDate.getDate() + daysOffset);
  const targetDateStr = toISODateString(targetDate);

  const targetDayTasks = allTasks.filter(t => 
    isTaskScheduledForDate(t, targetDateStr) && 
    t.status !== 'Done' && 
    t.status !== 'Terminated' && 
    !t.isEmergencyBuffer
  );
  const simulatedPool: any[] = [...targetDayTasks];

  return currentProposals.map(p => {
    if (p.isMandatory) return p;

    const origTask = allTasks.find(t => t.id === p.taskId);
    const dur = p.proposedDurationMinutes || p.currentDurationMinutes;
    const buffer = origTask?.bufferMinutes ?? 5;

    const slot = getSmartNextFreeSlot(
      targetDateStr,
      dur,
      simulatedPool,
      [],
      p.taskId,
      buffer
    );

    simulatedPool.push({
      id: p.taskId,
      taskDate: targetDateStr,
      startTime: slot.startTime,
      endTime: slot.endTime,
      appointedMinutes: dur,
      bufferMinutes: buffer,
      status: 'Pending'
    });

    const dayLabel = daysOffset === 1 ? 'Tomorrow' : `+${daysOffset} Days`;

    return {
      ...p,
      proposedDate: targetDateStr,
      proposedStartTime: slot.startTime,
      proposedEndTime: slot.endTime,
      proposedDurationMinutes: dur,
      action: 'defer_tomorrow',
      approved: true,
      notes: `Deferred to ${dayLabel} (${targetDateStr})`
    };
  });
}

/**
 * Batch Strategy 3: Compress duration of flexible tasks to squeeze into remaining today's time
 */
export function calculateBatchCompressProposals(
  currentProposals: import('../types').TaskRescheduleProposal[],
  emergencyEndMin: number,
  dateStr: string,
  allTasks: any[],
  capacitySettings?: { dayStartTime?: string; dayEndTime?: string },
  compressRatio = 0.5 // Default: compress to 50% (minimum 15 mins)
): import('../types').TaskRescheduleProposal[] {
  const rawDayEnd = capacitySettings?.dayEndTime || '11:00 PM';
  const dayEndMin = parse12HourToMinutes(rawDayEnd) || 1380;
  const mandatoryTasks = allTasks.filter(t => isTaskScheduledForDate(t, dateStr) && t.isMandatorySchedule);

  let cascadeCursor = emergencyEndMin;

  return currentProposals.map(p => {
    if (p.isMandatory) return p;

    const origTask = allTasks.find(t => t.id === p.taskId);
    const origDur = p.currentDurationMinutes;
    const compressedDur = Math.max(15, Math.round((origDur * compressRatio) / 5) * 5);
    const buffer = origTask?.bufferMinutes ?? 5;

    const isToday = dateStr === toISODateString(new Date());
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    let newStartMin = cascadeCursor;
    if (isToday) {
      newStartMin = Math.max(newStartMin, nowMin + 1);
    }

    // Jump past mandatory
    let collision = true;
    while (collision) {
      collision = false;
      const newEndMin = newStartMin + compressedDur;
      for (const mand of mandatoryTasks) {
        const mStart = parse12HourToMinutes(mand.startTime);
        const mEnd = parse12HourToMinutes(mand.endTime);
        if (newStartMin < mEnd && newEndMin > mStart) {
          newStartMin = mEnd + (mand.bufferMinutes ?? 5);
          collision = true;
          break;
        }
      }
    }

    const newEndMin = newStartMin + compressedDur;

    if (newEndMin <= dayEndMin) {
      cascadeCursor = newEndMin + buffer;
      return {
        ...p,
        proposedDate: dateStr,
        proposedStartTime: formatMinutesTo12Hour(newStartMin),
        proposedEndTime: formatMinutesTo12Hour(newEndMin),
        proposedDurationMinutes: compressedDur,
        action: 'compress',
        approved: true,
        notes: `Compressed ${origDur}m ➔ ${compressedDur}m`
      };
    } else {
      return {
        ...p,
        action: 'hold',
        approved: true,
        notes: 'Cannot fit even after compression ➔ Hold'
      };
    }
  });
}

export interface RecommendedSlot {
  startTime: string;
  endTime: string;
  label: string;
  durationMinutes: number;
  isContiguousNext?: boolean;
}

/**
 * Calculates the next available free time slot on a given date for a given task duration,
 * accounting for existing tasks (including recurring instances), their post-task buffer time (15 mins),
 * and buffer status notes.
 */
export interface SmartFreeSlotResult {
  startTime: string;
  endTime: string;
  dateStr?: string;
  crossesMidnight?: boolean;
}

/**
 * Checks if a scheduled date and time is earlier than the current moment.
 */
export function isDateTimeBeforeNow(dateStr: string, timeStr: string): { 
  isPast: boolean; 
  diffMinutes: number; 
  currentTimeStr: string; 
  todayStr: string;
} {
  const now = new Date();
  const todayStr = toISODateString(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const currentTimeStr = formatMinutesTo12Hour(nowMinutes);

  if (!dateStr || !timeStr || timeStr === 'All Day') {
    return { isPast: false, diffMinutes: 0, currentTimeStr, todayStr };
  }

  if (dateStr < todayStr) {
    const [y1, m1, d1] = dateStr.split('-').map(Number);
    const [y2, m2, d2] = todayStr.split('-').map(Number);
    const d1Obj = new Date(y1, m1 - 1, d1);
    const d2Obj = new Date(y2, m2 - 1, d2);
    const daysDiff = Math.max(1, Math.round((d2Obj.getTime() - d1Obj.getTime()) / (1000 * 60 * 60 * 24)));
    return {
      isPast: true,
      diffMinutes: daysDiff * 1440,
      currentTimeStr,
      todayStr
    };
  }

  if (dateStr === todayStr) {
    const taskStartMinutes = parse12HourToMinutes(timeStr);
    if (taskStartMinutes < nowMinutes) {
      return {
        isPast: true,
        diffMinutes: nowMinutes - taskStartMinutes,
        currentTimeStr,
        todayStr
      };
    }
  }

  return { isPast: false, diffMinutes: 0, currentTimeStr, todayStr };
}

/**
 * Checks whether selecting an early AM time (e.g. 12:00 AM - 04:59 AM) should roll over to the next day,
 * when the context indicates it follows late-night work (e.g. after an 11:00 PM task or >= 09:00 PM).
 */
export function shouldRolloverToNextDay(
  currentTaskDate: string,
  newStartTime: string,
  previousStartTime?: string,
  existingTasksOnDate: Array<{ startTime: string; endTime: string; status: string }> = []
): { shouldRollover: boolean; nextDateStr: string } {
  const [y, m, d] = currentTaskDate.split('-').map(Number);
  const nextDate = new Date(y, m - 1, d + 1);
  const nextDateStr = toISODateString(nextDate);

  if (!newStartTime || newStartTime === 'All Day') {
    return { shouldRollover: false, nextDateStr };
  }

  const newMin = parse12HourToMinutes(newStartTime);
  // Early morning / midnight window: 12:00 AM (0 min) up to 04:59 AM (299 min)
  const isEarlyAmMidnight = newMin < 300;
  if (!isEarlyAmMidnight) {
    return { shouldRollover: false, nextDateStr };
  }

  // 1. If previous start time was late evening / night (>= 09:00 PM = 1260 mins)
  if (previousStartTime && previousStartTime !== 'All Day') {
    const prevMin = parse12HourToMinutes(previousStartTime);
    if (prevMin >= 1260) {
      return { shouldRollover: true, nextDateStr };
    }
  }

  // 2. If there are tasks on currentTaskDate ending or starting late (>= 09:00 PM = 1260 mins)
  const hasLateTask = existingTasksOnDate.some(t => {
    if (!t.startTime || t.startTime === 'All Day' || t.status === 'Terminated') return false;
    const s = parse12HourToMinutes(t.startTime);
    const e = parse12HourToMinutes(t.endTime);
    return s >= 1260 || e >= 1260;
  });
  if (hasLateTask) {
    return { shouldRollover: true, nextDateStr };
  }

  // 3. If currentTaskDate is today and real-world time right now is late night (>= 09:00 PM = 1260 mins)
  const now = new Date();
  if (currentTaskDate === toISODateString(now)) {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (nowMin >= 1260) {
      return { shouldRollover: true, nextDateStr };
    }
  }

  return { shouldRollover: false, nextDateStr };
}

export interface SuggestedNextSlotResult {
  date: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  period: CircadianPeriodName;
  isNextDay: boolean;
  daysOffset: number;
  reason: string;
  crossesMidnight?: boolean;
  endDate?: string;
  isAfterMidnight?: boolean;
}

/**
 * Intelligently finds the EARLIEST available free time slot (even if it rolls over to the next day or subsequent days),
 * strictly avoiding system sleep time (e.g. 11:00 PM - 06:00 AM) and strictly never suggesting past times.
 */
export function findNextAvailableSlot(
  taskDurationMinutes: number,
  allTasks: Array<{ taskDate: string; startTime: string; endTime: string; bufferMinutes?: number; status: string; recurrence?: string; selectedDays?: string[]; excludedDates?: string[]; id?: string; simultaneousWithIds?: string[] }>,
  capacitySettings?: { dayStartTime?: string; dayEndTime?: string; sleepStartTime?: string; sleepEndTime?: string },
  ignoreTaskId?: string,
  startDateStr?: string,
  preferPm = false,
  bufferGap = 0,
  currentTaskSlot?: CurrentTaskSlotInfo
): SuggestedNextSlotResult | null {
  const now = new Date();
  const todayStr = toISODateString(now);

  const sleepStartStr = capacitySettings?.sleepStartTime || capacitySettings?.dayEndTime || '11:00 PM';
  const sleepEndStr = capacitySettings?.sleepEndTime || capacitySettings?.dayStartTime || '06:00 AM';
  const wakingStartMin = parse12HourToMinutes(sleepEndStr);
  let wakingEndMin = parse12HourToMinutes(sleepStartStr);
  if (wakingEndMin <= wakingStartMin) wakingEndMin += 1440;

  const curHourMin = now.getHours() * 60 + now.getMinutes();

  // If a startDateStr was requested that is in the future, start counting from that date
  const baseDate = startDateStr && startDateStr > todayStr ? new Date(startDateStr + 'T00:00:00') : new Date();

  const targetTaskId = currentTaskSlot?.id || ignoreTaskId;
  const targetSimultaneousIds = currentTaskSlot?.simultaneousWithIds || [];

  // Scan up to 60 days to find earliest available slot
  for (let offset = 0; offset <= 60; offset++) {
    const scanDate = new Date(baseDate);
    scanDate.setDate(scanDate.getDate() + offset);
    const dateStr = toISODateString(scanDate);
    const dayOfWeek = getDayOfWeekFromDate(dateStr);
    const isToday = dateStr === todayStr;

    let earliestAllowed = wakingStartMin;

    if (isToday) {
      // Check if current moment is inside system sleep window
      const nowStart = formatMinutesTo12Hour(curHourMin);
      const nowEnd = formatMinutesTo12Hour(curHourMin + 15);
      const isCurrentlySleepTime = isTimeInSleepWindow(nowStart, nowEnd, sleepStartStr, sleepEndStr);

      if (isCurrentlySleepTime) {
        // Late night sleep hours (e.g. 11:00 PM - 11:59 PM): Today has ended! Rollover to tomorrow
        if (curHourMin >= wakingEndMin - 15 || curHourMin >= 1320) {
          continue;
        }
        // Early morning sleep hours (e.g. 00:00 AM - 05:59 AM): Waking hours begin at wakingStartMin today
        earliestAllowed = wakingStartMin;
      } else {
        // Normal daytime hours today: Must start in future (now + 5 mins, rounded up)
        const futureRounded = Math.ceil((curHourMin + 5) / 5) * 5;
        earliestAllowed = Math.max(wakingStartMin, futureRounded);
      }

      // If there is an active running task right now, no slot can start before that task completes
      const activeWorkingTask = allTasks.find(t => 
        t.status === 'Working' && 
        isTaskScheduledForDate(t, todayStr)
      );
      if (activeWorkingTask) {
        let aEnd = parse12HourToMinutes(activeWorkingTask.endTime);
        const aStart = parse12HourToMinutes(activeWorkingTask.startTime);
        if (aEnd < aStart) aEnd += 1440;
        if (wakingEndMin > 1440 && aStart < wakingStartMin) aEnd += 1440;
        const aEndWithBuf = aEnd + (activeWorkingTask.bufferMinutes !== undefined ? activeWorkingTask.bufferMinutes : bufferGap);
        earliestAllowed = Math.max(earliestAllowed, aEndWithBuf);
      }

      if (preferPm && earliestAllowed < 720) {
        earliestAllowed = 720;
      }

      // If cannot fit duration today before bedtime, skip to next day
      if (earliestAllowed + taskDurationMinutes > wakingEndMin) {
        continue;
      }
    } else {
      // Future day: Start from waking start (or 12:00 PM if preferPm)
      if (preferPm && earliestAllowed < 720) {
        earliestAllowed = 720;
      }
    }

    // Filter tasks that block available time:
    // Only non-simultaneous tasks block.
    // The task being rescheduled itself is moving away, so it does NOT block the search
    const dayTasks = allTasks.filter(t => {
      if (!isTaskScheduledForDate(t, dateStr)) return false;
      if (t.status === 'Terminated' || t.status === 'Done') return false;
      if (!t.startTime || !t.endTime || t.startTime === 'All Day') return false;

      // If t is the task being rescheduled:
      if (targetTaskId && t.id === targetTaskId) {
        return false;
      }

      // If simultaneous with target task, it does not block (simultaneous tasks zone)
      const isSimultaneous = Boolean(
        (targetSimultaneousIds.length > 0 && t.id && targetSimultaneousIds.includes(t.id)) ||
        (t.simultaneousWithIds && targetTaskId && t.simultaneousWithIds.includes(targetTaskId))
      );
      if (isSimultaneous) {
        return false;
      }

      return true;
    });

    // Merge intervals
    const intervals = dayTasks.map(t => {
      let s = parse12HourToMinutes(t.startTime);
      let e = parse12HourToMinutes(t.endTime);
      if (e < s) e += 1440;
      if (wakingEndMin > 1440 && s < wakingStartMin) {
        s += 1440;
        e += 1440;
      }
      const buf = t.bufferMinutes !== undefined ? t.bufferMinutes : bufferGap;
      return { start: s, end: e + buf };
    }).sort((a, b) => a.start - b.start);

    const merged: { start: number; end: number }[] = [];
    for (const interval of intervals) {
      if (merged.length === 0) {
        merged.push({ ...interval });
      } else {
        const last = merged[merged.length - 1];
        if (interval.start <= last.end) {
          last.end = Math.max(last.end, interval.end);
        } else {
          merged.push({ ...interval });
        }
      }
    }

    // Helper to validate slot candidate
    const isValidCandidate = (startMin: number): boolean => {
      const slotStartStr = formatMinutesTo12Hour(startMin);
      const slotEndStr = formatMinutesTo12Hour(startMin + taskDurationMinutes);

      if (isTimeInSleepWindow(slotStartStr, slotEndStr, sleepStartStr, sleepEndStr)) {
        return false;
      }

      if (isToday && startMin < curHourMin + 5) {
        return false;
      }

      // Skip the exact same unchanged start time on the same date
      if (currentTaskSlot && dateStr === currentTaskSlot.date && slotStartStr === currentTaskSlot.startTime) {
        return false;
      }

      return true;
    };

    // Look for first gap that fits taskDurationMinutes outside sleep window
    let cursor = earliestAllowed;
    let foundSlot: { start: number; end: number } | null = null;

    for (const block of merged) {
      if (block.start > cursor) {
        const gapStart = Math.max(cursor, earliestAllowed);
        const gapEnd = Math.min(block.start, wakingEndMin);
        if (gapEnd - gapStart >= taskDurationMinutes) {
          if (isValidCandidate(gapStart)) {
            foundSlot = { start: gapStart, end: gapStart + taskDurationMinutes };
            break;
          }
        }
      }
      cursor = Math.max(cursor, block.end);
    }

    if (!foundSlot && cursor < wakingEndMin) {
      const gapStart = Math.max(cursor, earliestAllowed);
      if (wakingEndMin - gapStart >= taskDurationMinutes) {
        if (isValidCandidate(gapStart)) {
          foundSlot = { start: gapStart, end: gapStart + taskDurationMinutes };
        }
      }
    }

    if (foundSlot) {
      const daysToAdd = Math.floor(foundSlot.start / 1440);
      let slotDateStr = dateStr;
      let slotDayOfWeek = dayOfWeek;
      if (daysToAdd > 0) {
        const [y, m, d] = dateStr.split('-').map(Number);
        const nextDateObj = new Date(y, m - 1, d + daysToAdd);
        slotDateStr = toISODateString(nextDateObj);
        slotDayOfWeek = getDayOfWeekFromDate(slotDateStr);
      }

      const startStr = formatMinutesTo12Hour(foundSlot.start);
      const endStr = formatMinutesTo12Hour(foundSlot.end);
      const period: CircadianPeriodName = getStandardCircadianPeriod(foundSlot.start);
      const isNextDay = slotDateStr > todayStr;
      const actualOffset = Math.round((new Date(slotDateStr + 'T00:00:00').getTime() - new Date(todayStr + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24));

      const crosses = (foundSlot.start % 1440) + taskDurationMinutes > 1440;
      let calculatedEndDate = slotDateStr;
      if (crosses) {
        const [sy, sm, sd] = slotDateStr.split('-').map(Number);
        calculatedEndDate = toISODateString(new Date(sy, sm - 1, sd + 1));
      }

      return {
        date: slotDateStr,
        dayOfWeek: slotDayOfWeek,
        startTime: startStr,
        endTime: endStr,
        durationMinutes: taskDurationMinutes,
        period,
        isNextDay,
        daysOffset: actualOffset,
        reason: isNextDay 
          ? `🌅 Next Day Slot on ${slotDayOfWeek} (${slotDateStr})` 
          : '⚡ Earliest Available Free Slot Today',
        crossesMidnight: crosses,
        endDate: calculatedEndDate,
        isAfterMidnight: daysToAdd > 0
      };
    }
  }

  return null;
}

export function getSmartNextFreeSlot(
  dateStr: string,
  durationMinutes: number,
  tasks: Array<{ taskDate: string; startTime: string; endTime: string; status: string; bufferMinutes?: number; recurrence?: string; selectedDays?: string[]; excludedDates?: string[]; id?: string }>,
  bufferNotes: Array<{ date?: string; startTime: string; endTime: string }> = [],
  ignoreTaskId?: string,
  bufferGap = 15,
  capacitySettings?: { dayStartTime?: string; dayEndTime?: string; sleepStartTime?: string; sleepEndTime?: string; preferPm?: boolean },
  preferPm = false
): SmartFreeSlotResult {
  const result = findNextAvailableSlot(
    durationMinutes,
    tasks,
    capacitySettings,
    ignoreTaskId,
    dateStr,
    preferPm,
    bufferGap
  );

  if (result) {
    return {
      startTime: result.startTime,
      endTime: result.endTime,
      dateStr: result.date,
      crossesMidnight: result.isNextDay
    };
  }

  // Fallback to tomorrow waking start
  const tom = new Date();
  tom.setDate(tom.getDate() + 1);
  const tomStr = toISODateString(tom);
  const wakingStart = capacitySettings?.sleepEndTime || capacitySettings?.dayStartTime || '06:00 AM';
  return {
    startTime: wakingStart,
    endTime: addMinutesToTime(wakingStart, durationMinutes),
    dateStr: tomStr,
    crossesMidnight: true
  };
}

/**
 * Returns candidate recommended free slots across the day (Next Contiguous, Afternoon PM, Evening PM, Morning AM)
 * Strictly guarantees ZERO recommendations inside the Sleep Window or in the past.
 */
export function getRecommendedDayFreeSlots(
  dateStr: string,
  durationMinutes: number,
  tasks: Array<{ taskDate: string; startTime: string; endTime: string; status: string; bufferMinutes?: number; recurrence?: string; selectedDays?: string[]; excludedDates?: string[]; id?: string }>,
  bufferNotes: Array<{ date?: string; startTime: string; endTime: string }> = [],
  ignoreTaskId?: string,
  limit = 10,
  bufferGap = 15,
  capacitySettings?: { dayStartTime?: string; dayEndTime?: string; sleepStartTime?: string; sleepEndTime?: string; preferPm?: boolean }
): RecommendedSlot[] {
  const now = new Date();
  const todayStr = toISODateString(now);

  // Strictly reject past dates
  if (dateStr < todayStr) {
    return [];
  }

  const sleepStartStr = capacitySettings?.sleepStartTime || capacitySettings?.dayEndTime || '11:00 PM';
  const sleepEndStr = capacitySettings?.sleepEndTime || capacitySettings?.dayStartTime || '06:00 AM';
  const wakingStartMin = parse12HourToMinutes(sleepEndStr);
  let wakingEndMin = parse12HourToMinutes(sleepStartStr);
  if (wakingEndMin <= wakingStartMin) {
    wakingEndMin += 1440;
  }

  const isToday = dateStr === todayStr;
  let nowMin = 0;
  let minFutureMin = 0;
  if (isToday) {
    nowMin = now.getHours() * 60 + now.getMinutes();
    if (wakingEndMin > 1440 && nowMin < wakingStartMin) {
      nowMin += 1440;
    }
    minFutureMin = Math.ceil((nowMin + 5) / 15) * 15;
  }

  const slots: RecommendedSlot[] = [];

  // Attempt smartNext contiguous slot
  if (!isToday || minFutureMin + durationMinutes <= wakingEndMin) {
    const smartNext = getSmartNextFreeSlot(dateStr, durationMinutes, tasks, bufferNotes, ignoreTaskId, bufferGap, capacitySettings);

    if (
      smartNext.dateStr === dateStr &&
      (!isToday || (() => {
        let snStart = parse12HourToMinutes(smartNext.startTime);
        if (wakingEndMin > 1440 && snStart < wakingStartMin) snStart += 1440;
        return snStart >= minFutureMin;
      })()) &&
      !isTimeInSleepWindow(smartNext.startTime, smartNext.endTime, sleepStartStr, sleepEndStr)
    ) {
      const isPm = smartNext.startTime.includes('PM');
      slots.push({
        startTime: smartNext.startTime,
        endTime: smartNext.endTime,
        label: isPm ? '⚡ Next Available (PM)' : '⚡ Next Available (AM)',
        durationMinutes,
        isContiguousNext: true
      });
    }
  }

  const activeTasks = tasks.filter(t => 
    t.id !== ignoreTaskId &&
    t.status !== 'Terminated' && 
    t.status !== 'Reschedule' &&
    t.startTime && 
    t.endTime && 
    t.startTime !== 'All Day' &&
    isTaskScheduledForDate(t, dateStr)
  );
  const dayBufferNotes = bufferNotes.filter(b => !b.date || b.date === dateStr);
  const gaps = findScheduleGaps(
    activeTasks, 
    capacitySettings?.dayStartTime || '06:00 AM', 
    capacitySettings?.dayEndTime || '11:00 PM', 
    dayBufferNotes, 
    bufferGap,
    sleepStartStr,
    sleepEndStr
  );

  // 1. Gather all non-sleep gaps across this date
  for (const gap of gaps) {
    let gStart = parse12HourToMinutes(gap.startTime);
    let gEnd = parse12HourToMinutes(gap.endTime);
    if (gEnd <= gStart) gEnd += 1440;
    if (wakingEndMin > 1440 && gStart < wakingStartMin) {
      gStart += 1440;
      gEnd += 1440;
    }

    const usableStart = Math.max(gStart, isToday ? minFutureMin : gStart);
    if (usableStart + durationMinutes <= gEnd) {
      const candidateStart = formatMinutesTo12Hour(usableStart);
      const candidateEnd = formatMinutesTo12Hour(usableStart + durationMinutes);

      // Strictly ensure candidate is NOT in sleep window
      if (!isTimeInSleepWindow(candidateStart, candidateEnd, sleepStartStr, sleepEndStr)) {
        if (!slots.some(s => s.startTime === candidateStart) && slots.length < limit) {
          const normHour = ((usableStart % 1440) + 1440) % 1440;
          const cp = getStandardCircadianPeriod(normHour);
          let label = 'Free Gap';
          if (cp === 'Night') label = '🌙 Night (AM)';
          else if (cp === 'Morning') label = '☀️ Morning (AM)';
          else if (cp === 'Afternoon') label = '🌤️ Afternoon (PM)';
          else label = '🌆 Evening (PM)';

          slots.push({
            startTime: candidateStart,
            endTime: candidateEnd,
            label,
            durationMinutes
          });
        }
      }

      // Step inside gap every 30m or durationMinutes to offer dense starting times
      const stepDelta = Math.max(15, Math.min(30, Math.floor(durationMinutes)));
      let nextStep = usableStart + stepDelta;
      while (nextStep + durationMinutes <= gEnd && slots.length < limit) {
        const candStart = formatMinutesTo12Hour(nextStep);
        const candEnd = formatMinutesTo12Hour(nextStep + durationMinutes);
        if (!isTimeInSleepWindow(candStart, candEnd, sleepStartStr, sleepEndStr)) {
          if (!slots.some(s => s.startTime === candStart)) {
            const normHour = ((nextStep % 1440) + 1440) % 1440;
            const cp = getStandardCircadianPeriod(normHour);
            let label = 'Free Slot';
            if (cp === 'Night') label = '🌙 Night (AM)';
            else if (cp === 'Morning') label = '☀️ Morning (AM)';
            else if (cp === 'Afternoon') label = '🌤️ Afternoon (PM)';
            else label = '🌆 Evening (PM)';

            slots.push({
              startTime: candStart,
              endTime: candEnd,
              label,
              durationMinutes
            });
          }
        }
        nextStep += stepDelta;
      }
    }
  }

  // 2. Guarantee candidate daytime anchor slots across the whole waking day if still under limit
  const testCandidateSlots = [
    { startMin: 540, label: '🌅 Morning (09:00 AM)' },
    { startMin: 600, label: '☀️ Morning (10:00 AM)' },
    { startMin: 660, label: '☀️ Morning (11:00 AM)' },
    { startMin: 720, label: '☀️ Midday (12:00 PM)' },
    { startMin: 780, label: '🌤️ Afternoon (01:00 PM)' },
    { startMin: 840, label: '🌤️ Afternoon (02:00 PM)' },
    { startMin: 900, label: '🌤️ Afternoon (03:00 PM)' },
    { startMin: 960, label: '🌤️ Afternoon (04:00 PM)' },
    { startMin: 1020, label: '🌆 Evening (05:00 PM)' },
    { startMin: 1080, label: '🌆 Evening (06:00 PM)' },
    { startMin: 1140, label: '🌆 Evening (07:00 PM)' },
    { startMin: 1200, label: '🌙 Night (08:00 PM)' },
    { startMin: 1260, label: '🌙 Night (09:00 PM)' },
    { startMin: 1320, label: '🌙 Night (10:00 PM)' },
    { startMin: 1380, label: '🌙 Night (11:00 PM)' },
    { startMin: 1445, label: '🌙 Deep Night (12:05 AM)' },
    { startMin: 1500, label: '🌙 Deep Night (01:00 AM)' }
  ];

  for (const tSlot of testCandidateSlots) {
    if (slots.length >= limit) break;
    let sMin = tSlot.startMin;
    if (wakingEndMin > 1440 && sMin < wakingStartMin) sMin += 1440;

    const startStr = formatMinutesTo12Hour(sMin);
    const endStr = formatMinutesTo12Hour(sMin + durationMinutes);

    if (isToday && sMin < minFutureMin) continue;
    if (isTimeInSleepWindow(startStr, endStr, sleepStartStr, sleepEndStr)) continue;

    // Check if slot conflicts with any active task on this date
    const hasConflict = activeTasks.some(t => {
      let tsStart = parse12HourToMinutes(t.startTime);
      let tsEnd = parse12HourToMinutes(t.endTime);
      if (tsEnd <= tsStart) tsEnd += 1440;
      if (wakingEndMin > 1440 && tsStart < wakingStartMin) {
        tsStart += 1440;
        tsEnd += 1440;
      }
      return Math.max(sMin, tsStart) < Math.min(sMin + durationMinutes, tsEnd);
    });

    if (!hasConflict && !slots.some(s => s.startTime === startStr)) {
      slots.push({
        startTime: startStr,
        endTime: endStr,
        label: tSlot.label,
        durationMinutes
      });
    }
  }

  // 3. If still under limit, scan into tomorrow to fulfill at least 10 slots
  if (slots.length < limit) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const nextDate = new Date(y, m - 1, d + 1);
    const nextDateStr = toISODateString(nextDate);

    const nextActiveTasks = tasks.filter(t => 
      t.id !== ignoreTaskId &&
      t.status !== 'Terminated' && 
      t.status !== 'Reschedule' &&
      t.startTime && 
      t.endTime && 
      t.startTime !== 'All Day' &&
      isTaskScheduledForDate(t, nextDateStr)
    );
    const nextDayBuffers = bufferNotes.filter(b => !b.date || b.date === nextDateStr);
    const nextGaps = findScheduleGaps(
      nextActiveTasks,
      capacitySettings?.dayStartTime || '06:00 AM',
      capacitySettings?.dayEndTime || '11:00 PM',
      nextDayBuffers,
      bufferGap,
      sleepStartStr,
      sleepEndStr
    );

    for (const ng of nextGaps) {
      if (slots.length >= limit) break;
      let ngStart = parse12HourToMinutes(ng.startTime);
      let ngEnd = parse12HourToMinutes(ng.endTime);
      if (ngEnd <= ngStart) ngEnd += 1440;

      if (ngStart + durationMinutes <= ngEnd) {
        const candStart = formatMinutesTo12Hour(ngStart);
        const candEnd = formatMinutesTo12Hour(ngStart + durationMinutes);
        if (!isTimeInSleepWindow(candStart, candEnd, sleepStartStr, sleepEndStr)) {
          if (!slots.some(s => s.startTime === candStart)) {
            slots.push({
              startTime: candStart,
              endTime: candEnd,
              label: `Tomorrow • ${candStart}`,
              durationMinutes
            });
          }
        }
      }
    }
  }

  return slots;
}

/**
 * Determines whether a time interval [taskStart, taskEnd] overlaps with the configured Sleep / Night window.
 * Handles cases where the sleep window crosses midnight (e.g. 11:00 PM to 06:00 AM).
 */
export function isTimeInSleepWindow(
  startTimeStr: string,
  endTimeStr: string,
  sleepStartTimeStr = '11:00 PM',
  sleepEndTimeStr = '06:00 AM'
): boolean {
  if (!startTimeStr || !endTimeStr || startTimeStr === 'All Day') return false;

  const tStart = parse12HourToMinutes(startTimeStr);
  let tEnd = parse12HourToMinutes(endTimeStr);
  if (tEnd <= tStart) tEnd += 1440;

  const sStart = parse12HourToMinutes(sleepStartTimeStr);
  let sEnd = parse12HourToMinutes(sleepEndTimeStr);

  // If sleep window crosses midnight (e.g. 11:00 PM / 1380 to 06:00 AM / 360)
  if (sEnd <= sStart) {
    // Check morning overlap: any portion of task in [0, sEnd)
    const morningOverlap = (tStart < sEnd) || (tEnd > 1440 && (tEnd - 1440) > 0 && tStart < 1440);
    // Check evening overlap: any portion of task in [sStart, 1440)
    const eveningOverlap = (tStart >= sStart && tStart < 1440) || (tStart < sStart && tEnd > sStart);

    return morningOverlap || eveningOverlap;
  } else {
    // Non-crossing sleep (e.g., 01:00 AM to 08:00 AM)
    return Math.max(tStart, sStart) < Math.min(tEnd, sEnd);
  }
}

/**
 * Checks whether a task falls inside or overlaps with the configured sleep window.
 */
export function isTaskInSleepWindow(
  task: { startTime?: string; endTime?: string; isAllDay?: boolean },
  capacitySettings?: { dayStartTime?: string; dayEndTime?: string; sleepStartTime?: string; sleepEndTime?: string }
): boolean {
  if (!task.startTime || !task.endTime || task.startTime === 'All Day' || task.isAllDay) return false;
  const sleepStart = capacitySettings?.sleepStartTime || capacitySettings?.dayEndTime || '11:00 PM';
  const sleepEnd = capacitySettings?.sleepEndTime || capacitySettings?.dayStartTime || '06:00 AM';
  return isTimeInSleepWindow(task.startTime, task.endTime, sleepStart, sleepEnd);
}

/**
 * Returns the NamedTimePeriod for a given 12-hour time string (e.g. "09:30 AM" -> Morning).
 * Calculate duration of a NamedTimePeriod in minutes (handles overnight periods).
 */
export function getPeriodDurationMinutes(period: NamedTimePeriod): number {
  const startMin = parse12HourToMinutes(period.startTime);
  const endMin = parse12HourToMinutes(period.endTime);
  if (startMin <= endMin) {
    return (endMin - startMin) || 1440;
  } else {
    return (1440 - startMin) + endMin;
  }
}

/**
 * Returns the NamedTimePeriod for a given 12-hour or 24-hour time string (e.g. "09:30 AM" -> Morning).
 * Accurately accounts for normal periods and cross-midnight periods.
 * When multiple periods overlap, intelligently picks the most specific (shortest duration) period,
 * guaranteeing that newly added custom sub-zones always work throughout the app!
 */
export function getTimePeriodForTime(
  timeStr: string,
  periodsOrSettings?: NamedTimePeriod[] | TimePeriodSettings
): NamedTimePeriod | null {
  if (!timeStr || timeStr === 'All Day') return null;
  const targetMin = parse12HourToMinutes(timeStr);
  if (isNaN(targetMin)) return null;

  if (!periodsOrSettings) return null;

  let periodList: NamedTimePeriod[];
  if ('isEnabled' in periodsOrSettings) {
    if (!periodsOrSettings.isEnabled) return null;
    periodList = periodsOrSettings.periods || [];
  } else {
    periodList = periodsOrSettings;
  }

  if (!periodList || periodList.length === 0) return null;

  // Filter out any blank or incomplete periods
  const validPeriods = periodList.filter(p => p.startTime && p.endTime);
  if (validPeriods.length === 0) return null;

  // Collect all matching periods with their durations
  const matches: { period: NamedTimePeriod; duration: number }[] = [];

  for (const period of validPeriods) {
    const startMin = parse12HourToMinutes(period.startTime);
    const endMin = parse12HourToMinutes(period.endTime);
    const duration = getPeriodDurationMinutes(period);

    if (startMin <= endMin) {
      // Normal within-day range (e.g. 05:00 AM to 09:00 AM)
      // Check both clean boundary [startMin, endMin) and legacy inclusive [startMin, endMin]
      const isClean = endMin % 5 === 0;
      const isMatch = isClean 
        ? (targetMin >= startMin && targetMin < endMin)
        : (targetMin >= startMin && targetMin <= endMin);

      if (isMatch) {
        matches.push({ period, duration });
      }
    } else {
      // Overnight / cross-midnight range (e.g. 08:00 PM to 02:00 AM)
      const isClean = endMin % 5 === 0;
      const isMatch = isClean
        ? (targetMin >= startMin || targetMin < endMin)
        : (targetMin >= startMin || targetMin <= endMin);

      if (isMatch) {
        matches.push({ period, duration });
      }
    }
  }

  if (matches.length > 0) {
    // Pick the most specific (shortest duration) period so custom zones take priority over broad umbrella zones!
    matches.sort((a, b) => a.duration - b.duration);
    return matches[0].period;
  }

  // Fallback 1: Exact match on boundary minute (e.g. targetMin === startMin or endMin)
  for (const period of validPeriods) {
    const startMin = parse12HourToMinutes(period.startTime);
    const endMin = parse12HourToMinutes(period.endTime);
    if (targetMin === startMin || targetMin === endMin) {
      return period;
    }
  }

  // Fallback 2: Find the nearest enclosing or preceding period so that there are never unmapped dead zones
  let bestPeriod = validPeriods[0];
  let minDiff = Infinity;
  for (const period of validPeriods) {
    const startMin = parse12HourToMinutes(period.startTime);
    const diff = (targetMin - startMin + 1440) % 1440;
    if (diff < minDiff) {
      minDiff = diff;
      bestPeriod = period;
    }
  }
  return bestPeriod;
}

export function getTimePeriodName(
  timeStr: string,
  periodsOrSettings?: NamedTimePeriod[] | TimePeriodSettings
): string | null {
  const match = getTimePeriodForTime(timeStr, periodsOrSettings);
  return match ? match.name : null;
}
