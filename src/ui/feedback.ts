import { h } from './dom';

export const FEEDBACK_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSeI9edetPjzSEB8JN81SY0U8xmBbT9ic-3SDzECsnkKcslnBQ/viewform';

/** A link to the public feedback form, which opens in a new tab. */
export function feedbackLink(text: string, cls?: string): HTMLAnchorElement {
  return h(
    'a',
    { href: FEEDBACK_URL, target: '_blank', rel: 'noopener', class: cls },
    text,
    h('span', { class: 'visually-hidden' }, ' (opens in a new tab)'),
  );
}
