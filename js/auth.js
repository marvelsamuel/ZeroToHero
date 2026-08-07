/**
 * auth.js — Login form wiring, session persistence in localStorage, and
 * page guards. The token is only ever a lookup key: every judge/admin
 * action is re-validated against the Sessions sheet and the caller's role
 * on the server, so localStorage is just a convenience cache, not a trust
 * boundary.
 */

window.ZTH = window.ZTH || {};

window.ZTH.auth = (function () {
  const STORAGE_KEY = 'zth_session';

  function getSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setSession(session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }

  function clearSession() {
    localStorage.removeItem(STORAGE_KEY);
  }

  async function login(username, password) {
    const data = await ZTH.api.call('login', { username, password });
    setSession(data);
    return data;
  }

  async function logout() {
    const session = getSession();
    if (session) {
      try { await ZTH.api.call('logout', { token: session.token }); } catch (e) { /* ignore */ }
    }
    clearSession();
  }

  /**
   * Call at the top of any protected page. Redirects to login.html if there
   * is no local session, and re-validates with the server. If allowedRoles
   * is given and the session's role isn't in it, redirects to a safe page.
   */
  async function requireSession(allowedRoles) {
    const session = getSession();
    if (!session || !session.token) {
      window.location.href = 'login.html';
      return null;
    }
    try {
      const check = await ZTH.api.call('validateSession', { token: session.token });
      if (!check.valid) {
        clearSession();
        window.location.href = 'login.html';
        return null;
      }
      if (allowedRoles && allowedRoles.indexOf(check.role) === -1) {
        window.location.href = check.role === 'Admin' ? 'admin.html' : 'judge.html';
        return null;
      }
      return session;
    } catch (e) {
      // Network hiccup: fall back to the trusted local session rather than
      // locking the judge out mid-camp; server still re-checks every write.
      return session;
    }
  }

  function roleLabel(role) {
    const labels = {
      Admin: 'Camp Admin',
      'Games Judge': 'Games Judge',
      'Bible Judge': 'Bible Judge',
      'Individual Judge': 'Individual Judge',
      'Mentor Judge': 'Mentor Judge'
    };
    return labels[role] || role;
  }

  return { getSession, setSession, clearSession, login, logout, requireSession, roleLabel };
})();
