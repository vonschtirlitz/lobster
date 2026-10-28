import type { Store } from '../../state/store';
import type { Company, FormationState } from '../../model/types';
import { DRILL_SYSTEMS, getDrill } from '../../drill/registry';
import { companyRanks, resizeAboutDress } from '../../model/formation';
import { platoonTotal, platoonWarnings, splitMen } from '../../model/telloff';
import { newId } from '../../state/store';
import { h, numberInput } from '../dom';
import { applyDress, applyOrder } from './toolbar';

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];
const MAX_PLATOONS = 10;

export function mountSetup(el: HTMLElement, store: Store) {
  let detailsOpen = false;
  const render = () => {
    const scene = store.get();
    const ui = store.ui();
    const d = getDrill(scene.drillId);
    const c = scene.companies.find((x) => x.id === ui.selected[0]);
    const update = (patch: Partial<Omit<Company, 'id'>>) => c && store.dispatch({ type: 'updateCompany', id: c.id, patch });

    const list = h(
      'ul',
      { class: 'companies', role: 'listbox', 'aria-label': 'Companies' },
      ...scene.companies.map((x) =>
        h(
          'li',
          {
            role: 'option',
            tabindex: 0,
            'aria-selected': String(ui.selected.includes(x.id)),
            on: {
              click: (e) => {
                const shift = (e as MouseEvent).shiftKey;
                const sel = shift
                  ? ui.selected.includes(x.id)
                    ? ui.selected.filter((id) => id !== x.id)
                    : [...ui.selected, x.id]
                  : [x.id];
                store.setUi({ selected: sel });
              },
              keydown: (e) => {
                if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
                  e.preventDefault();
                  store.setUi({ selected: [x.id] });
                }
              },
            },
          },
          h('span', { class: 'swatch', style: `background:${x.colour}` }),
          h('span', {}, x.name),
          h('span', { style: 'margin-left:auto;color:var(--muted);font-size:12px' }, `${x.rankAndFile} ${d.terms.rankAndFile?.toLowerCase() ?? 'men'}`),
        ),
      ),
    );

    const header = [
      h('h2', {}, 'Companies'),
      h(
        'div',
        { class: 'row' },
        h('label', { for: 'drill' }, 'Drill'),
        h(
          'select',
          { id: 'drill', on: { change: () => undefined } },
          ...DRILL_SYSTEMS.map((x) => h('option', { value: x.id, selected: x.id === scene.drillId }, x.name)),
        ),
      ),
      list,
      h('div', { class: 'row' }, h('button', { type: 'button', on: { click: () => store.dispatch({ type: 'addCompany' }) } }, '+ Add company')),
    ];

    if (!c) {
      el.replaceChildren(...header, h('p', { style: 'color:var(--muted)' }, 'Select a company to set it up.'));
      return;
    }

    const edited: FormationState = scene[ui.editTarget][c.id];
    const ranks = companyRanks(edited);
    const total = platoonTotal(c);
    const warnings = [
      ...(total !== c.rankAndFile ? [`Platoons hold ${total} men; ${d.terms.rankAndFile?.toLowerCase() ?? 'rank and file'} is ${c.rankAndFile}`] : []),
      ...platoonWarnings(c, ranks),
    ];

    const setPlatoonCount = (n: number) => {
      const count = Math.max(1, Math.min(MAX_PLATOONS, Math.round(n)));
      const men = splitMen(c.rankAndFile, count);
      const platoons = men.map((m, i) => ({
        id: c.platoons[i]?.id ?? newId(),
        name: c.platoons[i]?.name ?? `${ORDINALS[i]} ${d.terms.platoon ?? 'Platoon'}`,
        men: m,
      }));
      store.dispatch({ type: 'setPlatoons', id: c.id, platoons });
    };

    const setRanks = (r: number) => {
      const changes = (['current', 'ghost'] as const).map((which) => ({
        id: c.id,
        which,
        state: resizeAboutDress(c, scene[which][c.id], null, r, d),
      }));
      store.dispatch({ type: 'setFormations', changes });
    };

    const check = (label: string, value: boolean, onChange: (v: boolean) => void) =>
      h(
        'label',
        { style: 'display:inline-flex;gap:4px;align-items:center;min-width:0;color:var(--ink)' },
        h('input', { type: 'checkbox', checked: value, on: { change: (e) => onChange((e.target as HTMLInputElement).checked) } }),
        label,
      );

    el.replaceChildren(
      ...header,
      h('h3', {}, c.name),
      h(
        'div',
        { class: 'row' },
        h('label', { for: 'cname' }, 'Name'),
        h('input', { id: 'cname', type: 'text', value: c.name, on: { change: (e) => update({ name: (e.target as HTMLInputElement).value }) } }),
        h('input', {
          type: 'color',
          value: c.colour,
          'aria-label': 'Colour',
          on: { change: (e) => update({ colour: (e.target as HTMLInputElement).value }) },
        }),
      ),
      h(
        'div',
        { class: 'row' },
        h('label', {}, d.terms.rankAndFile ?? 'Rank and file'),
        numberInput(c.rankAndFile, (n) => update({ rankAndFile: Math.max(1, Math.round(n)) }), { min: 1, label: d.terms.rankAndFile ?? 'Rank and file' }),
      ),
      ...warnings.map((w) => h('div', { class: 'warn', role: 'status' }, w)),
      h(
        'details',
        { open: detailsOpen, on: { toggle: (e) => (detailsOpen = (e.target as HTMLDetailsElement).open) } },
        h('summary', {}, `${d.terms.platoon ?? 'Platoon'}s, officers and NCOs`),
        h(
          'div',
          { class: 'row' },
          h('label', {}, `${d.terms.platoon ?? 'Platoon'}s`),
          numberInput(c.platoons.length, setPlatoonCount, { min: 1, max: MAX_PLATOONS, label: 'Number of platoons' }),
        ),
        ...c.platoons.map((p, i) =>
          h(
            'div',
            { class: 'row', style: 'padding-left:12px' },
            h('input', {
              type: 'text',
              value: p.name,
              'aria-label': `${p.name} name`,
              style: 'width:120px',
              on: {
                change: (e) =>
                  store.dispatch({
                    type: 'setPlatoons',
                    id: c.id,
                    platoons: c.platoons.map((x, j) => (j === i ? { ...x, name: (e.target as HTMLInputElement).value } : x)),
                  }),
              },
            }),
            numberInput(
              p.men,
              (n) =>
                store.dispatch({
                  type: 'setPlatoons',
                  id: c.id,
                  platoons: c.platoons.map((x, j) => (j === i ? { ...x, men: Math.max(0, Math.round(n)) } : x)),
                }),
              { min: 0, label: `${p.name} men` },
            ),
            h('span', { style: 'color:var(--muted)' }, 'men'),
          ),
        ),
        h('h3', {}, 'Officers'),
        h(
          'div',
          { class: 'row' },
          check('Captain', c.officers.captain, (v) => update({ officers: { ...c.officers, captain: v } })),
          check('Lieutenant', c.officers.lieutenant, (v) => update({ officers: { ...c.officers, lieutenant: v } })),
          check('Ensign', c.officers.ensign, (v) => update({ officers: { ...c.officers, ensign: v } })),
        ),
        h('h3', {}, 'NCOs and drummer'),
        h(
          'div',
          { class: 'row' },
          h('label', {}, 'Sergeants'),
          numberInput(c.ncos.sergeants, (n) => update({ ncos: { ...c.ncos, sergeants: Math.max(0, Math.round(n)) } }), { min: 0, label: 'Sergeants' }),
        ),
        h(
          'div',
          { class: 'row' },
          h('label', {}, 'Corporals'),
          numberInput(c.ncos.corporals, (n) => update({ ncos: { ...c.ncos, corporals: Math.max(0, Math.round(n)) } }), { min: 0, label: 'Corporals' }),
        ),
        h('div', { class: 'row' }, check('Drummer', c.ncos.drummer, (v) => update({ ncos: { ...c.ncos, drummer: v } }))),
      ),
      h('h3', {}, `Formation (editing ${ui.editTarget === 'ghost' ? 'ghost' : 'start'})`),
      h(
        'div',
        { class: 'row' },
        h('label', {}, d.terms.ranks ? d.terms.ranks.charAt(0).toUpperCase() + d.terms.ranks.slice(1) : 'Ranks'),
        h(
          'select',
          { 'aria-label': 'Ranks', on: { change: (e) => setRanks(Number((e.target as HTMLSelectElement).value)) } },
          ...d.defaults.allowedRanks.map((r) => h('option', { value: String(r), selected: r === ranks }, `${r} deep`)),
        ),
      ),
      h(
        'div',
        { class: 'row' },
        h('label', {}, d.terms.order ?? 'Order'),
        h(
          'select',
          { 'aria-label': 'Order', on: { change: (e) => applyOrder(store, (e.target as HTMLSelectElement).value as FormationState['order']) } },
          ...d.defaults.allowedOrders.map((o) => h('option', { value: o, selected: o === edited.order }, o)),
        ),
      ),
      h(
        'div',
        { class: 'row' },
        h('label', {}, d.terms.dress ?? 'Dress'),
        h(
          'select',
          { 'aria-label': 'Dress by', on: { change: (e) => applyDress(store, (e.target as HTMLSelectElement).value as FormationState['dressBy']) } },
          ...(['right', 'centre', 'left'] as const).map((p) => h('option', { value: p, selected: p === edited.dressBy }, `by the ${p}`)),
        ),
      ),
      h(
        'div',
        { class: 'row' },
        h(
          'button',
          { type: 'button', on: { click: () => store.dispatch({ type: 'removeCompany', id: c.id }) } },
          'Remove company',
        ),
      ),
    );
  };
  store.subscribe(render);
  render();
}
