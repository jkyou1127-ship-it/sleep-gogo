// Firestore-backed data layer. Real backend now (Firebase Auth + Firestore),
// so data is shared across devices/browsers. Access control is enforced by
// firestore.rules, not by this file — treat that file as the source of
// truth for who can actually do what.
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
  increment,
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import { db } from './firebase.js?v=3';

export async function createUserProfile(uid, { email, nickname }) {
  const ref = doc(db, 'users', uid);
  const profile = {
    email: email.trim().toLowerCase(),
    nickname,
    convertedPoints: 0,
    adminAdjustment: 0,
    settledWon: 0,
    createdAt: serverTimestamp(),
  };
  await setDoc(ref, profile);
  return { uid, ...profile };
}

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}

export async function updateUserProfile(uid, patch) {
  await updateDoc(doc(db, 'users', uid), patch);
}

export async function deleteUserProfile(uid) {
  const recordsSnap = await getDocs(collection(db, 'users', uid, 'records'));
  await Promise.all(recordsSnap.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(doc(db, 'users', uid));
}

export async function getAllUserProfiles() {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

export async function getRecords(uid) {
  const snap = await getDocs(collection(db, 'users', uid, 'records'));
  const records = snap.docs.map((d) => d.data());
  records.sort((a, b) => a.date.localeCompare(b.date));
  return records;
}

export async function upsertRecord(uid, record) {
  await setDoc(doc(db, 'users', uid, 'records', record.date), record);
}

export async function addCoupon(coupon) {
  await setDoc(doc(db, 'coupons', coupon.code), coupon);
}

export async function getUserCoupons(uid) {
  const q = query(collection(db, 'coupons'), where('uid', '==', uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data()).sort((a, b) => b.issuedAt - a.issuedAt);
}

export async function getAllCoupons() {
  const snap = await getDocs(collection(db, 'coupons'));
  return snap.docs.map((d) => d.data()).sort((a, b) => b.issuedAt - a.issuedAt);
}

export async function findCouponByCode(code) {
  const snap = await getDoc(doc(db, 'coupons', code));
  return snap.exists() ? snap.data() : null;
}

// Marking a coupon used settles it immediately: the owner's running
// settledWon total goes up and the coupon is deleted (used coupons don't
// stick around — a coupon in the collection always means "still pending").
export async function markCouponUsed(coupon) {
  await updateUserProfile(coupon.uid, { settledWon: increment(coupon.won) });
  await deleteDoc(doc(db, 'coupons', coupon.code));
}
