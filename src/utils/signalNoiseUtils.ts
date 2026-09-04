import { PriorityLevel, DaySlice24, DayBreakdown24Metrics, SignalNoiseType } from '../types';

export interface SignalNoiseClassification {
  type: SignalNoiseType;
  confidence: number; // 0.0 - 1.0
  reason: string;
  badgeColor: string;
  label: string;
}

// Comprehensive Signal Keywords (Deep work, high leverage, health, restorative rest, growth)
const SIGNAL_KEYWORDS = [
  'code', 'coding', 'program', 'build', 'engineer', 'architect', 'develop', 'dev',
  'api', 'database', 'infrastructure', 'audit', 'review', 'system', 'spec', 'deploy',
  'refactor', 'design', 'ui', 'ux', 'feature', 'sprint', 'engine', 'algorithm',
  'study', 'learn', 'read', 'reading', 'book', 'paper', 'research', 'analytics',
  'workout', 'gym', 'exercise', 'walk', 'run', 'cardio', 'stretching', 'yoga',
  'meditation', 'mindfulness', 'reflection', 'journal', 'diary', 'plan', 'planning',
  'sleep', 'rest', 'recovery', 'nap', 'power nap', 'nutrition', 'meal', 'lunch',
  'breakfast', 'dinner', 'hydrate', 'water', 'tea', 'family', 'parent', 'child',
  'deep work', 'focus', 'flow', 'meeting', 'client', 'customer', 'ship', 'deliver',
  'write', 'writing', 'strategy', 'roadmap', 'organize', 'optimize'
];

// Comprehensive Noise Keywords (Distraction, aimless consumption, procrastination, draining filler)
const NOISE_KEYWORDS = [
  'scroll', 'scrolling', 'doomscroll', 'doomscrolling', 'twitter', 'x.com', 'instagram',
  'tiktok', 'reels', 'shorts', 'youtube rabbit hole', 'reddit', 'feed', 'feeds',
  'social media', 'procrastinat', 'procrastinating', 'idle', 'wasted', 'lost time',
  'aimless', 'random browsing', 'distract', 'distracted', 'distraction', 'bored',
  'spacing out', 'slacking', 'binge', 'gossip', 'trivia', 'filler', 'waiting around',
  'unproductive', 'delay', 'overthinking'
];

/**
 * Intelligently classifies any activity, task, or diary entry as Signal or Noise.
 */
