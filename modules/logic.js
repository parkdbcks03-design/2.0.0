/*
 * v1.9.0 pure calculations.
 * No IndexedDB, no DOM. Study totals are derived so edits and deletes stay accurate.
 * Exam score rows are never an input — the exam timer already writes one studyEntries row.
 */

export const STUDY_SUBJECTS = ['국어', '수학', '영어', '한국사', '사회탐구', '과학탐구', '제2외국어', '기타'];
export const EXP_PER_LEVEL = 600;
export const CSAT_DATE = '2027-11-18';
export const CSAT_PROGRESS_START = '2026-01-01';
export const BACKUP_INTERVAL_DAYS = 7;
export const DAILY_REVIEW_HOUR = 22;

export const LEVEL_TITLES = [
  '알을 품은 기록자',
  '첫 깃털',
  '메모의 주인',
  '집중의 새싹',
  '탐구 부엉이',
  '꾸준한 비행',
  '심야의 학자',
  '실전 사냥꾼',
  '숲의 선배',
  '아카이브 수호자',
  '완전 성장 부엉이'
];

export const OWL_STAGES = [
  { stage: 1, name: '알', image: './assets/growth/stage-1.webp', need: 0 },
  { stage: 2, name: '아기 부엉이', image: './assets/growth/stage-2.webp', need: 600 },
  { stage: 3, name: '어린 부엉이', image: './assets/growth/stage-3.webp', need: 3000 },
  { stage: 4, name: '성장한 부엉이', image: './assets/growth/stage-4.webp', need: 12000 },
  { stage: 5, name: '완전히 성장한 부엉이', image: './assets/growth/stage-5.webp', need: 36000 }
];

export function fmtMin(minutes = 0) {
  const n = Math.max(0, Math.round(Number(minutes) || 0));
  const h = Math.floor(n / 60);
  const m = n % 60;
  return h ? `${h}시간${m ? ` ${m}분` : ''}` : `${m}분`;
}

export function addIsoDays(iso, amount) {
  const [y, m, d] = String(iso).split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + amount);
  return dt.toISOString().slice(0, 10);
}

