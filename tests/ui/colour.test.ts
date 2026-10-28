import { contrastRatio, platoonColour } from '../../src/ui/colour';

const COMPANY_COLOURS = ['#b03a2e', '#1f618d', '#7d6608', '#196f3d', '#6c3483', '#a04000'];
const THEMES = [
  { name: 'light', field: '#e7e3d4', ink: '#2b2a26' },
  { name: 'dark', field: '#2b2a24', ink: '#ece8dc' },
];

describe('contrastRatio', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 1);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });
});

describe('platoonColour', () => {
  for (const theme of THEMES) {
    it(`keeps every platoon at 3:1 or better against the ${theme.name} field`, () => {
      for (const colour of COMPANY_COLOURS) {
        for (let i = 0; i < 6; i++) {
          const shade = platoonColour(colour, i, theme.field, theme.ink);
          expect(contrastRatio(shade, theme.field), `${colour} platoon ${i}`).toBeGreaterThanOrEqual(3);
        }
      }
    });

    it(`gives neighbouring platoons different shades on the ${theme.name} field`, () => {
      for (const colour of COMPANY_COLOURS) {
        for (let i = 0; i < 5; i++) {
          expect(platoonColour(colour, i, theme.field, theme.ink)).not.toBe(platoonColour(colour, i + 1, theme.field, theme.ink));
        }
      }
    });
  }
});
