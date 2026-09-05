// Coupon codes are just short random ids — Firestore (see store.js) is the
// real source of truth for whether a code exists and its status, so the
// code itself doesn't need to encode anything.
export function randomCouponCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let out = '';
  for (let i = 0; i < 8; i++) out += chars[bytes[i] % chars.length];
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}
