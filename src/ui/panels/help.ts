import { h } from '../dom';

const STEPS: [string, string][] = [
  ['Pick a company.', 'Click it on the field or in the Companies panel. "+ Add company" puts a new one on the field.'],
  ['Set where it stands.', 'Choose Edit: Start in the toolbar, then drag the company into position.'],
  [
    'Set where it should end up.',
    'Choose Edit: Ghost and drag the faint copy to the goal. Right-drag across the field to lay out a new frontage; the men face to the left of the direction you drag.',
  ],
  ['Give the words of command.', 'Add orders in the Orders panel and set their paces, degrees and direction.'],
  [
    'Watch it drilled.',
    'Press play or Space. The arrow on the ground traces the path, numbered where each order is given, and the panel says how far from the ghost the company finished.',
  ],
];

const CONTROLS: [string, string][] = [
  ['Move', 'drag the company, or arrow keys'],
  ['Rotate', 'drag the round handle in front of it, or [ and ]'],
  ['Change frontage', 'right-drag a new line, drag a flank square, or + and -'],
  ['Pan and zoom', 'drag empty ground, mouse wheel'],
  ['Bigger steps', 'hold Shift'],
  ['Undo', 'Ctrl+Z, redo with Ctrl+Shift+Z'],
];

/** Builds the first-time help dialog once and returns a function that opens it. */
export function mountHelp(host: HTMLElement): () => void {
  const close = h('button', { type: 'button', class: 'help-close', 'aria-label': 'Close help' }, 'Close');
  const dialog = h(
    'dialog',
    { class: 'help', 'aria-labelledby': 'help-title' },
    h('h2', { id: 'help-title' }, 'How LOBSTER works'),
    h(
      'p',
      {},
      'You set where a company stands, where you want it to finish, and the words of command you would give. LOBSTER drills the company through them and shows how close it got.',
    ),
    h('ol', { class: 'help-steps' }, ...STEPS.map(([lead, rest]) => h('li', {}, h('strong', {}, lead), ` ${rest}`))),
    h(
      'p',
      {},
      'An order shown in red cannot be given from where the company is standing; the reason is written under it. "Make this the start" turns the end of a replay into the next exercise.',
    ),
    h('h3', {}, 'Controls'),
    h('table', { class: 'help-controls' }, h('tbody', {}, ...CONTROLS.map(([what, how]) => h('tr', {}, h('th', { scope: 'row' }, what), h('td', {}, how))))),
    h('p', { class: 'note' }, 'The 1764 words of command and distances are drafts until they are checked against the Manual.'),
    h('div', { class: 'help-actions' }, close),
  );
  close.addEventListener('click', () => dialog.close());
  // A click on the backdrop lands on the dialog element itself.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  host.append(dialog);
  return () => dialog.showModal();
}
