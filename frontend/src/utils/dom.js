// ==================== Safe DOM helpers ====================

export const $ = (id) => document.getElementById(id);
export const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// Set text safely (never interprets HTML — the fix for the original stored-XSS bug).
export function setText(el, value) {
  if (el) el.textContent = value == null ? '' : String(value);
}

// Escape a string for safe interpolation if HTML really is needed.
export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

// Create an element with optional class, text, and attributes.
export function el(tag, { className, text, attrs } = {}) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = String(text);
  if (attrs) for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

export function clearChildren(node) {
  if (node) node.replaceChildren();
}
