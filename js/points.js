// Point / badge / level / conversion rules for 슬립 퀘스트.
// Pure functions only — no DOM or storage access here.

export const POINTS_PER_UNIT = 300;
export const WON_PER_UNIT = 1000;

export const LEVEL_TITLES = ['슬립 루키', '슬립 초보', '슬립 숙련자', '슬립 마스터', '슬립 그랜드마스터', '슬립 레전드'];

export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// Anchors an evening time (screen-off / bedtime) on a 0~1440+ scale so that
// times just after midnight (00:xx, 01:xx) sort *after* pre-midnight times.
export function eveningAbs(hhmm) {
  const [h] = hhmm.split(':').map(Number);
  const mins = toMinutes(hhmm);
  return h < 12 ? mins + 1440 : mins;
}

// Wake time is always "the next morning" relative to the evening anchor.
function morningAbs(hhmm) {
  return toMinutes(hhmm) + 1440;
}

export function sleepDurationMinutes(sleepTime, wakeTime) {
  return morningAbs(wakeTime) - eveningAbs(sleepTime);
}

export function screenOffLeadMinutes(screenOffTime, sleepTime) {
  return eveningAbs(sleepTime) - eveningAbs(screenOffTime);
}

function bedtimeBonus(sleepTime) {
  const abs = eveningAbs(sleepTime);
  if (abs <= 22 * 60 + 30) return 40;
  if (abs <= 23 * 60) return 30;
  if (abs <= 24 * 60) return 20;
  if (abs <= 25 * 60) return 10;
  return 0;
}

function durationBonus(sleepTime, wakeTime) {
  const dur = sleepDurationMinutes(sleepTime, wakeTime);
  if (dur >= 8 * 60) return 15;
  if (dur >= 7 * 60) return 10;
  return 0;
}

function screenOffBonus(screenOffTime, sleepTime) {
  return screenOffLeadMinutes(screenOffTime, sleepTime) >= 30 ? 15 : 0;
}

export function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// This runs in the user's own browser, so "today" is simply their device's
// local calendar date — no timezone conversion needed.
export function today() {
  return formatDate(new Date());
}

