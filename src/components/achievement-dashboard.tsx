'use client';

import Image from 'next/image';
import {useEffect, useMemo, useState} from 'react';
import {getOrCreatePlayerSessionId} from '@/lib/client-session';
import {fetchPlayerRecords} from '@/lib/puzzle-api';
import type {SlantPlayerRecords} from '@/lib/slant-types';
import type {AchievementItem} from '@/lib/types';
import {AchievementRecordsPanel} from './achievement-records-panel';

const emptyRecords: SlantPlayerRecords = {
  total_completed: 0,
  daily_completed: 0,
  challenges_completed: 0,
  practice_completed: 0,
  practice_runs: 0,
  easy_completed: 0,
  medium_completed: 0,
  hard_completed: 0,
  perfect_runs: 0,
  current_streak_days: 0,
  longest_streak_days: 0,
  best_time_seconds: null,
  best_day: null,
  first_played_at: null,
  last_completed_at: null
};

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function getAchievementCurrent(item: AchievementItem, records: SlantPlayerRecords) {
  const id = item.id || slugify(item.title);

  switch (id) {
    case 'first-step-solver':
      return records.total_completed;
    case 'daily-challenger':
    case 'daily-rookie':
    case 'daily-veteran':
    case 'daily-master':
      return records.daily_completed;
    case 'practice-starter':
      return records.practice_completed;
    case 'easy-explorer':
      return records.easy_completed;
    case 'medium-mind':
      return records.medium_completed;
    case 'hard-thinker':
      return records.hard_completed;
    case 'slant-enthusiast':
    case 'grid-walker':
      return records.total_completed;
    case 'streak-builder':
    case 'streak-keeper':
    case 'streak-legend':
      return records.longest_streak_days;
    case 'perfectionist':
      return records.perfect_runs;
    default:
      return records.total_completed;
  }
}

function buildAchievementProgress(items: AchievementItem[], records: SlantPlayerRecords) {
  return items.map((item) => {
    const total = Math.max(item.count ?? 1, 1);
    const current = Math.min(getAchievementCurrent(item, records), total);
    const percent = Math.round((current / total) * 100);

    return {
      ...item,
      current,
      total,
      percent,
      unlocked: current >= total
    };
  });
}

export function AchievementDashboard({items}: {items: AchievementItem[]}) {
  const [records, setRecords] = useState<SlantPlayerRecords>(emptyRecords);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const sessionId = getOrCreatePlayerSessionId();

    setLoading(true);
    setError('');

    fetchPlayerRecords(sessionId)
      .then((nextRecords) => {
        if (!cancelled) {
          setRecords(nextRecords);
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          const message = requestError instanceof Error ? requestError.message : 'Records failed to load.';
          setError(message);
          setRecords(emptyRecords);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const achievements = useMemo(() => buildAchievementProgress(items, records), [items, records]);

  return (
    <section className="achievement-layout">
      <div className="achievement-list">
        {achievements.map((achievement) => (
          <article
            className={`achievement-card ${achievement.unlocked ? '' : 'locked'}`}
            key={achievement.id}
          >
            <Image src={achievement.image} alt="" width={64} height={64} />
            <div>
              <h2>{achievement.title}</h2>
              <p>{achievement.description}</p>
              <div className="progress-track" aria-hidden="true">
                <div
                  className="progress-fill"
                  style={{width: `${loading ? 0 : achievement.percent}%`}}
                />
              </div>
              <p>{`${achievement.current} of ${achievement.total}`}</p>
            </div>
          </article>
        ))}
      </div>
      <AchievementRecordsPanel records={records} loading={loading} error={error} />
    </section>
  );
}
