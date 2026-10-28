import { MOBILE_QUERY, shouldShowMobileNotice } from '../../src/ui/mobile-notice';

const storage = (dismissed: boolean) => ({ getItem: () => (dismissed ? '1' : null) });
const media = (matches: boolean) => (q: string) => ({ matches: q === MOBILE_QUERY && matches });

describe('mobile notice', () => {
  it('shows on a phone-sized or touch-only screen', () => {
    expect(shouldShowMobileNotice(media(true), storage(false))).toBe(true);
  });

  it('stays hidden on a desktop', () => {
    expect(shouldShowMobileNotice(media(false), storage(false))).toBe(false);
  });

  it('stays hidden once dismissed', () => {
    expect(shouldShowMobileNotice(media(true), storage(true))).toBe(false);
  });

  it('still shows when storage is blocked', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
    };
    expect(shouldShowMobileNotice(media(true), blocked)).toBe(true);
  });
});
