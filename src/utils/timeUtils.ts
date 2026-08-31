/**
 * Time utility functions for OptimusTime Time-Boxing and Automation Engines
 */

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

// Convert "09:30 AM" or "02:15 PM" to minutes from midnight (0..1439)
export function parse12HourToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const cleaned = timeStr.trim().toUpperCase();
  const match = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (!match) return 0;
  
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3];

  if (period === 'AM') {
    if (hours === 12) hours = 0;
  } else if (period === 'PM') {
    if (hours !== 12) hours += 12;
  }
  return hours * 60 + minutes;
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

// Add minutes to a 12-hour AM/PM string
export function addMinutesToTime(timeStr: string, minutesToAdd: number): string {
  const currentMin = parse12HourToMinutes(timeStr);
  return formatMinutesTo12Hour(currentMin + minutesToAdd);
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

// Format date into standard display format e.g. "31 August 2026 (Monday)"
export function formatHeaderDate(date: Date = new Date()): string {
  const day = date.getDate().toString().padStart(2, '0');
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  const dayName = DAYS_OF_WEEK[date.getDay()];

  return `${day} ${month} ${year} (${dayName})`;
}

// Format date to YYYY-MM-DD
export function toISODateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
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

export interface TimeGap {
  startTime: string;
  endTime: string;
  durationMinutes: number;
}

// Find empty gaps between scheduled tasks for a day
export function findScheduleGaps(
  tasks: Array<{ startTime: string; endTime: string; status: string }>,
  dayStartTime = '06:00 AM',
  dayEndTime = '11:00 PM'
): TimeGap[] {
  const activeTasks = tasks.filter(t => t.status !== 'Terminated' && t.startTime && t.endTime);
  if (activeTasks.length === 0) {
    const startMin = parse12HourToMinutes(dayStartTime);
    const endMin = parse12HourToMinutes(dayEndTime);
    if (endMin > startMin) {
      return [{
        startTime: dayStartTime,
        endTime: dayEndTime,
        durationMinutes: endMin - startMin
      }];
    }
    return [];
  }

  // Sort intervals by start time
  const intervals = activeTasks.map(t => {
    const s = parse12HourToMinutes(t.startTime);
    let e = parse12HourToMinutes(t.endTime);
    if (e < s) e += 1440;
    return { start: s, end: e };
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

  const dayStartMin = parse12HourToMinutes(dayStartTime);
  const dayEndMin = parse12HourToMinutes(dayEndTime);
  const gaps: TimeGap[] = [];

  let cursor = dayStartMin;

  for (const block of merged) {
    if (block.start > cursor) {
      const gapDuration = block.start - cursor;
      if (gapDuration >= 10) { // Highlight gaps >= 10 mins
        gaps.push({
          startTime: formatMinutesTo12Hour(cursor),
          endTime: formatMinutesTo12Hour(block.start),
          durationMinutes: gapDuration
        });
      }
    }
    cursor = Math.max(cursor, block.end);
  }

  if (cursor < dayEndMin) {
    const gapDuration = dayEndMin - cursor;
    if (gapDuration >= 10) {
      gaps.push({
        startTime: formatMinutesTo12Hour(cursor),
        endTime: formatMinutesTo12Hour(dayEndMin),
        durationMinutes: gapDuration
      });
    }
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
export function isTaskScheduledForDate(task: {
  taskDate: string;
  recurrence?: string;
  selectedDays?: string[];
}, targetDateStr: string): boolean {
  if (!task.taskDate || !targetDateStr) return false;

  // Exact match always matches
  if (task.taskDate === targetDateStr) return true;

  // A recurring task only applies on or after its creation/start date
  if (targetDateStr < task.taskDate) return false;

  const recurrence = task.recurrence || 'None';
  if (recurrence === 'None') {
    return task.taskDate === targetDateStr;
  }

  if (recurrence === 'Daily') {
    return true;
  }

  const [tYear, tMonth, tDay] = targetDateStr.split('-').map(Number);
  const targetDateObj = new Date(tYear, tMonth - 1, tDay);
  const targetDayShort = SHORT_DAYS[targetDateObj.getDay()]; // e.g. "Mon"
  const targetDayFull = DAYS_OF_WEEK[targetDateObj.getDay()]; // e.g. "Monday"

  if (recurrence === 'Selected Days') {
    if (!task.selectedDays || task.selectedDays.length === 0) return true;
    return task.selectedDays.some(d => d === targetDayShort || d === targetDayFull);
  }

  const [sYear, sMonth, sDay] = task.taskDate.split('-').map(Number);
  const sourceDateObj = new Date(sYear, sMonth - 1, sDay);

  if (recurrence === 'Weekly') {
    return targetDateObj.getDay() === sourceDateObj.getDay();
  }

  if (recurrence === 'Monthly') {
    return tDay === sDay;
  }

  if (recurrence === 'Yearly') {
    return tMonth === sMonth && tDay === sDay;
  }

  return false;
}

export interface AvailableSlotResult {
  date: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  scheduledMinutesOnDay: number;
  remainingCapacityMinutes: number;
  isRedLine: boolean;
  reason?: string;
}

/**
 * Finds the earliest available conflict-free slot for a given duration on a target date,
 * respecting already scheduled tasks + breaks/buffers.
 */
export function findAvailableSlotOnDate(
  dateStr: string,
  durationMinutes: number,
  allTasks: Array<{ taskDate: string; startTime: string; endTime: string; bufferMinutes?: number; status: string; recurrence?: string; selectedDays?: string[] }>,
  dayStartTime = '06:00 AM',
  dayEndTime = '11:00 PM',
  earliestAllowedMinutes?: number
): AvailableSlotResult | null {
  const dayStartMin = parse12HourToMinutes(dayStartTime);
  const dayEndMin = parse12HourToMinutes(dayEndTime);
  
  // Filter active tasks occurring on dateStr (using isTaskScheduledForDate)
  const dayTasks = allTasks.filter(t => 
    isTaskScheduledForDate(t, dateStr) && 
    t.status !== 'Terminated' && 
    t.status !== 'Done' && 
    t.startTime && 
    t.endTime &&
    t.startTime !== 'All Day'
  );

  const scheduledMinutesOnDay = dayTasks.reduce((sum, t) => {
    return sum + Math.max(15, diffTimeInMinutes(t.startTime, t.endTime));
  }, 0);

  // Intervals including task + buffer
  const intervals = dayTasks.map(t => {
    const s = parse12HourToMinutes(t.startTime);
    let e = parse12HourToMinutes(t.endTime);
    if (e < s) e += 1440;
    const buf = t.bufferMinutes ?? 15;
    return { start: s, end: e + buf };
  }).sort((a, b) => a.start - b.start);

  // Merge intervals
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

  let cursor = Math.max(dayStartMin, earliestAllowedMinutes ?? dayStartMin);
  let foundStart: number | null = null;

  for (const block of merged) {
    if (block.start > cursor) {
      const gap = block.start - cursor;
      if (gap >= durationMinutes) {
        foundStart = cursor;
        break;
      }
    }
    cursor = Math.max(cursor, block.end);
  }

  if (foundStart === null) {
    if (cursor + durationMinutes <= dayEndMin) {
      foundStart = cursor;
    }
  }

  if (foundStart === null) {
    return null; // Day is completely full
  }

  const foundEnd = foundStart + durationMinutes;
  const dayOfWeek = getDayOfWeekFromDate(dateStr);
  const remainingCapacity = Math.max(0, (14 * 60) - scheduledMinutesOnDay - durationMinutes);

  return {
    date: dateStr,
    dayOfWeek,
    startTime: formatMinutesTo12Hour(foundStart),
    endTime: formatMinutesTo12Hour(foundEnd),
    scheduledMinutesOnDay,
    remainingCapacityMinutes: remainingCapacity,
    isRedLine: (scheduledMinutesOnDay + durationMinutes) > (14 * 60)
  };
}


