import type {AchievementItem} from './types';

type CalendarDay = {
  day: number;
  status: 'idle' | 'solved' | 'missed';
};

export function buildCalendarDays() {
  const year = 2026;
  const month = 6;
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = firstDay.getDay();

  const leadingDays: Array<CalendarDay | null> = Array.from({length: leading}, () => null);
  const monthDays: CalendarDay[] = Array.from({length: daysInMonth}, (_, index) => {
      const day = index + 1;
      const status: CalendarDay['status'] =
        day % 6 === 0 ? 'missed' : day % 3 === 0 ? 'solved' : 'idle';
      return {day, status};
    });
  const days: Array<CalendarDay | null> = [...leadingDays, ...monthDays];

  return {year, monthName: 'July', days};
}

export function buildAchievementProgress(items: AchievementItem[]) {
  return items.map((item, index) => {
    const total = [5, 7, 100][index] ?? 10;
    const current = Math.min(total, [1, 3, 52][index] ?? index + 1);
    const percent = Math.round((current / total) * 100);

    return {
      ...item,
      current,
      total,
      percent,
      unlocked: percent >= 60
    };
  });
}

export function buildPlayerStats() {
  return [
    {label: 'Challenges', value: '42'},
    {label: 'Best Time', value: '04:28'},
    {label: 'Best Day', value: 'Jul 4, 2026'},
    {label: 'Practice Runs', value: '118'},
    {label: 'First Played', value: 'Jan 14, 2026'},
    {label: 'Longest Streak', value: '9 days'}
  ];
}
