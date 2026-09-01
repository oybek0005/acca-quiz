/**
 * HTML sanitisation for anything rendered via dangerouslySetInnerHTML.
 * The question bank, imported backups and AI responses all flow through here.
 */

import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
  'b', 'strong', 'i', 'em', 'u', 's', 'br', 'p', 'span', 'div',
  'ul', 'ol', 'li', 'code', 'pre', 'sub', 'sup', 'small',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'h4', 'h5', 'h6',
];
const ALLOWED_ATTR = ['class'];

/** Sanitise a trusted-ish HTML string down to a safe formatting subset. */
export function sanitizeHtml(dirty: string | null | undefined): string {
  const input = String(dirty ?? '');
  if (typeof window === 'undefined') {
    // SSR: strip every tag rather than ship unsanitised markup.
    return input.replace(/<[^>]*>/g, '');
  }
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick'],
    ALLOW_DATA_ATTR: false,
  });
}

/** Convenience for dangerouslySetInnerHTML props. */
export function safeHtml(dirty: string | null | undefined): { __html: string } {
  return { __html: sanitizeHtml(dirty) };
}
