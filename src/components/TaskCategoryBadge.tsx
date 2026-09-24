import React from 'react';
import { 
  Zap, 
  User, 
  Cpu, 
  Globe, 
  Briefcase, 
  BookOpen, 
  Bell, 
  FileText, 
  FolderKanban, 
  Repeat, 
  Target, 
  Heart, 
  Activity, 
  Bookmark,
  Calendar,
  Layers,
  Sparkles
} from 'lucide-react';
import { Category, RecurrenceType } from '../types';

export const hexToRgba = (hex?: string, alpha: number = 1): string => {
  if (!hex || typeof hex !== 'string') return `rgba(107, 114, 128, ${alpha})`;
  let c = hex.replace('#', '').trim();
  if (c.length === 3) {
    c = c.split('').map(x => x + x).join('');
  }
  const num = parseInt(c, 16);
  if (isNaN(num) || c.length !== 6) return `rgba(107, 114, 128, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const getCategoryIconComponent = (iconName?: string) => {
  switch (iconName) {
    case 'Zap': return Zap;
    case 'User': return User;
    case 'Cpu': return Cpu;
    case 'Globe': return Globe;
    case 'Briefcase': return Briefcase;
    case 'BookOpen': return BookOpen;
    case 'Bell': return Bell;
    case 'FileText': return FileText;
    case 'Target': return Target;
    case 'Heart': return Heart;
    case 'Activity': return Activity;
    case 'Bookmark': return Bookmark;
    case 'Calendar': return Calendar;
    case 'Layers': return Layers;
    case 'Sparkles': return Sparkles;
    default: return FolderKanban;
  }
};

interface CategoryBadgeProps {
  categoryName: string;
  subCategory?: string;
  categories: Category[];
  size?: 'sm' | 'md';
  onClick?: () => void;
  className?: string;
}

export const CategoryBadge: React.FC<CategoryBadgeProps> = ({
  categoryName,
  subCategory,
  categories,
  size = 'md',
  onClick,
  className = ''
}) => {
  if (!categoryName) return null;

  const matchedCat = categories.find(
    c => c.name.trim().toLowerCase() === categoryName.trim().toLowerCase() || c.id === categoryName
  );

  const color = matchedCat?.color || '#3B82F6';
  const IconComp = getCategoryIconComponent(matchedCat?.iconName);

  const bgColor = hexToRgba(color, 0.12);
  const borderColor = hexToRgba(color, 0.35);
  const textColor = color;

  const sizeClasses = size === 'sm'
    ? 'text-[10px] px-1.5 py-0.5 gap-1'
    : 'text-[11px] px-2 py-0.5 gap-1.5';

  const iconSizeClass = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3';

  const displayName = matchedCat?.name || categoryName;

  return (
    <span
      onClick={onClick}
      style={{
        backgroundColor: bgColor,
        borderColor: borderColor,
        color: textColor
      }}
      className={`inline-flex items-center font-semibold rounded-full border shadow-2xs font-display tracking-tight transition-all shrink-0 ${sizeClasses} ${
        onClick ? 'cursor-pointer hover:opacity-85 active:scale-95' : ''
      } ${className}`}
      title={subCategory ? `Category: ${displayName} / ${subCategory}` : `Category: ${displayName}`}
    >
      <IconComp className={`${iconSizeClass} shrink-0`} style={{ stroke: textColor }} />
      <span className="font-bold">{displayName}</span>
      {subCategory && (
        <>
          <span className="opacity-40">•</span>
          <span className="opacity-80 font-normal">{subCategory}</span>
        </>
      )}
    </span>
  );
};

interface RecurrenceBadgeProps {
  recurrence?: RecurrenceType;
  selectedDays?: string[];
  size?: 'sm' | 'md';
  className?: string;
}

export const RecurrenceBadge: React.FC<RecurrenceBadgeProps> = ({
  recurrence,
  selectedDays,
  size = 'md',
  className = ''
}) => {
  if (!recurrence || recurrence === 'None') return null;

  let cadenceLabel = recurrence as string;
  let fullScheduleText = `Routine task: Repeats ${recurrence.toLowerCase()}`;

  if (recurrence === 'Selected Days') {
    if (selectedDays && selectedDays.length > 0) {
      if (selectedDays.length === 7) {
        cadenceLabel = 'Every Day';
        fullScheduleText = 'Routine task: Repeats every day';
      } else if (
        selectedDays.length === 5 &&
        ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].every(d => selectedDays.includes(d))
      ) {
        cadenceLabel = 'Weekdays';
        fullScheduleText = 'Routine task: Repeats Mon-Fri (Weekdays)';
      } else {
        cadenceLabel = selectedDays.join(', ');
        fullScheduleText = `Routine task: Repeats on ${selectedDays.join(', ')}`;
      }
    } else {
      cadenceLabel = 'Custom Days';
      fullScheduleText = 'Routine task: Repeats on selected custom days';
    }
  }

  const sizeClasses = size === 'sm'
    ? 'text-[10px] px-1.5 py-0.5 gap-1'
    : 'text-[11px] px-2 py-0.5 gap-1.5';

  const iconSizeClass = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3';

  return (
    <span
      className={`inline-flex items-center font-bold font-mono rounded-full border shrink-0 transition-colors shadow-2xs border-cyan-400/50 dark:border-cyan-700/60 bg-gradient-to-r from-cyan-50 to-sky-50 dark:from-cyan-950/60 dark:to-sky-950/60 text-cyan-800 dark:text-cyan-200 ${sizeClasses} ${className}`}
      title={fullScheduleText}
    >
      <Repeat className={`${iconSizeClass} text-cyan-600 dark:text-cyan-300 stroke-[2.5]`} />
      <span>{cadenceLabel}</span>
    </span>
  );
};
