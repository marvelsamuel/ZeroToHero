/**
 * utils.js — Small shared helpers used across every page: toasts, confetti,
 * DOM shorthand, formatting, and simple localStorage session helpers.
 */

const ZTH = window.ZTH || {};
window.ZTH = ZTH;

ZTH.utils = (function () {
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    });
    (children || []).forEach((c) => {
      if (c === null || c === undefined) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function ensureToastStack() {
    let stack = qs('.toast-stack');
    if (!stack) {
      stack = el('div', { class: 'toast-stack' });
      document.body.appendChild(stack);
    }
    return stack;
  }

  function toast(message, type) {
    const stack = ensureToastStack();
    const node = el('div', { class: 'speech-toast ' + (type || 'success') }, [message]);
    stack.appendChild(node);
    setTimeout(() => {
      node.style.transition = 'opacity 0.3s ease';
      node.style.opacity = '0';
      setTimeout(() => node.remove(), 300);
    }, 3400);
  }

  function confetti(count) {
    const colors = ['#E63946', '#1D3557', '#FFD60A', '#7209B7', '#2EC4B6', '#FF6B35'];
    for (let i = 0; i < (count || 60); i++) {
      const piece = el('div', { class: 'confetti-piece' });
      piece.style.left = Math.random() * 100 + 'vw';
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDuration = (2 + Math.random() * 1.5) + 's';
      piece.style.opacity = String(0.7 + Math.random() * 0.3);
      document.body.appendChild(piece);
      setTimeout(() => piece.remove(), 4000);
    }
  }

  function formatNumber(n) {
    return Number(n || 0).toLocaleString();
  }

  function timeAgo(isoOrDate) {
    const then = new Date(isoOrDate).getTime();
    if (isNaN(then)) return '';
    const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
    if (diffSec < 60) return 'just now';
    if (diffSec < 3600) return Math.floor(diffSec / 60) + 'm ago';
    if (diffSec < 86400) return Math.floor(diffSec / 3600) + 'h ago';
    return Math.floor(diffSec / 86400) + 'd ago';
  }

  function debounce(fn, wait) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function animateCounter(node, from, to, duration) {
    const start = performance.now();
    const dur = duration || 700;
    function step(now) {
      const progress = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - progress, 3);
      node.textContent = formatNumber(Math.round(from + (to - from) * eased));
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  return { qs, qsa, el, toast, confetti, formatNumber, timeAgo, debounce, animateCounter };
})();