export function isoDiffDays(from, to) {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

export function eachDate(from, to) {
  const out = [];
  if (!from || !to || from > to) return out;
  let cursor = from;
  let guard = 0;
  while (cursor <= to && guard++ < 4000) {
    out.push(cursor);
    cursor = addIsoDays(cursor, 1);
  }
  return out;
}

export function weekdayIndexMonday(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return (dt.getDay() + 6) % 7;
}

export function calendarMonths(from, to) {
  const [fy, fm, fd] = String(from).split('-').map(Number);
  const [ty, tm, td] = String(to).split('-').map(Number);
  let months = (ty - fy) * 12 + (tm - fm);
  if (td < fd) months -= 1;
  return months;
}

export function grassLevel(minutes) {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  if (m <= 0) return 0;
  if (m <= 59) return 1;
  if (m <= 179) return 2;
  if (m <= 299) return 3;
  if (m <= 359) return 4;
  return 5;
}

export function levelTitle(level) {
  const lv = Math.max(1, Math.round(level) || 1);
  if (lv >= 21) return '전설의 부엉이';
  if (lv > LEVEL_TITLES.length) return LEVEL_TITLES[LEVEL_TITLES.length - 1];
  return LEVEL_TITLES[lv - 1];
}

export function levelState(totalMinutes) {
  const exp = Math.max(0, Math.round(Number(totalMinutes) || 0));
  const level = Math.floor(exp / EXP_PER_LEVEL) + 1;
  const into = exp % EXP_PER_LEVEL;
  const remain = into === 0 ? EXP_PER_LEVEL : EXP_PER_LEVEL - into;
  return {
    exp,
    level,
    into,
    remain,
    progress: into / EXP_PER_LEVEL,
    title: levelTitle(level)
  };
}

export function owlStage(exp) {
  const n = Math.max(0, Math.round(Number(exp) || 0));
  let current = OWL_STAGES[0];
  for (const stage of OWL_STAGES) {
    if (n >= stage.need) current = stage;
  }
  const next = OWL_STAGES.find(stage => stage.need > n) || null;
  return { ...current, next };
}

export function emptyDay(date) {
  return {
    date,
    minutes: 0,
    entryMinutes: 0,
    manualMinutes: 0,
    subjects: {},
    focusSessions: 0,
    timerSessions: 0,
    entries: []
  };
}

/**
 * Day total = max(studyEntries minutes, manual dailyStudy minutes).
 * The gap is kept once as "기록 외 시간". Exam rows are not accepted here.
 */
export function aggregateStudy(entries = [], dailyRows = []) {
  const days = new Map();
  const ensure = date => {
    if (!days.has(date)) days.set(date, emptyDay(date));
    return days.get(date);
  };
  for (const entry of entries) {
    if (!entry?.date) continue;
    const row = ensure(entry.date);
    const minutes = Math.max(0, Math.round(Number(entry.minutes) || 0));
    row.entryMinutes += minutes;
    row.entries.push(entry);
    const subject = entry.subject || '기타';
    row.subjects[subject] = (row.subjects[subject] || 0) + minutes;
    if (entry.source === 'subject-timer' && entry.timerSessionHead) {
      row.timerSessions += 1;
      row.focusSessions += Math.max(0, Math.round(Number(entry.focusCompleted) || 0));
    }
  }
  for (const daily of dailyRows) {
    if (!daily?.date) continue;
    const row = ensure(daily.date);
    row.manualMinutes = Math.max(row.manualMinutes, Math.max(0, Math.round(Number(daily.minutes) || 0)));
  }
  let totalMinutes = 0;
  for (const row of days.values()) {
    const extra = Math.max(0, row.manualMinutes - row.entryMinutes);
    if (extra > 0) row.subjects['기록 외 시간'] = (row.subjects['기록 외 시간'] || 0) + extra;
    row.minutes = Math.max(row.entryMinutes, row.manualMinutes);
    totalMinutes += row.minutes;
  }
  return { days, totalMinutes };
}

export function dayMinutes(agg, date) {
  return agg.days.get(date)?.minutes || 0;
}

export function summarizeRange(agg, from, to, goalMinutes = 360) {
  const dates = eachDate(from, to);
  const subjects = {};
  const weekdays = Array.from({ length: 7 }, () => 0);
  let total = 0;
  let activeDays = 0;
  let goalHits = 0;
  let focusSessions = 0;
  let timerSessions = 0;
  const trend = [];
  for (const date of dates) {
    const row = agg.days.get(date);
    const minutes = row?.minutes || 0;
    total += minutes;
    if (minutes > 0) activeDays += 1;
    if (minutes >= goalMinutes) goalHits += 1;
    focusSessions += row?.focusSessions || 0;
    timerSessions += row?.timerSessions || 0;
    weekdays[weekdayIndexMonday(date)] += minutes;
    if (row) {
      for (const [subject, value] of Object.entries(row.subjects)) {
        subjects[subject] = (subjects[subject] || 0) + value;
      }
    }
    trend.push({ date, minutes });
  }
  const ranked = Object.entries(subjects).sort((a, b) => b[1] - a[1]);
  const dayCount = dates.length || 1;
  return {
    from,
    to,
    total,
    dayCount,
    activeDays,
    average: total / dayCount,
    subjects,
    topSubject: ranked[0]?.[0] || null,
    topSubjectMinutes: ranked[0]?.[1] || 0,
    weekdays,
    goalHits,
    goalRate: goalHits / dayCount,
    focusSessions,
    timerSessions,
    trend,
    goalMinutes
  };
}

export function examCountdown(examDate, today, progressStart = CSAT_PROGRESS_START) {
  const days = isoDiffDays(today, examDate);
  const abs = Math.abs(days);
  const months = calendarMonths(today, examDate);
  const span = Math.max(1, isoDiffDays(progressStart, examDate));
  const done = isoDiffDays(progressStart, today);
  const progress = Math.min(1, Math.max(0, done / span));
  const marks = [100, 50, 30, 7, 1, 0].map(n => {
    const date = addIsoDays(examDate, -n);
    const until = isoDiffDays(today, date);
    return {
      id: n === 0 ? 'D-Day' : `D-${n}`,
      date,
      passed: until < 0,
      isToday: until === 0,
      daysUntil: until
    };
  });
  return {
    days,
    weeks: Math.floor(abs / 7),
    weekRem: abs % 7,
    months,
    progress,
    marks,
    isToday: days === 0,
    passed: days < 0
  };
}

export function backupPlan(lastDate, today, interval = BACKUP_INTERVAL_DAYS) {
  if (!lastDate) {
    return { due: true, lastDate: null, nextDate: today, daysSince: null };
  }
  const daysSince = isoDiffDays(lastDate, today);
  return {
    due: daysSince >= interval,
    lastDate,
    nextDate: addIsoDays(lastDate, interval),
    daysSince
  };
}

export function upsertReview(map, review) {
  const prev = map?.[review.date] || null;
  return {
    ...(map || {}),
    [review.date]: {
      ...review,
      createdAt: prev?.createdAt || review.createdAt,
      updatedAt: review.updatedAt || review.createdAt
    }
  };
}

export function sessionEntryId(sessionId, date) {
  return `sst-${sessionId}-${date}`;
}

export function segmentMinutes(segments = {}) {
  const out = {};
  for (const [date, ms] of Object.entries(segments)) {
    const minutes = Math.round(Number(ms) / 60000);
    if (minutes > 0) out[date] = minutes;
  }
  return out;
}
export function esc(value = '') {
  return String(value).replace(/[&<>"']/g, ch => ({
    '&': '\u0026amp;',
    '<': '\u0026lt;',
    '>': '\u0026gt;',
    '"': '\u0026quot;',
    "'": '\u0026#39;'
  }[ch]));
}

