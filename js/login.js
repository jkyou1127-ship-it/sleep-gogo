import { EMAIL_RE, hashPassword, verifyPassword } from './auth.js';
import { findUser, createUser, setSessionEmail } from './store.js';

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

  const user = findUser(email);
  if (!user || !(await verifyPassword(password, user.salt, user.hash))) {
    showError('이메일 또는 비밀번호가 올바르지 않아요.');
    return;
  }
  setSessionEmail(user.email);
  window.location.href = './index.html';
});

signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();
  const email = signupForm.email.value.trim();
  const password = signupForm.password.value;
  const nickname = signupForm.nickname.value.trim() || '슬립 루키';

  if (!EMAIL_RE.test(email)) return showError('올바른 이메일 형식이 아니에요.');
  if (password.length < 8) return showError('비밀번호는 8자 이상이어야 해요.');
  if (nickname.length > 20) return showError('닉네임은 20자 이하로 입력해주세요.');
  if (findUser(email)) return showError('이미 가입된 이메일이에요.');

  const { salt, hash } = await hashPassword(password);
  const user = createUser({ email, nickname, salt, hash });
  setSessionEmail(user.email);
  window.location.href = './index.html';
});
