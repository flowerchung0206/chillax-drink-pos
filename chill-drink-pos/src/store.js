import { db } from "./firebase.js";
import { ref, get, set, onValue, off } from "firebase/database";

/** one-time read */
export async function dbGet(path, fallback) {
  try {
    const snap = await get(ref(db, path));
    return snap.exists() ? snap.val() : fallback;
  } catch (e) {
    console.error("dbGet failed:", path, e);
    return fallback;
  }
}

/** overwrite a whole node */
export async function dbSet(path, value) {
  try {
    await set(ref(db, path), value);
    return true;
  } catch (e) {
    console.error("dbSet failed:", path, e);
    return false;
  }
}

/** live subscription — callback fires immediately with current value, then on every change */
export function dbListen(path, callback) {
  const r = ref(db, path);
  const handler = (snap) => callback(snap.exists() ? snap.val() : null);
  onValue(r, handler);
  return () => off(r, "value", handler);
}