export function detectSignalVsNoise(params: {
  title?: string;
  notes?: string;
  category?: string;
  tag?: string;
  priority?: PriorityLevel;
  energyLevel?: number;
  sliceType?: DaySlice24['type'];
  explicitType?: SignalNoiseType;
}): SignalNoiseClassification {
  // If user explicitly provided an override, honor it
  if (params.explicitType) {
    return {
      type: params.explicitType,
      confidence: 1.0,
      reason: params.explicitType === 'signal' 
        ? 'User designated as High-Value Signal' 
        : 'User designated as Noise / Low-Value',
      badgeColor: params.explicitType === 'signal' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white',
      label: params.explicitType === 'signal' ? 'Signal (High-Value)' : 'Noise (Distraction/Leak)'
    };
  }

  // Priority-based rules
  if (params.priority === 'P1') {
    return {
      type: 'signal',
      confidence: 0.98,
      reason: 'Mission-critical P1 task: Core essential signal',
      badgeColor: 'bg-red-500 text-white',
      label: 'Core Signal (P1 Must-Do)'
    };
  }
  if (params.priority === 'P2') {
    return {
      type: 'signal',
      confidence: 0.95,
      reason: 'P2 High-ROI workflow: High-leverage output',
      badgeColor: 'bg-orange-500 text-white',
      label: 'High ROI Signal (P2)'
    };
  }
  if (params.priority === 'P3') {
    return {
      type: 'signal',
      confidence: 0.85,
      reason: 'P3 Delegatable/Operational execution',
      badgeColor: 'bg-blue-500 text-white',
      label: 'Operational Signal (P3)'
    };
  }
  if (params.priority === 'P5') {
    return {
      type: 'noise',
      confidence: 0.95,
      reason: 'P5 designated Noise / Filter item',
      badgeColor: 'bg-slate-600 text-white',
      label: 'Filtered Noise (P5)'
    };
  }

  // Sleep is restorative circadian signal
  if (params.sliceType === 'sleep') {
    return {
      type: 'signal',
      confidence: 0.99,
      reason: 'Essential Circadian Recovery & Sleep Cycle',
      badgeColor: 'bg-indigo-600 text-white',
      label: 'Restorative Signal (Sleep)'
    };
  }

  // Unaccounted gaps are potential noise leaks until logged
  if (params.sliceType === 'unaccounted_gap') {
    return {
      type: 'noise',
      confidence: 0.70,
      reason: 'Unaccounted time window: Potential time leak',
      badgeColor: 'bg-amber-600 text-white',
      label: 'Unaccounted Leak'
    };
  }

  // Combine text content for semantic heuristic analysis
  const combinedText = [
    params.title || '',
    params.notes || '',
    params.category || '',
    params.tag || ''
  ].join(' ').toLowerCase();

  let noiseScore = 0;
  let signalScore = 0;
  const matchedNoiseWords: string[] = [];
  const matchedSignalWords: string[] = [];

  for (const word of NOISE_KEYWORDS) {
    if (combinedText.includes(word)) {
      noiseScore += 2;
      matchedNoiseWords.push(word);
    }
  }

  for (const word of SIGNAL_KEYWORDS) {
    if (combinedText.includes(word)) {
      signalScore += 2;
      matchedSignalWords.push(word);
    }
  }

  // Buffer category tag defaults
  const tagLower = (params.tag || '').toLowerCase();
  if (
    tagLower.includes('walk') || 
    tagLower.includes('exercise') || 
    tagLower.includes('meditat') || 
    tagLower.includes('read') || 
    tagLower.includes('plan') || 
    tagLower.includes('meal') ||
    tagLower.includes('nap') ||
    tagLower.includes('coffee')
  ) {
    signalScore += 3;
  } else if (tagLower.includes('entertainment') || tagLower.includes('social')) {
    // Check if entertainment has positive context or negative context
    if (noiseScore > 0) {
      noiseScore += 2;
    } else {
      signalScore += 1; // Intentional leisure is gentle signal
    }
  }

  // Energy level context
  if (params.energyLevel && params.energyLevel >= 4) {
    signalScore += 1;
  } else if (params.energyLevel === 1 && noiseScore > 0) {
    noiseScore += 2;
  }

  if (noiseScore > signalScore) {
    const confidence = Math.min(0.95, 0.60 + (noiseScore * 0.08));
    return {
      type: 'noise',
      confidence,
      reason: matchedNoiseWords.length > 0 
        ? `Detected distraction patterns (${matchedNoiseWords.slice(0, 3).join(', ')})`
        : 'Low-yield / distractive activity pattern',
      badgeColor: 'bg-rose-500 text-white',
      label: 'Noise / Distraction'
    };
  }

  const confidence = Math.min(0.95, 0.70 + (signalScore * 0.06));
  return {
    type: 'signal',
    confidence,
    reason: matchedSignalWords.length > 0 
      ? `High-value activity identified (${matchedSignalWords.slice(0, 3).join(', ')})`
      : 'Constructive focus or mindful renewal',
    badgeColor: 'bg-emerald-500 text-white',
    label: 'Signal (Meaningful)'
  };
}

export interface DailyLifeSynthesis {
  headline: string;
  verdict: 'FLOW_MASTERY' | 'STRONG_FOCUS' | 'MODERATE_NOISE' | 'HIGH_LEAKAGE';
  verdictColor: string;
  keySignalWins: string[];
  noiseLeaks: string[];
  reflectionSummary: string;
  recommendation: string;
}

