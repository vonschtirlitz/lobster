import { triageFormIssue } from '../../.github/scripts/form-issue.mjs';

const zapierBody = [
  '**What did you do?**',
  'Select open order',
  '',
  '**Expected:** Horizontal distance between files increases',
  '**Happened instead:** Distance between ranks increased',
  '**Browser:** Chrome',
  '',
  '**Trying to do:** ',
  '**How it should work:** ',
  '',
  '**Corrects:** ',
  '**Should be:** ',
  '**Source:** ',
  '**Quote:** ',
  '',
  '**Question:** ',
  '',
  '**Saved scene:**',
  '',
  '',
  '_Submitted via the public form by _',
].join('\n');

describe('triageFormIssue', () => {
  it('ignores issues that did not come from the form', () => {
    expect(triageFormIssue({ title: '[Bug] x', body: 'Opened by hand' })).toBeNull();
  });

  it('labels by the type in the title, plus from-form', () => {
    const label = (title: string) => triageFormIssue({ title, body: zapierBody })?.labels;
    expect(label('[Bug] Open order improper distance')).toEqual(['bug', 'from-form']);
    expect(label('[Question] Why?')).toEqual(['question', 'from-form']);
    expect(label('[Feature idea] Inclines')).toEqual(['Feature idea', 'from-form']);
    expect(label('[Drill source] Cadence')).toEqual(['Drill source', 'from-form']);
    expect(label('[Something else] x')).toEqual(['from-form']);
  });

  it('drops unanswered fields and keeps answered ones', () => {
    const body = triageFormIssue({ title: '[Bug] x', body: zapierBody })!.body;
    expect(body).toBe(
      [
        '**What did you do?**',
        'Select open order',
        '',
        '**Expected:** Horizontal distance between files increases',
        '**Happened instead:** Distance between ranks increased',
        '**Browser:** Chrome',
        '',
        '_Submitted via the public form._',
      ].join('\n'),
    );
  });

  it('keeps multi-line answers and the credit name', () => {
    const body = triageFormIssue({
      title: '[Bug] x',
      body: '**Saved scene:**\n{\n  "v": 1\n}\n\n**Quote:** \n\n_Submitted via the public form by Sgt. Kite_',
    })!.body;
    expect(body).toBe('**Saved scene:**\n{\n  "v": 1\n}\n\n_Submitted via the public form by Sgt. Kite_');
  });
});
