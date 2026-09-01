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

// Get current local time in 12-hour AM/PM format, rounded to nearest step (default: 15 minutes)
export function getCurrentRoundedTime12Hour(stepMinutes = 15): string {
  const now = new Date();
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

/**
 * Calculates the next occurrence ISO date string for a recurring task after `fromDateStr`.
 */
export function getNextRecurrenceDate(task: {
  taskDate: string;
  recurrence?: string;
  selectedDays?: string[];
}, fromDateStr: string): string {
  const recurrence = task.recurrence || 'None';
  if (recurrence === 'None') return fromDateStr;

  const [year, month, day] = fromDateStr.split('-').map(Number);
  const current = new Date(year, month - 1, day);

  if (recurrence === 'Daily') {
    current.setDate(current.getDate() + 1);
    return toISODateString(current);
  }

  if (recurrence === 'Selected Days') {
    for (let i = 1; i <= 14; i++) {
      const nextDate = new Date(year, month - 1, day + i);
      const nextDateStr = toISODateString(nextDate);
      if (isTaskScheduledForDate(task, nextDateStr)) {
        return nextDateStr;
      }
    }
    current.setDate(current.getDate() + 1);
    return toISODateString(current);
  }

  if (recurrence === 'Weekly') {
    current.setDate(current.getDate() + 7);
    return toISODateString(current);
  }

  if (recurrence === 'Monthly') {
    current.setMonth(current.getMonth() + 1);
    return toISODateString(current);
  }

  if (recurrence === 'Yearly') {
    current.setFullYear(current.getFullYear() + 1);
    return toISODateString(current);
  }

  return fromDateStr;
}

export interface AvailableSlotResult {
  date: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  scheduledMinutesOnDay: number;
  remainingCapacityMinutes: number;
  isRedLine: boolean;
  period?: 'Morning' | 'Afternoon' | 'Evening';
  reason?: string;
}

/**
 * Finds MULTIPLE conflict-free available slots on a target date, strictly within waking hours [dayStartTime, dayEndTime],
 * completely avoiding sleep time, respecting existing tasks + buffers.
 */
export function findAllAvailableSlotsOnDate(
  dateStr: string,
  durationMinutes: number,
  allTasks: Array<{ taskDate: string; startTime: string; endTime: string; bufferMinutes?: number; status: string; recurrence?: string; selectedDays?: string[] }>,
  dayStartTime = '06:00 AM',
  dayEndTime = '11:00 PM',
  earliestAllowedMinutes?: number,
  maxSlotsPerDay = 5
): AvailableSlotResult[] {
  const dayStartMin = parse12HourToMinutes(dayStartTime);
  let dayEndMin = parse12HourToMinutes(dayEndTime);
  if (dayEndMin <= dayStartMin) dayEndMin += 1440;

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

  // Find all free gaps strictly within waking hours (without sleep time)
  const effectiveStart = Math.max(dayStartMin, earliestAllowedMinutes ?? dayStartMin);
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

  for (const gap of gaps) {
    if (results.length >= maxSlotsPerDay) break;

    // Add earliest slot in this gap
    const slot1Start = gap.start;
    const slot1End = slot1Start + durationMinutes;
    const period1: 'Morning' | 'Afternoon' | 'Evening' = 
      (slot1Start % 1440) < 720 ? 'Morning' : (slot1Start % 1440) < 1020 ? 'Afternoon' : 'Evening';

    results.push({
      date: dateStr,
      dayOfWeek,
      startTime: formatMinutesTo12Hour(slot1Start),
      endTime: formatMinutesTo12Hour(slot1End),
      scheduledMinutesOnDay,
      remainingCapacityMinutes: remainingCapacity,
      isRedLine,
      period: period1
    });

    // If gap is large enough, add intermediate step slots (e.g. +30m or +60m)
    const step = Math.max(30, durationMinutes >= 90 ? 60 : 30);
    let nextStart = slot1Start + step;
    while (nextStart + durationMinutes <= gap.end && results.length < maxSlotsPerDay) {
      const periodNext: 'Morning' | 'Afternoon' | 'Evening' = 
        (nextStart % 1440) < 720 ? 'Morning' : (nextStart % 1440) < 1020 ? 'Afternoon' : 'Evening';
      results.push({
        date: dateStr,
        dayOfWeek,
        startTime: formatMinutesTo12Hour(nextStart),
        endTime: formatMinutesTo12Hour(nextStart + durationMinutes),
        scheduledMinutesOnDay,
        remainingCapacityMinutes: remainingCapacity,
        isRedLine,
        period: periodNext
      });
      nextStart += step;
    }
  }

  return results;
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
  const slots = findAllAvailableSlotsOnDate(
    dateStr,
    durationMinutes,
    allTasks,
    dayStartTime,
    dayEndTime,
    earliestAllowedMinutes,
    1
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


