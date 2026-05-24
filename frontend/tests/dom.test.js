import { describe, it, expect } from 'vitest';
import { escapeHtml, setText, el } from '../src/utils/dom.js';

describe('DOM helpers (XSS-safe)', () => {
  it('escapes HTML special chars', () => {
    expect(escapeHtml('<img onerror=x>')).toBe('&lt;img onerror=x&gt;');
  });

  it('setText never interprets markup', () => {
    const div = document.createElement('div');
    setText(div, '<b>x</b>');
    expect(div.querySelector('b')).toBeNull();
    expect(div.textContent).toBe('<b>x</b>');
  });

  it('el() sets text content, not HTML', () => {
    const td = el('td', { text: '<script>alert(1)</script>' });
    expect(td.querySelector('script')).toBeNull();
    expect(td.textContent).toBe('<script>alert(1)</script>');
  });
});
