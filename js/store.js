// localStorage-backed data layer. GitHub Pages only serves static files, so
// there is no real server — every "account" lives in the visiting browser.
// This gates the app behind a login screen and keeps each nickname's data
// separate, but it is not real multi-device authentication or security.

const USERS_KEY = 'sq_users';
const SESSION_KEY = 'sq_session';

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getUsers() {
  return readJSON(USERS_KEY, {});
}

function saveUsers(users) {
  writeJSON(USERS_KEY, users);
}

export function findUser(email) {
  const key = email.trim().toLowerCase();
  return getUsers()[key] || null;
}

export function createUser({ email, nickname, salt, hash }) {
  const key = email.trim().toLowerCase();
  const users = getUsers();
  const user = { email: key, nickname, salt, hash, convertedPoints: 0, cashWon: 0, createdAt: new Date().toISOString() };
  users[key] = user;
  saveUsers(users);
  return user;
}

export function updateUser(email, patch) {
  const key = email.trim().toLowerCase();
  const users = getUsers();
  if (!users[key]) return null;
  Object.assign(users[key], patch);
  saveUsers(users);
  return users[key];
}

export function getSessionEmail() {
  return localStorage.getItem(SESSION_KEY);
}

export function setSessionEmail(email) {
  localStorage.setItem(SESSION_KEY, email.trim().toLowerCase());
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function getCurrentUser() {
  const email = getSessionEmail();
  if (!email) return null;
  return findUser(email);
}

function recordsKey(email) {
  return `sq_records_${email.trim().toLowerCase()}`;
}

export function getRecords(email) {
  return readJSON(recordsKey(email), []);
}

export function upsertRecord(email, record) {
  const list = getRecords(email);
  const idx = list.findIndex((r) => r.date === record.date);
  if (idx >= 0) list[idx] = record;
  else list.push(record);
  list.sort((a, b) => a.date.localeCompare(b.date));
  writeJSON(recordsKey(email), list);
  return list;
}