export const ANALYSIS_SUBJECTS = ['국어', '수학', '영어', '한국사', '탐구', '제2외국어', '기타'];

const PROBE_SUBJECTS = new Set(['통합사회', '통합과학', '사회탐구', '과학탐구', '탐구']);

export function analysisSubject(subject) {
  if (PROBE_SUBJECTS.has(subject)) return '탐구';
  if (ANALYSIS_SUBJECTS.includes(subject)) return subject;
  return '기타';
}

export function dailyOwlAppearance(minutes, { hasPlan = false, timerRunning = false } = {}) {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  const bands = [
    { id: 'h2', label: '학습 경과 약 2시간', min: 1, max: 120, next: 121 },
    { id: 'h4', label: '학습 경과 약 4시간', min: 121, max: 240, next: 241 },
    { id: 'h6', label: '학습 경과 약 6시간', min: 241, max: 360, next: 361 },
    { id: 'h8', label: '학습 경과 약 8시간', min: 361, max: 599, next: 600 },
    { id: 'h10', label: '학습 경과 10시간 이상', min: 600, max: Infinity, next: null }
  ];
  if (m <= 0) {
    if (timerRunning || hasPlan) {
      return { id: 'ready', label: '학습 대기', minutes: 0, next: 1, remain: 1, timerRunning: !!timerRunning };
    }
    return { id: 'before', label: '학습 전', minutes: 0, next: 1, remain: 1, timerRunning: false };
  }
  const band = bands.find(item => m >= item.min && m <= item.max) || bands[bands.length - 1];
  return {
    id: band.id,
    label: band.label,
    minutes: m,
    next: band.next,
    remain: band.next == null ? 0 : Math.max(0, band.next - m),
    timerRunning: !!timerRunning
  };
}

export function pendingFocusMinutes(subjectTimer, examTimer, today, now, dateOf) {
  let extra = 0;
  if (subjectTimer && typeof dateOf === 'function') {
    extra += Math.round((Number(subjectTimer.segments?.[today]) || 0) / 60000);
    if (subjectTimer.runningSince && subjectTimer.phase !== 'break') {
      const since = Date.parse(subjectTimer.runningSince);
      if (Number.isFinite(since)) {
        if (dateOf(since) === today) extra += Math.round(Math.max(0, now - since) / 60000);
        else if (dateOf(now) === today) {
          const [y, m, d] = String(today).split('-').map(Number);
          const midnight = new Date(y, (m || 1) - 1, d || 1).getTime();
          extra += Math.round(Math.max(0, now - midnight) / 60000);
        }
      }
    }
  }
  if (examTimer && examTimer.date === today) {
    const running = examTimer.runningSince ? Math.max(0, now - Date.parse(examTimer.runningSince)) : 0;
    const elapsed = (Number(examTimer.elapsedMs) || 0) + (Number.isFinite(running) ? running : 0);
    extra += Math.max(0, Math.round(elapsed / 60000));
  }
  return extra;
}

