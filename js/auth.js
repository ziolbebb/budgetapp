/* ============================================
   BUDŻETAPP — js/auth.js
   Authentication: login, logout, password mgmt
   ============================================ */

const Auth = (() => {

  // Default password hash (SHA-256 of "budzetapp2024")
  // Users should change this on first login.
  const DEFAULT_PW = "budzetapp2024";
  const STORAGE_KEY_HASH = "bp_pw_hash";
  const STORAGE_KEY_SESSION = "bp_session";
  const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours

  // Simple string hash (not cryptographic, but good enough for local storage)
  async function hashPassword(pw) {
    const encoder = new TextEncoder();
    const data = encoder.encode(pw + "::budzetapp_salt_v1");
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  }

  async function getStoredHash() {
    const stored = localStorage.getItem(STORAGE_KEY_HASH);
    if (!stored) {
      // First run: store default password hash
      const h = await hashPassword(DEFAULT_PW);
      localStorage.setItem(STORAGE_KEY_HASH, h);
      return h;
    }
    return stored;
  }

  async function login(password) {
    const inputHash = await hashPassword(password);
    const storedHash = await getStoredHash();
    if (inputHash === storedHash) {
      const session = { ts: Date.now() };
      localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
      return true;
    }
    return false;
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY_SESSION);
  }

  function isLoggedIn() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SESSION);
      if (!raw) return false;
      const session = JSON.parse(raw);
      if (Date.now() - session.ts > SESSION_DURATION_MS) {
        localStorage.removeItem(STORAGE_KEY_SESSION);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  async function changePassword(oldPw, newPw) {
    const oldHash = await hashPassword(oldPw);
    const storedHash = await getStoredHash();
    if (oldHash !== storedHash) return { ok: false, msg: "Stare hasło jest nieprawidłowe." };
    if (newPw.length < 6) return { ok: false, msg: "Nowe hasło musi mieć co najmniej 6 znaków." };
    const newHash = await hashPassword(newPw);
    localStorage.setItem(STORAGE_KEY_HASH, newHash);
    return { ok: true };
  }

  function isDefaultPassword() {
    // Can't sync-check without async, so we expose async version
    return false;
  }

  return { login, logout, isLoggedIn, changePassword, DEFAULT_PW };
})();
