import type {SlantPlayerRecords} from '@/lib/slant-types';

function formatSeconds(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) {
    return '--';
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

function formatDate(value: string | null) {
  if (!value) {
    return '--';
  }

  const date = value.includes('T') ? new Date(value) : new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return '--';
  }

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
}

function buildStats(records: SlantPlayerRecords) {
  return [
    {label: 'Challenges', value: String(records.daily_completed)},
    {label: 'Best Time', value: formatSeconds(records.best_time_seconds)},
    {label: 'Best Day', value: formatDate(records.best_day)},
    {label: 'Practice Runs', value: String(records.practice_runs)},
    {label: 'First Played', value: formatDate(records.first_played_at)},
    {label: 'Longest Streak', value: `${records.longest_streak_days} days`}
  ];
}

export function AchievementRecordsPanel({
  records,
  loading,
  error
}: {
  records: SlantPlayerRecords;
  loading: boolean;
  error: string;
}) {
  const stats = buildStats(records);

  return (
    <aside className="surface stats-panel" aria-label="Player records">
      <h2>Records</h2>
      {loading ? <p className="records-message">Syncing browser records...</p> : null}
      {error ? <p className="records-message error">{error}</p> : null}
      <div className="stats-list">
        {stats.map((stat) => (
          <div className="stat-row" key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </div>
        ))}
      </div>
    </aside>
  );
}
