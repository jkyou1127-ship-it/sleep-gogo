import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';
import { auth, ADMIN_EMAIL } from './firebase.js';
import { computeTotalPoints } from './points.js';
import {
  getUserProfile,
  getAllUserProfiles,
  updateUserProfile,
  deleteUserProfile,
  getRecords,
  getAllCoupons,
  findCouponByCode,
  markCouponUsed,
} from './store.js';

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
  const profile = await getUserProfile(authUser.uid);
  if (!profile || profile.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    window.location.href = './index.html';
    return;
  }

  const els = {
    greeting: document.getElementById('greeting'),
    logoutBtn: document.getElementById('logout-btn'),
    userCount: document.getElementById('admin-user-count'),
    pendingWon: document.getElementById('admin-pending-won'),
    settledWon: document.getElementById('admin-settled-won'),
    redeemForm: document.getElementById('redeem-form'),
    redeemResult: document.getElementById('redeem-result'),
    couponsBody: document.getElementById('coupons-body'),
    usersBody: document.getElementById('users-body'),
    toast: document.getElementById('toast'),
  };

  els.greeting.textContent = `관리자 · ${profile.nickname}`;

  els.logoutBtn.addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = './login.html';
  });

  function won(n) {
    return `${(n || 0).toLocaleString('ko-KR')}원`;
  }

  let toastTimer = null;
  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2600);
  }

  async function renderCoupons() {
    const coupons = await getAllCoupons();
    const pending = coupons.filter((c) => c.status === 'unused').reduce((s, c) => s + c.won, 0);
    const settled = coupons.filter((c) => c.status === 'used').reduce((s, c) => s + c.won, 0);
    els.pendingWon.textContent = won(pending);
    els.settledWon.textContent = won(settled);

    if (!coupons.length) {
      els.couponsBody.innerHTML = `<div class="empty-box">발행된 쿠폰이 없다.</div>`;
      return;
    }
    els.couponsBody.innerHTML = `
      <div class="record-list">
        ${coupons
          .map(
            (c) => `
          <div class="record-row">
            <span class="r-date" style="width:auto">${c.code}</span>
            <span class="r-times">${c.nickname} · ${won(c.won)}</span>
            ${
              c.status === 'used'
                ? `<span class="r-points muted">사용됨</span>`
                : `<button type="button" class="btn-mini" data-redeem="${c.code}">사용 처리</button>`
            }
          </div>`
          )
          .join('')}
      </div>`;

    els.couponsBody.querySelectorAll('[data-redeem]').forEach((btn) => {
      btn.addEventListener('click', () => redeemCode(btn.dataset.redeem));
    });
  }

  async function renderUsers() {
    const users = await getAllUserProfiles();
    els.userCount.textContent = users.length;

    const rows = await Promise.all(
      users.map(async (u) => {
        const records = await getRecords(u.uid);
        const totalPoints = computeTotalPoints(records) + (u.adminAdjustment || 0);
        return { ...u, recordCount: records.length, totalPoints };
      })
    );

    els.usersBody.innerHTML = rows
      .map(
        (u) => `
      <div class="admin-user-row">
        <div class="admin-user-info">
          <strong>${u.nickname}</strong> <span class="muted">${u.email}</span><br />
          <span class="muted">기록 ${u.recordCount}일 · 보유 ${u.totalPoints}P · 전환됨 ${u.convertedPoints || 0}P · 조정 ${u.adminAdjustment || 0}P</span>
        </div>
        <div class="admin-user-actions">
          <input type="number" class="mini-input" placeholder="포인트" data-amount="${u.uid}" />
          <button type="button" class="btn-mini" data-grant="${u.uid}">지급</button>
          <button type="button" class="btn-mini" data-deduct="${u.uid}">차감</button>
          <button type="button" class="btn-mini btn-mini-danger" data-reset="${u.uid}">초기화</button>
        </div>
      </div>`
      )
      .join('');

    els.usersBody.querySelectorAll('[data-grant]').forEach((btn) => {
      btn.addEventListener('click', () => adjustPoints(btn.dataset.grant, 1));
    });
    els.usersBody.querySelectorAll('[data-deduct]').forEach((btn) => {
      btn.addEventListener('click', () => adjustPoints(btn.dataset.deduct, -1));
    });
    els.usersBody.querySelectorAll('[data-reset]').forEach((btn) => {
      btn.addEventListener('click', () => resetUser(btn.dataset.reset));
    });
  }

  async function adjustPoints(uid, sign) {
    const input = els.usersBody.querySelector(`[data-amount="${uid}"]`);
    const amount = Number(input.value);
    if (!amount || amount <= 0) {
      showToast('지급/차감할 포인트를 입력해주세요.');
      return;
    }
    const target = (await getAllUserProfiles()).find((u) => u.uid === uid);
    if (!target) return;
    const newAdjustment = (target.adminAdjustment || 0) + sign * amount;
    await updateUserProfile(uid, { adminAdjustment: newAdjustment });
    showToast(`${sign > 0 ? '지급' : '차감'} 완료 (${amount}P)`);
    await renderUsers();
  }

  async function resetUser(uid) {
    const target = (await getAllUserProfiles()).find((u) => u.uid === uid);
    if (!target) return;
    if (!confirm(`${target.nickname}(${target.email})의 기록과 포인트 조정값을 모두 초기화할까요?\n로그인 계정 자체는 삭제되지 않아요.`)) return;
    await deleteUserProfile(uid);
    showToast('초기화했어요.');
    await renderUsers();
  }

  async function redeemCode(rawCode) {
    const code = rawCode.trim().toUpperCase();
    if (!code) return;
    const coupon = await findCouponByCode(code);
    if (!coupon) {
      els.redeemResult.classList.add('error');
      els.redeemResult.textContent = '존재하지 않는 코드예요.';
      return;
    }
    if (coupon.status === 'used') {
      els.redeemResult.classList.add('error');
      els.redeemResult.textContent = `이미 사용된 쿠폰이에요. (${coupon.nickname} · ${won(coupon.won)})`;
      return;
    }
    await markCouponUsed(code, profile.email);
    els.redeemResult.classList.remove('error');
    els.redeemResult.textContent = `${coupon.nickname}님의 ${won(coupon.won)} 쿠폰을 사용 처리했어요!`;
    showToast('사용 처리 완료!');
    await renderCoupons();
  }

  els.redeemForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await redeemCode(els.redeemForm.code.value);
    els.redeemForm.reset();
  });

  await renderCoupons();
  await renderUsers();
}