/**
 * Synthesizes a daily life review: accomplishments, noise leaks, circadian balance, and key recommendations.
 */
export function generateDailyLifeSynthesis(
  dateStr: string,
  slices: DaySlice24[],
  metrics: DayBreakdown24Metrics
): DailyLifeSynthesis {
  const signalSlices = slices.filter(s => s.signalNoise === 'signal' && s.type !== 'sleep');
  const noiseSlices = slices.filter(s => s.signalNoise === 'noise');

  const signalHours = (metrics.signalMinutes / 60).toFixed(1);
  const noiseHours = (metrics.noiseMinutes / 60).toFixed(1);
  const snr = metrics.snrMultiplier.toFixed(1);

  // Determine Verdict
  let verdict: 'FLOW_MASTERY' | 'STRONG_FOCUS' | 'MODERATE_NOISE' | 'HIGH_LEAKAGE' = 'STRONG_FOCUS';
  let verdictColor = 'text-blue-500';
  let headline = 'Balanced & Solid Execution Day';

  if (metrics.signalRatio >= 85) {
    verdict = 'FLOW_MASTERY';
    verdictColor = 'text-emerald-500';
    headline = `Exceptional Deep Flow: ${metrics.signalRatio}% Signal (${snr}x SNR)`;
  } else if (metrics.signalRatio >= 70) {
    verdict = 'STRONG_FOCUS';
    verdictColor = 'text-blue-500';
    headline = `Solid Focus Day: ${metrics.signalRatio}% Signal`;
  } else if (metrics.signalRatio >= 50) {
    verdict = 'MODERATE_NOISE';
    verdictColor = 'text-amber-500';
    headline = `Moderate Noise Creep: ${noiseHours}h Lost to Distractions & Gaps`;
  } else {
    verdict = 'HIGH_LEAKAGE';
    verdictColor = 'text-rose-500';
    headline = `High Noise Alert: Over half your awake hours went to low-yield noise`;
  }

  // Key Signal Wins
  const keySignalWins = signalSlices
    .slice(0, 4)
    .map(s => {
      const noteText = s.bufferNote?.notes ? ` — "${s.bufferNote.notes}"` : '';
      return `${s.startTime} - ${s.endTime} (${s.durationMinutes}m): ${s.title}${noteText}`;
    });

  if (keySignalWins.length === 0) {
    keySignalWins.push('Log completed tasks or buffer reflections to record daily signal wins.');
  }

  // Noise Leaks
  const noiseLeaks = noiseSlices
    .slice(0, 4)
    .map(s => {
      const desc = s.type === 'unaccounted_gap' 
        ? `Unaccounted gap (${s.durationMinutes}m) from ${s.startTime} to ${s.endTime}`
        : `${s.title} (${s.durationMinutes}m) [${s.snReason || 'Low value/distraction'}]`;
      return desc;
    });

  if (noiseLeaks.length === 0) {
    noiseLeaks.push('Zero noise leaks detected! 100% of tracked awake time was high signal.');
  }

  // Reflection Summary
  const reflectionSummary = `Today's 24-hour ledger accounts for ${metrics.accountabilityScore}% of circadian time (${1440 - metrics.unaccountedMinutes} minutes tracked). You dedicated ${signalHours} hours to pure Signal (deep work, intentional health, and renewal) against ${noiseHours} hours of Noise. Your Signal-to-Noise Ratio is ${snr}x.`;

  // Recommendation
  let recommendation = '';
  if (metrics.unaccountedMinutes > 120) {
    recommendation = `You have ${Math.round(metrics.unaccountedMinutes / 60)} hours of unaccounted gaps. Use the Quick Life Diary composer above to jot down what happened and convert missing time into mindful diary entries.`;
  } else if (metrics.signalRatio >= 85) {
    recommendation = 'You are operating in world-class flow state! Ensure you maintain proper wind-down before your scheduled bedtime.';
  } else if (metrics.noiseMinutes > 150) {
    recommendation = 'Identify the primary distraction triggers recorded today (e.g. social feeds or context switching) and block them during your first 90-minute morning focus window tomorrow.';
  } else {
    recommendation = 'Strong consistency. Protect your high-priority P1 work slots early in the day when circadian energy is peak.';
  }

  return {
    headline,
    verdict,
    verdictColor,
    keySignalWins,
    noiseLeaks,
    reflectionSummary,
    recommendation
  };
}