export function weekBounds(today) {
  const from = addIsoDays(today, -weekdayIndexMonday(today));
  return { from, to: addIsoDays(from, 6) };
}

export function monthBounds(today) {
  const [y, m] = String(today).split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const month = String(m).padStart(2, '0');
  return { from: `${y}-${month}-01`, to: `${y}-${month}-${String(last).padStart(2, '0')}` };
}

export function subjectWindows(agg, today) {
  const d7 = addIsoDays(today, -6);
  const d30 = addIsoDays(today, -29);
  const rows = {};
  for (const name of ANALYSIS_SUBJECTS) rows[name] = { today: 0, d7: 0, d30: 0, all: 0, period: 0 };
  let outside = 0;
  for (const row of agg.days.values()) {
    for (const [subject, minutes] of Object.entries(row.subjects || {})) {
      const value = Math.max(0, Math.round(Number(minutes) || 0));
      if (subject === '기록 외 시간') {
        outside += value;
        continue;
      }
      const bucket = analysisSubject(subject);
      rows[bucket].all += value;
      if (row.date === today) rows[bucket].today += value;
      if (row.date >= d7 && row.date <= today) rows[bucket].d7 += value;
      if (row.date >= d30 && row.date <= today) rows[bucket].d30 += value;
    }
  }
  return { rows, outside };
}

export function applyPeriodToWindows(windows, summary) {
  const next = {};
  for (const name of ANALYSIS_SUBJECTS) {
    next[name] = { ...windows.rows[name], period: 0 };
  }
  for (const [subject, minutes] of Object.entries(summary.subjects || {})) {
    if (subject === '기록 외 시간') continue;
    next[analysisSubject(subject)].period += minutes;
  }
  return next;
}

export function studyTimeline(entries, date) {
  return (entries || [])
    .filter(entry => entry?.date === date && Number(entry.minutes) > 0)
    .map(entry => {
      const stamp = entry.inputAt || entry.updatedAt || entry.createdAt || null;
      const end = stamp ? Date.parse(stamp) : NaN;
      const minutes = Math.round(Number(entry.minutes) || 0);
      const hasClock = Number.isFinite(end);
      return {
        id: entry.id,
        subject: entry.subject || '기타',
        minutes,
        content: entry.content || '',
        start: hasClock ? end - minutes * 60000 : null,
        end: hasClock ? end : null,
        estimated: hasClock
      };
    })
    .sort((a, b) => (a.start ?? Number.MAX_SAFE_INTEGER) - (b.start ?? Number.MAX_SAFE_INTEGER));
}

export const WARDROBE_SLOTS = [
  ['hat', '모자'],
  ['accessory', '장신구'],
  ['outfit', '의상'],
  ['effect', '환경 효과'],
  ['background', '배경'],
  ['special', '특수 효과']
];

export const WARDROBE_BASE = './assets/wardrobe/base.webp';

