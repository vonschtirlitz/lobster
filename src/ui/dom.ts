type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, unknown> & { on?: Record<string, (e: Event) => void> };

/** Tiny element builder: h('button', { class: 'x', on: { click } }, 'Label'). */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'on') {
      for (const [ev, fn] of Object.entries(v as Record<string, EventListener>)) el.addEventListener(ev, fn);
    } else if (v === false || v === undefined || v === null) {
      continue;
    } else if (k in el && typeof v !== 'string') {
      (el as unknown as Record<string, unknown>)[k] = v;
    } else {
      el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

/** A segmented control; `value` is the pressed option. */
export function segmented<T extends string>(
  label: string,
  options: { value: T; text: string }[],
  value: T | null,
  onPick: (v: T) => void,
  disabled = false,
): HTMLElement {
  return h(
    'span',
    { class: 'group' },
    h('span', { class: 'label' }, label),
    h(
      'span',
      { class: 'seg', role: 'group', 'aria-label': label },
      ...options.map((o) =>
        h('button', { type: 'button', 'aria-pressed': String(o.value === value), disabled, on: { click: () => onPick(o.value) } }, o.text),
      ),
    ),
  );
}

export function numberInput(value: number, onCommit: (n: number) => void, opts: { min?: number; max?: number; step?: number; label: string }) {
  return h('input', {
    type: 'number',
    value: String(value),
    min: opts.min,
    max: opts.max,
    step: opts.step ?? 1,
    'aria-label': opts.label,
    on: {
      change: (e) => {
        const n = Number((e.target as HTMLInputElement).value);
        if (Number.isFinite(n)) onCommit(n);
      },
    },
  });
}
