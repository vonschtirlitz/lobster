# Order Planner

A browser tool for planning 18th-century line-infantry manoeuvres (British 1764 Manual as the first drill system). Set a company's starting position and a ghost target on the field, build a list of words of command, and watch a drill-correct replay with a ground arrow and a "vs ghost" check.

## Requirements

- Node.js 18 or newer (developed on Node 24)
- A modern desktop browser

## Setup

```bash
npm install
```

## Run

```bash
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

On a WSL-mounted Windows drive (`/mnt/c`, `/mnt/e`, …) Vite does not see file changes, so restart it after editing code:

```bash
npx vite --force
```

## Other commands

| Command | What it does |
|---|---|
| `npm test` | Run the unit tests (Vitest) |
| `npm run typecheck` | Type-check with `tsc` |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the built `dist/` locally |

The build is a static site: `dist/` can be opened from any static web server.

## Using it

- **Field:** drag empty ground to pan and use the mouse wheel to zoom. **Fit** frames every company.
- **Edit: Start / Ghost:** chooses whether drags change the company's starting position or its target.
- **Moving and shaping:**
  - Drag a company to move it.
  - Drag the round handle in front of it to rotate (hold Shift to snap to 45°).
  - Right-drag (or use the **Frontage** tool) from one flank to the other to set the frontage. The men face to the left of the drag direction.
  - Drag a flank square to widen or narrow the line about its dressing point.
  - Shift-click to select several companies.
- **Setup panel:** add and remove companies and set rank and file, platoons, officers, NCOs, ranks, order (close / open / extended) and dressing (right / centre / left).
- **Orders:**
  - **Building the list:** add commands with the **+** buttons, set their parameters inline, and drag rows to reorder them.
  - **Invalid orders:** an order that can't be given turns red with the reason.
  - **Jumping:** click an order's words to jump the replay to that moment.
  - **Ghost check:** the readout under the list says how close the orders bring the company to its ghost.
  - **Make this the start:** turns the end of the replay into the new starting position.
- **Replay bar:** play/pause (Space), step between orders, scrub, and set speed up to 4×.
- **Save / Load:** export and import a scene as JSON. The scene also autosaves in the browser.
- **Undo / redo:** Ctrl+Z and Ctrl+Shift+Z.

## Drill values

Every 1764 number and word of command is a placeholder marked `SOURCE NEEDED` in `src/drill/gb1764.ts`: intervals, rank distances, step cadence, officer posts and words of command. Correct them there. The UI and engine read only from that module.

## Layout

```
src/model/    formation geometry, telling off, soldier layout
src/drill/    drill systems (gb1764.ts) and their types
src/engine/   order primitives, timeline execution, ghost comparison
src/state/    scene store, undo/redo, persistence, replay clock
src/ui/       canvas renderer, interactions, panels
tests/        Vitest unit tests
docs/         design and implementation plan
```
