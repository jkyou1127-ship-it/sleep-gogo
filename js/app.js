import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';
import { auth, ADMIN_EMAIL } from './firebase.js';
import {
  today,
  formatDate,
  computeTotalPoints,
  computeDayPoints,
  currentStreakAsOf,
  computeBadges,
  levelInfo,
  analyzeConditionByBedtime,
  convertibleSummary,
  sleepDurationMinutes,
  POINTS_PER_UNIT,
} from './points.js';
import {
  getUserProfile,
  createUserProfile,
  updateUserProfile,
  getRecords,
  upsertRecord,
  getUserCoupons,
  addCoupon,
} from './store.js';
import { randomCouponCode } from './coupon.js';

const CONDITION_EMOJI = { 1: '🥵', 2: '😪', 3: '😐', 4: '🙂', 5: '😄' };

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = './login.html';
    return;
  }
  main(user).catch((err) => {
    console.error(err);
    alert('데이터를 불러오지 못했어요. 새로고침해주세요.');
  });
});

async function main(authUser) {
  let profile = await getUserProfile(authUser.uid);
  if (!profile) {
    profile = await createUserProfile(authUser.uid, {
      email: authUser.email,
      nickname: authUser.email.split('@')[0],
    });
  }

  const els = {
    greeting: document.getElementById('greeting'),
    logoutBtn: document.getElementById('logout-btn'),
    adminLink: document.getElementById('admin-link'),
    headerDate: document.getElementById('header-date'),
    totalPoints: document.getElementById('total-points'),
    pointsSub: document.getElementById('points-sub'),
    couponSummary: document.getElementById('coupon-summary'),
    convertHint: document.getElementById('convert-hint'),
    convertBtn: document.getElementById('convert-btn'),
    statStreak: document.getElementById('stat-streak'),
    statRecords: document.getElementById('stat-records'),
    statBadges: document.getElementById('stat-badges'),
    levelNum: document.getElementById('level-num'),
    levelTitle: document.getElementById('level-title'),
    levelNeed: document.getElementById('level-need'),
    levelFill: document.getElementById('level-fill'),
    checkinForm: document.getElementById('checkin-form'),
    checkinResult: document.getElementById('checkin-result'),
    badgeGrid: document.getElementById('badge-grid'),
    analysisBody: document.getElementById('analysis-body'),
    recordsBody: document.getElementById('records-body'),
    couponsBody: document.getElementById('coupons-body'),
    toast: document.getElementById('toast'),
  };

  if (profile.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    els.adminLink.hidden = false;
  }

  function won(n) {
    return `${n.toLocaleString('ko-KR')}원`;
  }

  function formatHeaderDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const weekday = new Intl.DateTimeFormat('ko-KR', { weekday: 'short' }).format(d);
    return `${d.getMonth() + 1}/${d.getDate()} ${weekday}`;
  }

  function formatTimeKorean(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    const period = h < 12 ? '오전' : '오후';
    let h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return `${period} ${h12}:${String(m).padStart(2, '0')}`;
  }

  function formatDuration(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}시간 ${m}분` : `${h}시간`;
  }

  let toastTimer = null;
  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2600);
  }

  function selectedValue(groupEl) {
    const btn = groupEl.querySelector('.opt-btn.selected');
    return btn ? btn.dataset.value : null;
  }

  function selectOption(groupId, value) {
    const group = document.getElementById(groupId);
    group.querySelectorAll('.opt-btn').forEach((b) => b.classList.toggle('selected', b.dataset.value === value));
  }

  function setupOptionGroup(groupEl) {
    groupEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.opt-btn');
      if (!btn) return;
      groupEl.querySelectorAll('.opt-btn').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  }

  ['condition-group', 'temp-group', 'light-group'].forEach((id) => setupOptionGroup(document.getElementById(id)));

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      showToast('복사했어요!');
    } catch {
      showToast(text);
    }
  }
  window.__sqCopy = copyText;

  async function render() {
    const records = await getRecords(authUser.uid);
    const coupons = await getUserCoupons(authUser.uid);
    const totalPoints = computeTotalPoints(records) + (profile.adminAdjustment || 0);
    const todayStr = today();
    const todayRecord = records.find((r) => r.date === todayStr) || null;

    const yesterdayDate = new Date(todayStr + 'T00:00:00');
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = formatDate(yesterdayDate);
    const streak = todayRecord ? todayRecord.streak : currentStreakAsOf(records, yesterday);

    const badges = computeBadges(records, totalPoints);
    const level = levelInfo(totalPoints);
    const analysis = analyzeConditionByBedtime(records);
    const wallet = convertibleSummary(totalPoints, profile.convertedPoints || 0);
    const recent = records.slice(-14).reverse();

    const pendingWon = coupons.filter((c) => c.status === 'unused').reduce((s, c) => s + c.won, 0);
    const settledWon = coupons.filter((c) => c.status === 'used').reduce((s, c) => s + c.won, 0);

    els.greeting.textContent = `안녕하세요, ${profile.nickname}님`;
    els.headerDate.textContent = formatHeaderDate(todayStr);
    els.totalPoints.textContent = totalPoints.toLocaleString('ko-KR');
    els.pointsSub.textContent = `전환 가능 ${wallet.availablePoints.toLocaleString('ko-KR')}P`;
    els.couponSummary.innerHTML = `미사용 쿠폰 <strong>${won(pendingWon)}</strong><br /><span class="muted">정산 완료 ${won(settledWon)}</span>`;
    els.convertHint.textContent =
      wallet.convertibleWon > 0
        ? `지금 ${won(wallet.convertibleWon)} 쿠폰 발행 가능!`
        : `${POINTS_PER_UNIT}P를 모으면 전환할 수 있어요. (${wallet.pointsUntilNextUnit}P 남음)`;
    els.convertBtn.disabled = wallet.convertibleWon <= 0;

    els.statStreak.textContent = streak;
    els.statRecords.textContent = records.length;
    els.statBadges.textContent = badges.filter((b) => b.done).length;

    els.levelNum.textContent = level.level;
    els.levelTitle.textContent = level.title;
    els.levelNeed.textContent = level.neededForNext;
    const progressPct = Math.min(100, Math.round(((level.perLevel - level.neededForNext) / level.perLevel) * 100));
    els.levelFill.style.width = `${progressPct}%`;

    if (todayRecord) {
      els.checkinForm.screenOffTime.value = todayRecord.screenOffTime;
      els.checkinForm.sleepTime.value = todayRecord.sleepTime;
      els.checkinForm.wakeTime.value = todayRecord.wakeTime;
      selectOption('condition-group', String(todayRecord.condition));
      selectOption('temp-group', todayRecord.roomTemp);
      selectOption('light-group', todayRecord.roomLight);
      els.checkinForm.querySelector('#checkin-submit').textContent = '오늘 기록 수정하기';
    }

    els.badgeGrid.innerHTML = badges
      .map(
        (b) => `
      <div class="badge-cell ${b.done ? 'earned' : ''}">
        <span class="badge-icon">${b.icon}</span>
        <span class="badge-name">${b.name}</span>
      </div>`
      )
      .join('');

    if (!analysis.ready) {
      els.analysisBody.innerHTML = `
        <div class="empty-box">
          기록 ${analysis.have}일 / ${analysis.minRecords}일<br />
          ${analysis.needed}일만 더 모으면 결과가 나온다.
        </div>`;
    } else {
      els.analysisBody.innerHTML = `
        <div class="analysis-rows">
          ${analysis.rows
            .map(
              (r) => `
            <div class="analysis-row">
              <span class="label">${r.label}</span>
              <span class="bar-track"><span class="bar-fill" style="width:${(r.avg / 5) * 100}%"></span></span>
              <span class="value">${r.avg} / 5</span>
            </div>`
            )
            .join('')}
        </div>`;
    }

    if (!recent.length) {
      els.recordsBody.innerHTML = `<div class="empty-box">아직 기록이 없다.<br />오늘부터 시작.</div>`;
    } else {
      els.recordsBody.innerHTML = `
        <div class="record-list">
          ${recent
            .map((r) => {
              const d = new Date(r.date + 'T00:00:00');
              return `
            <div class="record-row">
              <span class="r-date">${d.getMonth() + 1}/${d.getDate()}</span>
              <span class="r-times">${CONDITION_EMOJI[r.condition]} ${formatTimeKorean(r.sleepTime)} 취침 · ${formatDuration(
                sleepDurationMinutes(r.sleepTime, r.wakeTime)
              )} 수면</span>
              <span class="r-points">+${r.points}P</span>
            </div>`;
            })
            .join('')}
        </div>`;
    }

    if (!coupons.length) {
      els.couponsBody.innerHTML = `<div class="empty-box">발행된 쿠폰이 없다.<br />포인트를 모아 전환해보자.</div>`;
    } else {
      els.couponsBody.innerHTML = `
        <div class="record-list">
          ${coupons
            .map(
              (c) => `
            <div class="record-row">
              <span class="r-date" style="width:auto">
                <button type="button" class="btn-link" onclick="window.__sqCopy('${c.code}')">${c.code}</button>
              </span>
              <span class="r-times">${won(c.won)}</span>
              <span class="r-points ${c.status === 'used' ? 'muted' : ''}">${c.status === 'used' ? '사용됨' : '미사용'}</span>
            </div>`
            )
            .join('')}
        </div>`;
    }
  }

  els.checkinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = els.checkinForm;
    const screenOffTime = form.screenOffTime.value;
    const sleepTime = form.sleepTime.value;
    const wakeTime = form.wakeTime.value;
    const condition = Number(selectedValue(document.getElementById('condition-group')));
    const roomTemp = selectedValue(document.getElementById('temp-group'));
    const roomLight = selectedValue(document.getElementById('light-group'));

    if (!screenOffTime || !sleepTime || !wakeTime) {
      els.checkinResult.textContent = '시간을 모두 입력해주세요.';
      els.checkinResult.classList.add('error');
      return;
    }

    const todayStr = today();
    const records = await getRecords(authUser.uid);
    const otherRecords = records.filter((r) => r.date !== todayStr);
    const { total, breakdown, streak } = computeDayPoints({ screenOffTime, sleepTime, wakeTime }, otherRecords, todayStr);

    const record = {
      date: todayStr,
      screenOffTime,
      sleepTime,
      wakeTime,
      condition,
      roomTemp,
      roomLight,
      points: total,
      breakdown,
      streak,
      updatedAt: new Date().toISOString(),
    };
    await upsertRecord(authUser.uid, record);

    els.checkinResult.classList.remove('error');
    els.checkinResult.textContent = `+${total}P 획득! (연속 ${streak}일째)`;
    showToast(`오늘 기록 완료! +${total}P`);
    await render();
  });

  els.convertBtn.addEventListener('click', async () => {
    els.convertBtn.disabled = true;
    const records = await getRecords(authUser.uid);
    const totalPoints = computeTotalPoints(records) + (profile.adminAdjustment || 0);
    const summary = convertibleSummary(totalPoints, profile.convertedPoints || 0);
    if (summary.convertibleWon <= 0) {
      await render();
      return;
    }

    const coupon = {
      code: randomCouponCode(),
      uid: authUser.uid,
      email: profile.email,
      nickname: profile.nickname,
      points: summary.pointsUsedIfConverted,
      won: summary.convertibleWon,
      status: 'unused',
      issuedAt: Date.now(),
      usedAt: null,
      usedBy: null,
    };
    await addCoupon(coupon);

    profile.convertedPoints = (profile.convertedPoints || 0) + summary.pointsUsedIfConverted;
    await updateUserProfile(authUser.uid, { convertedPoints: profile.convertedPoints });

    showToast(`쿠폰 발행! 코드: ${coupon.code}`);
    await render();
  });

  els.logoutBtn.addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = './login.html';
  });

  await render();
}