export const WARDROBE_ITEMS = [
  { id: 'hat-sprout', slot: 'hat', name: '새싹 모자', detail: '누적 공부 10시간', image: './assets/wardrobe/hat-sprout.webp', place: { left: 32, top: 24, width: 36 }, rule: { kind: 'minutes', value: 600 } },
  { id: 'hat-grad', slot: 'hat', name: '학사모', detail: '누적 공부 50시간', image: './assets/wardrobe/hat-grad.webp', place: { left: 29, top: 12, width: 42 }, rule: { kind: 'minutes', value: 3000 } },
  { id: 'hat-crown', slot: 'hat', name: '연속 왕관', detail: '7일 연속 공부', image: './assets/wardrobe/hat-crown.webp', place: { left: 32, top: 10, width: 36 }, rule: { kind: 'streak', value: 7 } },
  { id: 'acc-glasses', slot: 'accessory', name: '둥근 안경', detail: '누적 공부 100시간', image: './assets/wardrobe/acc-glasses.webp', place: { left: 24, top: 36, width: 52 }, rule: { kind: 'minutes', value: 6000 } },
  { id: 'acc-scarf', slot: 'accessory', name: '체크 목도리', detail: '레벨 5', image: './assets/wardrobe/acc-scarf.webp', place: { left: 27, top: 50, width: 46 }, rule: { kind: 'level', value: 5 } },
  { id: 'outfit-ribbon', slot: 'outfit', name: '리본 망토', detail: '레벨 3', image: './assets/wardrobe/outfit-ribbon.webp', place: { left: 25, top: 48, width: 50 }, rule: { kind: 'level', value: 3 } },
  { id: 'outfit-gown', slot: 'outfit', name: '심야 가운', detail: '누적 공부 200시간', image: './assets/wardrobe/outfit-gown.webp', place: { left: 9, top: 52, width: 82 }, rule: { kind: 'minutes', value: 12000 } },
  { id: 'fx-spark', slot: 'effect', name: '잔잔한 별', detail: '누적 공부 3시간', image: './assets/wardrobe/fx-spark.webp', place: { left: 0, top: 0, width: 100 }, rule: { kind: 'minutes', value: 180 } },
  { id: 'fx-flame', slot: 'effect', name: '집중 불꽃', detail: '하루 10시간 이상 공부한 날', image: './assets/wardrobe/fx-flame.webp', place: { left: 25, top: 68, width: 50 }, rule: { kind: 'maxDay', value: 600 } },
  { id: 'bg-night', slot: 'background', name: '밤 서재', detail: '레벨 2', image: './assets/wardrobe/bg-night.webp', rule: { kind: 'level', value: 2 } },
  { id: 'bg-dawn', slot: 'background', name: '새벽 숲', detail: '3일 연속 공부', image: './assets/wardrobe/bg-dawn.webp', rule: { kind: 'streak', value: 3 } },
  { id: 'sp-ember', slot: 'special', name: '성장 후광', detail: '영구 성장 5단계', image: './assets/wardrobe/sp-ember.webp', place: { left: 2, top: -2, width: 96 }, rule: { kind: 'stage', value: 5 } },
  { id: 'sp-book', slot: 'special', name: '과목 휘장', detail: '한 과목 누적 20시간', image: './assets/wardrobe/sp-book.webp', place: { left: 74, top: 62, width: 18 }, rule: { kind: 'subjectMax', value: 1200 } }
];

export function wardrobeStats(agg, streak = 0) {
  const level = levelState(agg?.totalMinutes || 0);
  const stage = owlStage(agg?.totalMinutes || 0);
  let maxDay = 0;
  const subjects = {};
  for (const row of agg?.days?.values?.() || []) {
    maxDay = Math.max(maxDay, row.minutes || 0);
    for (const [subject, minutes] of Object.entries(row.subjects || {})) {
      if (subject === '기록 외 시간') continue;
      const name = analysisSubject(subject);
      subjects[name] = (subjects[name] || 0) + minutes;
    }
  }
  return {
    minutes: Math.max(0, Math.round(Number(agg?.totalMinutes) || 0)),
    streak: Math.max(0, Math.round(Number(streak) || 0)),
    level: level.level,
    stage: stage.stage,
    maxDay,
    subjectMax: Math.max(0, ...Object.values(subjects), 0)
  };
}

export function wardrobeUnlocked(stats) {
  return WARDROBE_ITEMS.filter(item => Number(stats?.[item.rule.kind] || 0) >= item.rule.value);
}

export function emptyWardrobe() {
  return { hat: null, accessory: null, outfit: null, effect: null, background: null, special: null };
}

export function sanitizeWardrobe(state, unlockedIds) {
  const allowed = new Set(unlockedIds);
  const next = emptyWardrobe();
  for (const slot of Object.keys(next)) {
    const id = state?.[slot] || null;
    next[slot] = id && allowed.has(id) ? id : null;
  }
  return next;
}

