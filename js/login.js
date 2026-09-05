import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';
import { auth } from './firebase.js?v=3';
import { createUserProfile } from './store.js?v=3';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const tabs = document.querySelectorAll('.tab');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const errorEl = document.getElementById('auth-error');

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function clearError() {
  errorEl.hidden = true;
  errorEl.textContent = '';
}

function setBusy(form, busy) {
  form.querySelectorAll('button, input').forEach((el) => (el.disabled = busy));
}

function friendlyError(err) {
  switch (err.code) {
    case 'auth/email-already-in-use':
      return '이미 가입된 이메일이에요.';
    case 'auth/invalid-email':
      return '올바른 이메일 형식이 아니에요.';
    case 'auth/weak-password':
      return '비밀번호는 6자 이상이어야 해요.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return '이메일 또는 비밀번호가 올바르지 않아요.';
    case 'auth/network-request-failed':
      return '네트워크 연결을 확인해주세요.';
    default:
      return '문제가 발생했어요. 잠시 후 다시 시도해주세요.';
  }
}

// Already signed in? skip the login screen.
onAuthStateChanged(auth, (user) => {
  if (user) window.location.href = './index.html';
});

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    tabs.forEach((t) => {
      t.classList.toggle('active', t === tab);
      t.setAttribute('aria-selected', String(t === tab));
    });
    const isLogin = tab.dataset.tab === 'login';
    loginForm.hidden = !isLogin;
    signupForm.hidden = isLogin;
    clearError();
  });
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();
  const email = loginForm.email.value.trim();
  const password = loginForm.password.value;

  setBusy(loginForm, true);
  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = './index.html';
  } catch (err) {
    showError(friendlyError(err));
  } finally {
    setBusy(loginForm, false);
  }
});

signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();
  const email = signupForm.email.value.trim();
  const password = signupForm.password.value;
  const nickname = signupForm.nickname.value.trim() || '슬립 루키';

  if (!EMAIL_RE.test(email)) return showError('올바른 이메일 형식이 아니에요.');
  if (password.length < 6) return showError('비밀번호는 6자 이상이어야 해요.');
  if (nickname.length > 20) return showError('닉네임은 20자 이하로 입력해주세요.');

  setBusy(signupForm, true);
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await createUserProfile(cred.user.uid, { email, nickname });
    window.location.href = './index.html';
  } catch (err) {
    showError(friendlyError(err));
  } finally {
    setBusy(signupForm, false);
  }
});
