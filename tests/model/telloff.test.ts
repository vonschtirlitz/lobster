import { splitMen, filesFor, platoonWarnings, shortSide } from '../../src/model/telloff';
import { makeCompany } from '../helpers';

describe('telling off', () => {
  it('splitMen gives the remainder to the right-hand platoons first', () => {
    expect(splitMen(25, 2)).toEqual([13, 12]);
    expect(splitMen(10, 3)).toEqual([4, 3, 3]);
  });

  it('filesFor rounds up to whole files', () => {
    expect(filesFor(13, 3)).toBe(5);
    expect(filesFor(12, 3)).toBe(4);
    expect(filesFor(0, 3)).toBe(0);
    expect(filesFor(1, 3)).toBe(1);
  });

  it('platoonWarnings flags men that do not divide into the ranks', () => {
    const c = makeCompany([13, 12]);
    expect(platoonWarnings(c, 3)).toEqual(['1st Platoon: 13 men do not divide into 3 ranks']);
  });

  it('short files go away from the dressing point', () => {
    expect(shortSide('right')).toBe('left');
    expect(shortSide('centre')).toBe('left');
    expect(shortSide('left')).toBe('right');
  });
});
