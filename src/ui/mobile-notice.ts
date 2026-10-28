import { h } from './dom';

export const MOBILE_QUERY = '(max-width: 900px), (hover: none) and (pointer: coarse)';
const DISMISSED_KEY = 'lobster.mobileNotice.dismissed';

type Media = (query: string) => { matches: boolean };
type Store = Pick<Storage, 'getItem'>;

export function shouldShowMobileNotice(media: Media, storage: Store | undefined): boolean {
  if (!media(MOBILE_QUERY).matches) return false;
  try {
    return storage?.getItem(DISMISSED_KEY) !== '1';
  } catch {
    return true;
  }
}

/** Tells phone and tablet visitors the app needs a desktop, once per device. */
export function mountMobileNotice(host: HTMLElement) {
  const storage = (() => {
    try {
      return globalThis.localStorage;
    } catch {
      return undefined;
    }
  })();
  if (!shouldShowMobileNotice((q) => window.matchMedia(q), storage)) return;

  const dismiss = h('button', { type: 'button', class: 'mobile-notice-dismiss' }, "I'm a grenadier, and I know better");
  const dialog = h(
    'dialog',
    { class: 'mobile-notice', 'aria-labelledby': 'mobile-notice-title' },
    h('h2', { id: 'mobile-notice-title' }, "Whoa, you're a mobile user??"),
    h(
      'p',
      {},
      "I'm gonna be real, but I made this with a wide screen and a mouse in mind. It might work on your device, but it probably won't, because you need to drag things and see several tabs of interfaces at once. I'll probably add tiny-screen support in the future.",
    ),
    h('p', {}, 'Open this page on a computer:'),
    h('p', { class: 'mobile-notice-url' }, location.host + location.pathname),
    h('div', { class: 'help-actions' }, dismiss),
  );
  // Saved before closing: the dialog's close event fires too late if the page reloads straight away.
  const remember = () => {
    try {
      storage?.setItem(DISMISSED_KEY, '1');
    } catch {
      // storage blocked: the notice shows again next visit
    }
  };
  dismiss.addEventListener('click', () => {
    remember();
    dialog.close();
  });
  dialog.addEventListener('cancel', remember);
  host.append(dialog);
  dialog.showModal();
}