export function gradeItem(row) {
  const answer = String(row?.answer ?? '').trim();
  const mine = String(row?.mine ?? '').trim();
  const points = row?.points === '' || row?.points == null ? null : Number(row.points);
  const correct = answer && mine ? answer === mine : null;
  return {
    no: String(row?.no ?? '').trim(),
    points: Number.isFinite(points) ? points : null,
    answer,
    mine,
    correct
  };
}

export function itemStats(items = []) {
  const graded = items.filter(item => item.correct === true || item.correct === false);
  const correct = graded.filter(item => item.correct).length;
  const earned = graded.reduce((sum, item) => sum + (item.correct ? Number(item.points) || 0 : 0), 0);
  const totalPoints = items.reduce((sum, item) => sum + (Number(item.points) || 0), 0);
  return {
    count: items.length,
    graded: graded.length,
    correct,
    wrong: graded.length - correct,
    pending: items.length - graded.length,
    earned,
    totalPoints
  };
}

export function cohortCompare(mine, cohort) {
  if (!cohort || cohort.average === '' || cohort.average == null || !String(cohort.source || '').trim() || !String(cohort.roundId || '').trim()) {
    return { available: false, label: '비교 데이터 없음' };
  }
  const average = Number(cohort.average);
  const score = Number(mine);
  if (!Number.isFinite(average) || !Number.isFinite(score)) return { available: false, label: '비교 데이터 없음' };
  return {
    available: true,
    average,
    delta: score - average,
    source: String(cohort.source).trim(),
    roundId: String(cohort.roundId).trim(),
    asOf: cohort.asOf || ''
  };
}

export function convertUniversity(target) {
  if (!target) return { ok: false, reason: '입력된 대학 자료가 없습니다.' };
  if (String(target.year || '') !== '2028') return { ok: false, reason: '2028학년도가 아니면 환산하지 않습니다.' };
  if (!String(target.source || '').trim() || !String(target.sourceDate || '').trim()) {
    return { ok: false, reason: '출처와 기준 날짜가 없어 계산하지 않습니다.' };
  }
  if (!String(target.university || '').trim() || !String(target.unit || '').trim()) {
    return { ok: false, reason: '대학과 모집단위가 필요합니다.' };
  }
  if (target.method === 'manual') {
    if (target.manualScore === '' || target.manualScore == null || !Number.isFinite(Number(target.manualScore))) {
      return { ok: false, reason: '직접 입력한 환산점수가 없습니다.' };
    }
    return { ok: true, score: Number(target.manualScore), estimated: true, method: 'manual' };
  }
  const areas = Array.isArray(target.areas) ? target.areas : [];
  if (!areas.length) return { ok: false, reason: '반영 영역이 없습니다.' };
  if (areas.some(area => area.score === '' || area.score == null || area.weight === '' || area.weight == null || !Number.isFinite(Number(area.score)) || !Number.isFinite(Number(area.weight)))) {
    return { ok: false, reason: '영역 점수나 가중치가 비어 계산하지 않습니다.' };
  }
  const weight = areas.reduce((sum, area) => sum + Number(area.weight), 0);
  if (!(weight > 0)) return { ok: false, reason: '가중치 합이 0보다 커야 합니다.' };
  const weighted = areas.reduce((sum, area) => sum + Number(area.score) * Number(area.weight), 0);
  const score = target.method === 'average' ? weighted / weight : weighted;
  return { ok: true, score, estimated: true, method: target.method === 'average' ? 'average' : 'sum' };
}

export function contentKey(item) {
  return [item?.subject, item?.type, item?.name, item?.provider]
    .map(value => String(value || '').trim().toLowerCase().replace(/\s+/g, ' '))
    .join('|');
}

export function contentProgress(item) {
  const total = Math.max(0, Number(item?.totalAmount) || 0);
  const done = Math.max(0, Number(item?.progress) || 0);
  if (!total) return { ratio: null, remain: null, done };
  return { ratio: Math.min(1, done / total), remain: Math.max(0, total - done), done };
}

export const SETTING_KEYS = {
  wardrobe: 'owlWardrobeState',
  content: 'studyContentDrawer',
  score: 'scoreAnalysisData',
  university: 'universityTargetConfig'
};