/**
 * Formats the entire 24h day into a clean, formatted Markdown Life Diary.
 */
export function exportDayDiaryAsMarkdown(
  dateStr: string,
  slices: DaySlice24[],
  metrics: DayBreakdown24Metrics
): string {
  const synthesis = generateDailyLifeSynthesis(dateStr, slices, metrics);
  const nowStr = new Date().toLocaleString();

  let md = `# 📖 24-Hour Life Diary & Ledger — ${dateStr}\n\n`;
  md += `> **Generated on:** ${nowStr} • **OptimusTime Circadian Life Protocol**\n\n`;
  
  md += `## 📊 Executive Signal vs. Noise Breakdown\n\n`;
  md += `- **Signal-to-Noise Ratio (SNR):** ${metrics.snrMultiplier.toFixed(2)}x\n`;
  md += `- **Signal Ratio:** ${metrics.signalRatio}%\n`;
  md += `- **Signal Time:** ${Math.floor(metrics.signalMinutes / 60)}h ${metrics.signalMinutes % 60}m\n`;
  md += `- **Noise Time:** ${Math.floor(metrics.noiseMinutes / 60)}h ${metrics.noiseMinutes % 60}m\n`;
  md += `- **Sleep Cycle:** ${Math.floor(metrics.sleepMinutes / 60)}h ${metrics.sleepMinutes % 60}m\n`;
  md += `- **Accountability Score:** ${metrics.accountabilityScore}% (1,440-minute circadian completeness)\n\n`;

  md += `### 💡 Daily Life Synthesis & AI Review\n`;
  md += `**Verdict:** ${synthesis.headline}\n\n`;
  md += `${synthesis.reflectionSummary}\n\n`;
  md += `**Strategic Recommendation for Tomorrow:**\n> ${synthesis.recommendation}\n\n`;

  md += `### 🏆 Key Signal Accomplishments\n`;
  for (const win of synthesis.keySignalWins) {
    md += `- 🎯 ${win}\n`;
  }
  md += `\n`;

  md += `### ⚠️ Noise Leakage Points\n`;
  for (const leak of synthesis.noiseLeaks) {
    md += `- ⚡ ${leak}\n`;
  }
  md += `\n`;

  md += `## 📜 Complete Chronological Life Diary Stream\n\n`;
  md += `| Time Window | Duration | Category | Type | Life Diary Entry & Details |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- |\n`;

  for (const s of slices) {
    const signalBadge = s.signalNoise === 'signal' ? '🎯 SIGNAL' : '⚠️ NOISE';
    let detailText = s.title;
    if (s.bufferNote?.notes) {
      detailText = `**${s.title}**: ${s.bufferNote.notes}`;
    } else if (s.task?.description) {
      detailText = `**${s.title}**: ${s.task.description}`;
    } else if (s.type === 'unaccounted_gap') {
      detailText = `_Unaccounted free time slot (${s.durationMinutes}m gap)_`;
    }

    // Clean newlines for table formatting
    detailText = detailText.replace(/\n/g, ' ');

    md += `| ${s.startTime} - ${s.endTime} | ${s.durationMinutes}m | ${s.type} | ${signalBadge} | ${detailText} |\n`;
  }

  md += `\n---\n*Created with OptimusTime — All-in-All Life Diary & 24H Accountability Engine*\n`;
  return md;
}