function streakEndingAt(dateSet, dateStr) {
  let streak = 0;
  const cursor = new Date(dateStr + 'T00:00:00');
  while (dateSet.has(formatDate(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// Streak ending on `dateStr`, treating `dateStr` as present even if it
// hasn't been saved yet (used while scoring the check-in being created).
export function computeStreakForDate(records, dateStr) {
  const dateSet = new Set(records.map((r) => r.date));
  dateSet.add(dateStr);
  return streakEndingAt(dateSet, dateStr);
}

// Streak ending on `dateStr` using only records that actually exist (used
// to display the "current" streak before today's check-in is submitted).
export function currentStreakAsOf(records, dateStr) {
  const dateSet = new Set(records.map((r) => r.date));
  return streakEndingAt(dateSet, dateStr);
}

// Longest streak ever achieved across all records (badges stay earned even
// after a streak breaks).
export function computeMaxStreak(records) {
  const dates = [...new Set(records.map((r) => r.date))].sort();
  let max = 0;
  let cur = 0;
  let prev = null;
  for (const d of dates) {
    if (prev) {
      const diffDays = Math.round((new Date(d) - new Date(prev)) / 86400000);
      cur = diffDays === 1 ? cur + 1 : 1;
    } else {
      cur = 1;
    }
    prev = d;
    if (cur > max) max = cur;
  }
  return max;
}

function milestoneBonus(streak) {
  let bonus = 0;
  if (streak === 3) bonus += 20;
  else if (streak === 7) bonus += 50;
  else if (streak === 14) bonus += 100;
  if (streak === 7) bonus += 50; // 7일 연속 완주 보너스
  return bonus;
}

// Computes the point breakdown for a single day's check-in. `priorRecords`
// should be every record *other than* the one being scored (so re-editing
// today's entry doesn't double-count it in the streak).
export function computeDayPoints(input, priorRecords, dateStr) {
  const base = 10;
  const bed = bedtimeBonus(input.sleepTime);
  const screen = screenOffBonus(input.screenOffTime, input.sleepTime);
  const duration = durationBonus(input.sleepTime, input.wakeTime);
  const streak = computeStreakForDate(priorRecords, dateStr);
  const milestone = milestoneBonus(streak);
  const total = base + bed + screen + duration + milestone;
  return { total, breakdown: { base, bed, screen, duration, milestone }, streak };
}

export function computeTotalPoints(records) {
  return records.reduce((sum, r) => sum + (r.points || 0), 0);
}

const BADGE_BUCKETS = [
  { id: 'first', name: '첫 기록', icon: '🌱', test: (records) => records.length >= 1 },
  { id: 'streak3', name: '3일 연속', icon: '💧', test: (records) => computeMaxStreak(records) >= 3 },
  { id: 'streak7', name: '7일 연속', icon: '⚡', test: (records) => computeMaxStreak(records) >= 7 },
  {
    id: 'before23_5',
    name: '23시 전 5회',
    icon: '🌙',
    test: (records) => records.filter((r) => eveningAbs(r.sleepTime) <= 23 * 60).length >= 5,
  },
  {
    id: 'screenoff5',
    name: '화면끄기 5회',
    icon: '🚫',
    test: (records) => records.filter((r) => screenOffLeadMinutes(r.screenOffTime, r.sleepTime) >= 30).length >= 5,
  },
  {
    id: 'eight5',
    name: '8시간 5회',
    icon: '😴',
    test: (records) => records.filter((r) => sleepDurationMinutes(r.sleepTime, r.wakeTime) >= 480).length >= 5,
  },
  {
    id: 'cond5_3',
    name: '컨디션5 3회',
    icon: '⭐',
    test: (records) => records.filter((r) => r.condition === 5).length >= 3,
  },
  { id: 'data14', name: '데이터 14일', icon: '📊', test: (records) => records.length >= 14 },
  { id: 'points1000', name: '1000P 돌파', icon: '👑', test: (records, totalPoints) => totalPoints >= 1000 },
];

export function computeBadges(records, totalPoints) {
  return BADGE_BUCKETS.map((b) => ({ id: b.id, name: b.name, icon: b.icon, done: b.test(records, totalPoints) }));
}

export function levelInfo(totalPoints) {
  const levelIndex = Math.floor(totalPoints / POINTS_PER_UNIT);
  const level = levelIndex + 1;
  const title = LEVEL_TITLES[Math.min(levelIndex, LEVEL_TITLES.length - 1)];
  const nextThreshold = (levelIndex + 1) * POINTS_PER_UNIT;
  const neededForNext = nextThreshold - totalPoints;
  return { level, title, nextThreshold, neededForNext, perLevel: POINTS_PER_UNIT };
}

const ANALYSIS_BUCKETS = [
  { label: '22:30 이전', test: (r) => eveningAbs(r.sleepTime) <= 22 * 60 + 30 },
  { label: '22:30~23:00', test: (r) => eveningAbs(r.sleepTime) > 22 * 60 + 30 && eveningAbs(r.sleepTime) <= 23 * 60 },
  { label: '23:00~24:00', test: (r) => eveningAbs(r.sleepTime) > 23 * 60 && eveningAbs(r.sleepTime) <= 24 * 60 },
  { label: '24:00~01:00', test: (r) => eveningAbs(r.sleepTime) > 24 * 60 && eveningAbs(r.sleepTime) <= 25 * 60 },
  { label: '01:00 이후', test: (r) => eveningAbs(r.sleepTime) > 25 * 60 },
];

export function analyzeConditionByBedtime(records) {
  const MIN_RECORDS = 3;
  if (records.length < MIN_RECORDS) {
    return { ready: false, needed: MIN_RECORDS - records.length, have: records.length, minRecords: MIN_RECORDS };
  }
  const rows = ANALYSIS_BUCKETS.map((b) => {
    const matched = records.filter(b.test);
    if (!matched.length) return null;
    const avg = matched.reduce((s, r) => s + r.condition, 0) / matched.length;
    return { label: b.label, avg: Math.round(avg * 10) / 10, count: matched.length };
  }).filter(Boolean);
  return { ready: true, rows };
}

// How many points can still be converted to cash, and what that's worth.
export function convertibleSummary(totalPoints, convertedPoints) {
  const availablePoints = Math.max(0, totalPoints - convertedPoints);
  const units = Math.floor(availablePoints / POINTS_PER_UNIT);
  const convertibleWon = units * WON_PER_UNIT;
  const pointsUsedIfConverted = units * POINTS_PER_UNIT;
  const remainderPoints = availablePoints - pointsUsedIfConverted;
  const pointsUntilNextUnit = remainderPoints === 0 ? 0 : POINTS_PER_UNIT - remainderPoints;
  return { availablePoints, convertibleWon, pointsUsedIfConverted, remainderPoints, pointsUntilNextUnit };
}
