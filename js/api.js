/**
 * api.js — Single point of contact with the Google Apps Script backend.
 *
 * IMPORTANT: set window.ZTH_CONFIG.API_URL to your deployed Apps Script
 * Web App URL (see config.js). Every other module calls `ZTH.api.call(...)`
 * and never touches fetch() directly.
 *
 * We use GET with the payload as a URL-encoded JSON string. Apps Script Web
 * Apps handle plain GET requests without a CORS preflight, which keeps this
 * reliable when the frontend is hosted somewhere other than script.google.com
 * (GitHub Pages, a school laptop opening index.html directly, etc.).
 */

window.ZTH = window.ZTH || {};

window.ZTH.api = (function () {
  function getBaseUrl() {
    const url = (window.ZTH_CONFIG && window.ZTH_CONFIG.API_URL) || '';
    if (!url || url.indexOf('PASTE_YOUR') !== -1) {
      throw new Error('Zero to Hero is not connected yet. Open js/config.js and paste your Apps Script Web App URL into API_URL.');
    }
    return url;
  }

  async function call(action, payload) {
    const base = getBaseUrl();
    const params = new URLSearchParams();
    params.set('action', action);
    params.set('payload', JSON.stringify(payload || {}));

    let response;
    try {
      response = await fetch(base + '?' + params.toString(), { method: 'GET' });
    } catch (networkErr) {
      throw new Error('Could not reach the scoreboard server. Check your internet connection.');
    }

    let json;
    try {
      json = await response.json();
    } catch (parseErr) {
      throw new Error('The server returned something unexpected. Please try again.');
    }

    if (!json.ok) {
      throw new Error(json.error || 'Something went wrong.');
    }
    return json.data;
  }

  return { call };
})();
