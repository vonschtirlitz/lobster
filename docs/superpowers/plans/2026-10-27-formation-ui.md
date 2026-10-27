# Formation Planner (UI + Drill Replay) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A browser tool where you set a company's start and ghost target on a 2D field, build a list of 1764-style words of command, and watch a drill-correct replay with a ground arrow and a "vs ghost" check.

**Architecture:** Pure TypeScript model and engine layers (`model/`, `drill/`, `engine/`) have no DOM and are fully unit-tested. A small store (`state/`) holds the scene, undo/redo and persistence. A framework-free Canvas 2D renderer plus plain-DOM panels (`ui/`) read from the store. Every soldier position comes from one pure `layout()` function. Every replay frame comes from `Timeline.sample(t)`.

**Tech Stack:** TypeScript 5, Vite 5, Vitest 2, Canvas 2D, plain DOM (no UI framework: the builder's call, chosen to keep dependencies at zero).

**Spec:** `docs/superpowers/specs/2026-10-27-formation-ui-design.md`

## Global Constraints

- World units are **paces**. World y points **up**. Angle `θ` faces `(cos θ, sin θ)`, so `θ = π/2` faces up the screen. A block's right-hand vector is `(sin θ, −cos θ)`.
- No 1764 numbers, words or posts may appear outside `src/drill/gb1764.ts`. The UI and engine read them from `DrillSystem`.
- Placeholder drill values carry a `// SOURCE NEEDED` comment.
- UI text uses period terms: files, ranks, platoon, wheel, dress, order, rank and file.
- The replay never blends a company from start to end. Each order is its own segment with its own motion.
- Default tolerances for the ghost comparison: **2 paces, 5°**.
- Default edit target: **ghost**.
- Performance target: about 10 companies × about 100 men at 60 fps. `execute()` must take under 16 ms for 10 companies × 20 orders.
- Desktop browser with mouse. Must not break on a trackpad.

## Review Focus

1. **Platoon totals that don't match rank and file** (mid-edit in the setup panel). Layout renders the men the platoons actually hold and never throws. A warning shows. → Task 2 test `layout tolerates platoon sum mismatch`.
2. **Degenerate sizes:** 1 man, a platoon of 0, or files greater than men. No NaN positions, no infinite loops. → Task 2 test `degenerate companies`, Task 3 test `frontage clamps`.
3. **Bad order parameters:** 0° or negative wheel, negative paces, an order not allowed by the drill module. The order is flagged invalid with a reason and the replay stops there. → Task 6 test `rejects bad params`.
4. **Importing a malformed or older JSON file:** rejected with a message, scene unchanged. → Task 8 test `import rejects bad file`.
5. **Editing current, ghost or orders while the replay is paused mid-way:** the timeline recomputes and the playhead clamps to the new duration. → Task 8 test `playhead clamps on recompute`.

---

## File Structure

```
index.html
package.json, tsconfig.json, vite.config.ts
src/main.ts                     wires store + canvas + panels
src/model/types.ts              all domain types from the spec
src/model/vec.ts                Vec2 maths
src/model/telloff.ts            platoon split, files per platoon, short-file side
src/model/formation.ts          asLine, asColumnOfPlatoons, describe, guidePoint, frontageFromDrag, resizeAboutDress
src/model/layout.ts             layout() → Figure[]
src/drill/types.ts              DrillSystem, CommandDef, ParamDef, CommandKind
src/drill/gb1764.ts             the 1764 module (placeholders)
src/drill/registry.ts           id → DrillSystem
src/engine/segment.ts           Segment builders: rigid (stateAt) and per-slot lerp
src/engine/primitives.ts        validate + build segment for each CommandKind
src/engine/execute.ts           execute() → Timeline
src/engine/compare.ts           compareToGhost()
src/engine/plan.ts              plan() stub
src/state/store.ts              Scene, actions, undo/redo, subscribe
src/state/persist.ts            JSON import/export, localStorage autosave
src/state/replay.ts             playhead, speed, timeline cache
src/ui/canvas/camera.ts         world ↔ screen, pan, zoom, fit
src/ui/canvas/render.ts         field, figures, ghost, guide marker, arrow
src/ui/canvas/interact.ts       select, move, rotate, frontage drag, edge handles
src/ui/panels/toolbar.ts
src/ui/panels/setup.ts
src/ui/panels/orders.ts
src/ui/panels/replaybar.ts
src/ui/styles.css
tests/…                         mirrors src/
```

---

### Task 1: Scaffold, types, vector maths

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `src/main.ts`, `src/model/types.ts`, `src/model/vec.ts`, `src/drill/types.ts`
- Test: `tests/model/vec.test.ts`

**Interfaces:**
- Produces: every type in the spec's "Domain model" and "Executor" blocks, verbatim, in `src/model/types.ts`. That includes `Vec2`, `OrderSpacing`, `DressPoint`, `MenFacing`, `Company`, `Platoon`, `Block`, `FormationState`, `Figure`, `Order`, `Segment`, `Timeline`. Add:
  - `OfficerSpec = { captain: boolean; lieutenant: boolean; ensign: boolean }`
  - `NcoSpec = { sergeants: number; corporals: number; drummer: boolean }`
  - `Figure.role` gains `'captain' | 'lieutenant' | 'ensign'` in place of `'officer'`, so posts are distinguishable.
- Produces: `src/drill/types.ts` with `DrillSystem`, `CommandDef` (from the spec) and:
  - `CommandKind = 'march' | 'face' | 'wheel' | 'spacing' | 'dress' | 'depth' | 'wait'`
  - `ParamDef = { key: string; label: string; type: 'number' | 'choice'; choices?: string[]; default: number | string; min?: number; max?: number }`
- Produces in `vec.ts`: `add, sub, scale, len, dist, rotate(v, θ), rotateAbout(p, pivot, θ), fwd(θ): Vec2, right(θ): Vec2, lerp(a, b, t), angleDiff(a, b): number` (signed, in (−π, π]).

- [ ] **Step 1:** `git init`. Create a Vite vanilla-ts project by hand (no template download) with scripts `dev`, `build`, `test` (`vitest run`), and `typecheck` (`tsc --noEmit`). `.gitignore` covers `node_modules`, `dist`. Run `npm i -D vite typescript vitest`.
- [ ] **Step 2: Write the failing tests** `tests/model/vec.test.ts`:
  - `fwd(Math.PI/2)` ≈ `{x:0,y:1}`; `right(Math.PI/2)` ≈ `{x:1,y:0}`.
  - `rotateAbout({x:1,y:0},{x:0,y:0},Math.PI/2)` ≈ `{x:0,y:1}`.
  - `angleDiff(0.1, 2*Math.PI-0.1)` ≈ `0.2`.
- [ ] **Step 3:** Run `npm test`. Expected: FAIL, module not found.
- [ ] **Step 4:** Implement `types.ts`, `drill/types.ts`, `vec.ts`.
- [ ] **Step 5:** Run `npm test && npm run typecheck`. Expected: PASS, no type errors.
- [ ] **Step 6:** Commit `chore: scaffold vite+ts project with domain types and vec maths`.

---

### Task 2: 1764 drill module, telling off, layout

**Files:**
- Create: `src/drill/gb1764.ts`, `src/drill/registry.ts`, `src/model/telloff.ts`, `src/model/layout.ts`
- Test: `tests/model/telloff.test.ts`, `tests/model/layout.test.ts`

**Interfaces:**
- Consumes: Task 1 types.
- Produces:
  - `gb1764: DrillSystem`
  - `getDrill(id: string): DrillSystem`
  - `filesFor(men: number, ranks: number): number` (= `ceil(men/ranks)`, min 1 if men > 0, else 0)
  - `shortSide(dress: DressPoint): 'left' | 'right'` (right→left, centre→left, left→right)
  - `splitMen(total: number, platoons: number): number[]` (even; the remainder goes to the rightmost platoons first)
  - `platoonWarnings(c: Company, ranks: number): string[]`
  - `layout(c: Company, s: FormationState, d: DrillSystem): Figure[]`

**1764 placeholder values** (each `// SOURCE NEEDED`):
- `ranks 3`, `allowedRanks [2,3]`, `allowedOrders ['close','open','extended']`, `defaultDress 'right'`, `platoonsPerCompany 2`
- `fileInterval { close: 0.75, open: 0.75, extended: 2 }`
- `rankDistance { close: 1, open: 2, extended: 4 }`
- `steps { ordinary: { pacesPerMinute: 60 }, quick: { pacesPerMinute: 120 } }`, `beatSeconds 1`
- `commands`: one `CommandDef` per `CommandKind`, with words from the spec's command table and these params:
  - `march`: paces (default 10, min 1) and step (ordinary/quick).
  - `face`: direction (right/left/about/front).
  - `wheel`: direction (right/left), degrees (default 90, min 1, max 360), by (company/platoons).
  - `spacing`: order.
  - `dress`: point.
  - `depth`: ranks (2/3).
  - `wait`: seconds (default 4, min 0.5).
- `postOfficersAndNcos`, all relative to the company line, or to block 0 / last / middle when not a line:
  - Captain: 1 pace in front of the right-flank file.
  - Lieutenant: 1 pace in front of the left-flank file.
  - Ensign: 2 paces behind the centre of the rear rank.
  - Sergeants: evenly spaced 2 paces behind the rear rank.
  - Corporals: on the flanks of the rear rank, 1 interval outside.
  - Drummer: 3 paces behind the centre.
  - All face the block front.
- `terms`: labels for "rank and file", "platoon", "files", "ranks", "order", "dress".

**`layout` rules:**
- **Slots:** within each block, file `f` is counted from the right (0 = right flank) and rank `r` from the front (0 = front). The slot is `p{platoonIndex}:f{f}:r{r}`.
- **Position:** `anchor + right(front) * ((filesCentreOffset − f) * fileInterval) − fwd(front) * (r * rankDistance)`, where the block is centred on `anchor`.
- **Short file:** the men in a platoon are filled file by file, front to rear. The short file sits on `shortSide(dressBy)`: if that is left, fill files from the right; otherwise fill from the left.
- **Facing:** figure facing = `front + {front:0, right:−π/2, left:π/2, about:π}[menFacing]`.
- **Officers and NCOs:** appended from `d.postOfficersAndNcos`, with slots like `captain`, `sgt:0`.

- [ ] **Step 1: Write the failing tests:**
  - `splitMen(25,2)` → `[13,12]`.
  - `filesFor(13,3)` → `5`.
  - `platoonWarnings` flags a 13-man platoon at 3 ranks ("1st Platoon: 13 men do not divide into 3 ranks").
  - **Layout of 2 platoons × 12 men, 3 ranks, front π/2, anchor (0,0), close order:**
    - 24 privates.
    - Front-rank men at y = 0, rear rank at y = −2.
    - The right-flank man of platoon 1 has the largest x.
    - All facings = π/2.
  - `menFacing:'right'` → every private's facing ≈ 0.
  - `dressBy:'right'` with a 13-man platoon → the short file is the platoon's leftmost file.
  - **`layout tolerates platoon sum mismatch`:** `rankAndFile 30` with platoons `[10,10]` gives 20 privates, no throw.
  - **`degenerate companies`:** `rankAndFile 1`, one platoon of 1, and a platoon of 0 → finite positions, 1 private.
  - Captain present → one figure with role `captain` in front of the front rank.
- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement the four files. `layout` takes blocks as given (Task 3 builds them). The tests construct `FormationState` literals directly.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: 1764 drill module placeholders, telling off and layout`.

---

### Task 3: Formation helpers

**Files:**
- Create: `src/model/formation.ts`
- Test: `tests/model/formation.test.ts`

**Interfaces:**
- Consumes: `layout`, `filesFor`, `getDrill`, vec.
- Produces:
  - `asLine(c, anchor: Vec2, front: number, ranks: number, order: OrderSpacing, dressBy: DressPoint, d): FormationState`. `anchor` is the centre of the whole front rank. Blocks sit shoulder to shoulder (no gap beyond one `fileInterval`).
  - `asColumnOfPlatoons(c, headAnchor: Vec2, front: number, ranks, order, dressBy, d): FormationState`. Block `i` sits behind block 0 at distance `i × (block 0 frontage + fileInterval)`, all with the same front. This is the open column at full distance.
  - `describe(s, d): 'line' | 'column' | 'irregular'`. Tolerance 0.05 paces / 0.5°.
  - `guidePoint(c, s, d): Vec2`.
    - **Line:** the front-rank position of the directing file. Right = the right-flank man, left = the left-flank man, centre = the line anchor.
    - **Column or irregular:** block 0's guide by the same rule.
  - `companyFront(s): number` (block 0's front).
  - `frontageFromDrag(c, a: Vec2, b: Vec2, current: FormationState, d): { state: FormationState; files: number; ranks: number; note?: string }`.
    - `front = atan2(b−a) + π/2`, `anchor = midpoint`.
    - `files = clamp(floor(|b−a| / fileInterval) + 1, 1, men)`.
    - `ranks = ceil(men/files)` snapped to the nearest value in `allowedRanks`. When snapped, `note` says why.
    - Keeps `order` and `dressBy` from `current`.
  - `resizeAboutDress(c, s, newOrder: OrderSpacing | null, newRanks: number | null, d): FormationState`. Rebuilds a line holding `guidePoint` fixed. If the state isn't a line, it rebuilds each block holding its own guide point.
  - `rotateState(s, pivot: Vec2, θ): FormationState`, `translateState(s, v: Vec2): FormationState`.

- [ ] **Step 1: Write the failing tests:**
  - `asLine` → `describe` = `'line'`.
  - `asColumnOfPlatoons` → `'column'`.
  - Moving one block → `'irregular'`.
  - `frontageFromDrag` from (0,0) to (10,0) with 24 men:
    - front ≈ π/2
    - files = 14, ranks = 2, no note
  - Drag (0,0)→(1,0) with 24 men: ranks would be 12 → snapped to 3 with a note.
  - **`frontage clamps`:** a 1-man drag of 100 paces gives files = 1, ranks = the minimum allowed, no NaN.
  - `resizeAboutDress` close → open, dress right: the right-flank man's position is unchanged and the left flank moves.
  - Dress centre: the anchor is unchanged.
  - Dress left: the left flank is unchanged.
  - `guidePoint` for a line dressed by the right equals the layout position of slot `p0:f0:r0`.
- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement `formation.ts`.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: line/column builders, frontage drag maths, resize about dressing point`.

---

### Task 4: Segments and simple primitives (face, march, dress, wait)

**Files:**
- Create: `src/engine/segment.ts`, `src/engine/primitives.ts`
- Test: `tests/engine/primitives.test.ts`

**Interfaces:**
- Consumes: Tasks 2–3.
- Produces in `segment.ts`:
  - `rigidSegment(order, t0, duration, start, end, stateAt: (u: number) => FormationState, c, d): Segment`, where `u` runs 0..1 and `sample` = `layout(stateAt(u))`.
  - `slotLerpSegment(order, t0, duration, start, end, c, d, match?: (startFigs, endFigs) => Map<string,string>, turn?: 'cw' | 'ccw' | 'short'): Segment`. Each figure goes in a straight line from its start slot to its matched end slot, and facing turns in the given direction. The default match is the same slot id.
- Produces in `primitives.ts`:
  - `buildSegment(order: Order, t0: number, start: FormationState, c: Company, d: DrillSystem): Segment`. It always returns a segment. When invalid, `error` is set, `t1 = t0` and `end = start`.
  - `speed(d, step) = pacesPerMinute / 60` (paces per second).

**Primitive behaviour (this task):**
- **`face`:** slot lerp over `beatSeconds`. Sets `menFacing`. `right` turns cw, `left` ccw, `about` cw (to the right about), and `front` turns back the shorter way.
- **`march`:** rigid. It moves every block by `paces × fwd(front + menFacing offset)`. Duration = `paces / speed`.
- **`dress`:** sets `dressBy` over `beatSeconds`, with no movement.
- **`wait`:** `seconds`, with no change.

- [ ] **Step 1: Write the failing tests:**
  - Right face → `end.menFacing='right'`. At `t0+beat/2` the private's facing is halfway between π/2 and 0.
  - March 20 ordinary while fronted, front π/2 → all figures move +20 in y. Duration 20 s.
  - "Right — Face, March 20, Front", chained by hand → the block moves +20 in x and ends `menFacing 'front'`.
  - Wait 4 → duration 4 and identical figures at both ends.
- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement `segment.ts` and these four kinds in `primitives.ts`, with a `switch` on `order.kind`. Unknown kinds return an error segment ("Unknown command").
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: segment builders and face/march/dress/wait primitives`.

---

### Task 5: Wheel primitive

**Files:**
- Modify: `src/engine/primitives.ts`
- Test: `tests/engine/wheel.test.ts`

**Interfaces:**
- Consumes: `rigidSegment`, `rotateState`, `guidePoint`, `asLine`.
- Produces: the `wheel` case of `buildSegment`.

**Rules:**
- **Validation:** only valid when `menFacing === 'front'`. Otherwise the error is "Cannot wheel while faced to a flank".
- **Pivot:** a right wheel pivots on the front-rank right-flank man of the wheeling unit and rotates by `−degrees` (clockwise in y-up). A left wheel pivots on the left-flank man and rotates by `+degrees`.
- **`by: 'company'`:** only valid when `describe` = `'line'` (error "Company must be in line to wheel as one"). The whole state rotates rigidly.
- **`by: 'platoons'`:** each block rotates about its own pivot at the same time.
- **Duration:** `(wheeling-unit frontage) × radians / speed(ordinary)`, where frontage = `(files − 1) × fileInterval`. By platoons, use the widest block.
- **Motion:** `stateAt(u)` rotates by `u × angle`, so each man follows a true arc.

- [ ] **Step 1: Write the failing tests:**
  - 90° right wheel by company of a 24-file line (front π/2):
    - The pivot man's position is constant at u = 0, 0.5 and 1.
    - The end front ≈ 0.
    - Duration = `(23 × 0.75) × (π/2) / 1`.
  - At u = 0.5 the left-flank man is at distance `frontage` from the pivot. This is the arc check: not on the straight line between start and end.
  - Right wheel 90° by platoons from a line → `describe(end)` = `'column'`.
  - Left wheel 90° by platoons from that column → `'line'`, with front back to π/2.
  - Wheel while `menFacing 'right'` → error and `t1 === t0`.
- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: wheel primitive by company and by platoons`.

---

### Task 6: Spacing and depth primitives, parameter validation

**Files:**
- Modify: `src/engine/primitives.ts`
- Test: `tests/engine/spacing.test.ts`

**Interfaces:**
- Consumes: `resizeAboutDress`, `slotLerpSegment`.
- Produces: the `spacing` and `depth` cases, plus `validateParams(order, d): string | null`. `validateParams` is called first for every kind, against the `CommandDef.params` min/max/choices.

**Rules:**
- **`spacing`:** `end = resizeAboutDress(c, start, order, null, d)`. Slot lerp with the same-slot match. Duration = the largest per-man displacement ÷ `speed(ordinary)`. The order must be in `allowedOrders`.
- **`depth`:** `end = resizeAboutDress(c, start, null, ranks, d)`. Slots change, so match men by sequence within each platoon: number the start slots file by file (right to left), front to rear, and pair them with the end slots numbered the same way. Officers and NCOs match by id. Same duration rule. The ranks must be in `allowedRanks`.
- **Both:** only valid when `menFacing === 'front'`.

- [ ] **Step 1: Write the failing tests:**
  - Close → open order, dress right: the right-flank front-rank man doesn't move, and the rear rank ends at distance 4 behind the front.
  - Dress left: the left-flank front-rank man doesn't move.
  - Depth 3 → 2 with 24 men: the end has 12 files, every start private is matched exactly once, and the guide point is unchanged.
  - **`rejects bad params`:**
    - Wheel 0° → error mentioning "degrees".
    - March −5 → error.
    - A spacing value not in `allowedOrders` → error.
    - An unknown `kind` → error.
- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: open/close order and form-deep primitives with param validation`.

---

### Task 7: Execute, compare, plan stub

**Files:**
- Create: `src/engine/execute.ts`, `src/engine/compare.ts`, `src/engine/plan.ts`
- Test: `tests/engine/execute.test.ts`, `tests/engine/compare.test.ts`

**Interfaces:**
- Consumes: `buildSegment`, `guidePoint`, `describe`.
- Produces:
  - `execute(input: { company: Company; start: FormationState; orders: Order[] }[], d: DrillSystem): Timeline`.
    - Each company chains its segments from t = 0.
    - It stops after the first segment with an `error`; that segment stays in the list so the UI can show it.
    - `duration` = the maximum over all companies.
    - `sample(t)` per company finds the segment containing `t`. Before 0 it uses the start layout, and after its last segment the last end layout.
    - `path(id)` samples the guide point every 0.25 s, plus every segment boundary.
  - Also exported: `endState(tl, companyId): FormationState` and `segmentAt(tl, companyId, t): Segment | undefined`.
  - `compareToGhost(c, end, ghost, d, tol: { paces: number; degrees: number }): { distance: number; frontDeg: number; mismatches: string[]; pass: boolean }`.
    - `mismatches` covers shape, files, ranks, order, dress and men's facing, worded with drill terms, e.g. "dress: right ≠ left".
  - `plan(...)`: returns `[]`. Also export `PLAN_UNAVAILABLE = 'Automatic orders not yet available'`.

- [ ] **Step 1: Write the failing tests:**
  - Two companies with orders of different lengths → `duration` = the longer one, and the shorter company holds its end layout after finishing.
  - `sample` is continuous at a march → wheel boundary: positions at `t1 − ε` and `t1 + ε` are within 0.01.
  - An invalid 2nd order → only 2 segments, the 2nd has `error`, and `duration` = the 1st's `t1`.
  - `path` for "wheel 90, march 10" starts at the start guide point and ends at the end guide point. It includes an arc point that isn't on the straight line between them.
  - Performance: 10 companies × 100 men × 20 mixed orders → `execute` takes < 16 ms (measured with `performance.now()`; `it` with `retry: 2`).
  - `compareToGhost` with identical states → `pass`, `distance 0`.
  - Ghost 3 paces off → `pass false`. Dress differs → mismatch "dress: right ≠ left".
- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement. The sample index uses a binary search over each company's segment `t0`s.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: multi-company execute timeline, ghost comparison, plan stub`.

---

### Task 8: Store, undo/redo, persistence, replay state

**Files:**
- Create: `src/state/store.ts`, `src/state/persist.ts`, `src/state/replay.ts`
- Test: `tests/state/store.test.ts`, `tests/state/persist.test.ts`, `tests/state/replay.test.ts`

**Interfaces:**
- Produces in `store.ts`:

```ts
interface Scene {
  version: 1;
  drillId: string;
  companies: Company[];
  current: Record<string, FormationState>;
  ghost: Record<string, FormationState>;
  ghostShape: Record<string, 'line' | 'column'>;
  orders: Record<string, Order[]>;
  settings: { tolerancePaces: number; toleranceDeg: number };
}
interface UiState {
  selected: string[];
  editTarget: 'current' | 'ghost';
  tool: 'select' | 'frontage';
  showGhost: boolean;
}
```

  - `createStore(initial?: Scene)` returns `{ get(): Scene; ui(): UiState; dispatch(a: Action): void; setUi(p: Partial<UiState>): void; undo(); redo(); subscribe(fn): () => void }`.
  - `Action` is a union:
    - Companies: `addCompany`, `removeCompany`, `updateCompany` (patch), `setPlatoons`.
    - Formations: `setFormation` (`{ id, which: 'current'|'ghost', state }`), `setGhostShape`.
    - Orders: `setOrders`, `addOrder`, `updateOrder`, `moveOrder`, `removeOrder`.
    - `adoptEndAsStart` (`{ id, end }`): sets current, clears orders.
    - `replaceScene`.
  - Every action pushes an undo snapshot (cap 200). `updateCompany` re-derives current and ghost via `asLine` / `asColumnOfPlatoons`, keeping each one's anchor, front, ranks, order and dress.
  - `defaultScene()` holds one company of 40 rank and file, 2 platoons, captain + lieutenant + ensign, 2 sergeants, 2 corporals and a drummer, in line at the origin facing up. Its ghost is 30 paces ahead.
- Produces in `persist.ts`:
  - `exportScene(s): string`
  - `importScene(json: string): { ok: true; scene: Scene } | { ok: false; error: string }`, which checks `version === 1`, the required keys, and that each company has current, ghost and orders.
  - `autosave(store)`: debounced 500 ms to `localStorage['orderplanner.scene.v1']`, wrapped in try/catch.
  - `loadAutosave(): Scene | null`
- Produces in `replay.ts`:
  - `createReplay(store)` returns `{ timeline(): Timeline; t(): number; playing(): boolean; speed(): number; play(); pause(); seek(t); setSpeed(x); stepTo(companyId, index) }`.
  - Recomputes the timeline (memoised) when the scene changes, then clamps `t` to `[0, duration]`. Advances with `requestAnimationFrame` while playing and stops at `duration`.

- [ ] **Step 1: Write the failing tests:**
  - `addCompany` then `undo` → back to 1 company. `redo` → 2.
  - `updateCompany` rankAndFile 40 → 60 → the current state's blocks hold 60 men, and the anchor is unchanged.
  - `adoptEndAsStart` → `current[id]` equals the end state and `orders[id]` is empty.
  - `exportScene` → `importScene` round trip is deep-equal.
  - **`import rejects bad file`:** `'{}'`, `'not json'` and `version: 0` → `ok:false` with a message. The store is untouched.
  - **`playhead clamps on recompute`:** seek to 30 s, then remove orders so duration = 5 → `t()` = 5.
- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement. Inject `requestAnimationFrame` and `localStorage` as parameters so the tests can fake them.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: scene store with undo/redo, JSON persistence, replay clock`.

---

### Task 9: Canvas camera and renderer

**Files:**
- Create: `src/ui/canvas/camera.ts`, `src/ui/canvas/render.ts`, `src/ui/styles.css`
- Modify: `src/main.ts`, `index.html`
- Test: `tests/ui/camera.test.ts`

**Interfaces:**
- Consumes: store, replay, `layout`, `guidePoint`, `Timeline.path`.
- Produces:
  - `Camera { worldToScreen(v): Vec2; screenToWorld(v): Vec2; pan(dxPx, dyPx); zoomAt(screenPt, factor); fit(bounds, viewport) }`. y flips. Zoom is clamped to 0.5–200 px per pace.
  - `drawScene(ctx, cam, store, replay)`, which draws in this order:
    1. Field and grid. Grid lines every 10 paces, plus a scale bar.
    2. A dashed "gap" line for companies with no orders.
    3. Ground arrows (`path`). Broad, translucent, with numbered ticks at segment `t0`s and a red end marker on an error segment.
    4. Ghosts at 35% opacity with dashed block outlines.
    5. Figures: from `timeline.sample(t)` when t > 0 or playing, otherwise `layout(current)`.
    6. Guide chevrons.
    7. Selection outlines and handles.
- **Figure styling:**
  - Privates: a dot of radius 0.3 paces, with the platoon shade of the company colour.
  - Corporals: the same dot with an outline.
  - Sergeants: diamonds.
  - Captain, lieutenant and ensign: rings of radius 0.45.
  - Drummer: a small square.
  - Facing tick: length 0.4.
  - Below 4 px per pace, each block draws as a filled quad instead of men.

- [ ] **Step 1: Write the failing tests:**
  - `screenToWorld(worldToScreen(p))` ≈ `p`.
  - `zoomAt` keeps the world point under the cursor fixed.
  - `fit` puts the bounds inside the viewport.
- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement `camera.ts` and `render.ts`. In `main.ts`, set up the layout grid (canvas plus a right column and a bottom bar, as in the spec's screen diagram), the store from `loadAutosave() ?? defaultScene()`, the replay, a `requestAnimationFrame` render loop, wheel zoom and empty-ground pan. The colours are defined as CSS variables in `styles.css` and read once at start.
- [ ] **Step 4:** Run `npm test && npm run dev`. Open the page. Expected: the default company in line with its ghost 30 paces ahead, a dashed gap line between them, and pan and zoom working.
- [ ] **Step 5:** Commit `feat: canvas camera and scene renderer`.

---

### Task 10: Field interactions

**Files:**
- Create: `src/ui/canvas/interact.ts`
- Test: `tests/ui/interact.test.ts`

**Interfaces:**
- Consumes: Camera, store, `frontageFromDrag`, `translateState`, `rotateState`, `resizeAboutDress`, `asColumnOfPlatoons`.
- Produces:
  - `hitTest(scene, ui, cam, screenPt): { kind: 'body' | 'rotate' | 'edgeL' | 'edgeR'; companyId: string } | null`. This is a pure function. It tests the state named by `ui.editTarget`, and handles get a 10 px screen tolerance.
  - `attachInteractions(canvas, cam, store, replay)`.

**Behaviour:**
- **Select:** click a company to select it. Shift-click adds or removes it from the selection. Clicking empty ground clears the selection and starts a pan.
- **Move:** dragging a body translates every selected company's `editTarget` state.
- **Rotate:** the rotate handle sits 2 paces in front of the front-rank centre. Rotation is about the selection's centre. Hold Shift to snap to 45°.
- **Frontage:** right-drag, or left-drag in the `frontage` tool, with exactly one company selected. A preview shows during the drag, with the readout "24 files × 3 ranks" plus any `note`, drawn by the renderer from a transient preview in `interact`. Mouse-up commits. If the ghost shape is `'column'`, it switches to `'line'`.
- **Edge handles:** resize the frontage about the dressing point, using `frontageFromDrag` from the fixed flank to the cursor.
- **One undo per gesture:** a drag dispatches only on mouse-up, with live previews before that.
- **Keyboard:** Ctrl+Z / Ctrl+Shift+Z for undo and redo. Delete removes the selected companies.
- **Context menu:** suppressed on the canvas.

- [ ] **Step 1: Write the failing tests** (pure `hitTest`):
  - A point at the company's anchor → `body`.
  - A point 2 paces in front of the anchor → `rotate`.
  - A point at the left-flank man → `edgeL`.
  - A far point → `null`.
  - With `editTarget 'ghost'`, the current block is not hit.
- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`, then check by hand in `npm run dev`:
  - Move, rotate (with the snap) and frontage drag of the ghost.
  - Frontage drag from left to right faces the men up the screen.
  - A narrow drag snaps to 3 ranks with a note.
  - Shift-select two companies and move them together.
  - Undo reverses a whole drag.
- [ ] **Step 5:** Commit `feat: select, move, rotate, frontage drag, edge handles`.

---

### Task 11: Toolbar and setup panel

**Files:**
- Create: `src/ui/panels/toolbar.ts`, `src/ui/panels/setup.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: the store, `getDrill`, `platoonWarnings`, `splitMen`, `resizeAboutDress`, `exportScene` / `importScene`.
- Produces: `mountToolbar(el, store, cam)` and `mountSetup(el, store)`. Both re-render on `subscribe`.

**Toolbar:**
- [Select] [Frontage] tool switch.
- Edit: current | ghost.
- Ghost show/hide.
- Ghost shape: Line | Column of platoons.
- Order: close | open | extended, filtered by `allowedOrders`.
- Dress: R | C | L.
- [Fit], [Save JSON], [Load JSON].

The order and dress switches act on the selected company's `editTarget` state through `resizeAboutDress` or a `dressBy` change. They are disabled when nothing is selected. A failed load shows `importScene`'s error in a dismissible message.

**Setup panel:**
- A drill system select (only 1764).
- A company list: add (40 men, 2 platoons, placed 10 paces left of the leftmost company), remove, rename, a colour input, and click to select.
- For the selected company:
  - Rank and file.
  - Platoon count. Changing it calls `splitMen`.
  - Per-platoon name and men.
  - Officer toggles.
  - Sergeant and corporal counts, a drummer toggle.
  - Ranks select from `allowedRanks`.
  - Order and dress, mirroring the toolbar.
- Warnings from `platoonWarnings`, plus "Platoons hold N men; rank and file is M" when the totals differ.
- Labels come from `drill.terms`.

- [ ] **Step 1:** Implement both panels.
- [ ] **Step 2:** Run `npm run typecheck && npm test`. Expected: PASS.
- [ ] **Step 3:** Check by hand in `npm run dev`:
  - Rank and file 40 → 41 shows the uneven-ranks warning, and the short file is on the left when dressed by the right.
  - Open order while dressed by the right keeps the right flank still.
  - Switching to 2 ranks re-forms the line.
  - Adding a company places it on the field.
  - Save, then Load, restores the scene. Loading a junk file shows an error.
- [ ] **Step 4:** Commit `feat: toolbar and company/platoon setup panel`.

---

### Task 12: Orders panel and replay bar

**Files:**
- Create: `src/ui/panels/orders.ts`, `src/ui/panels/replaybar.ts`
- Modify: `src/main.ts`, `src/ui/canvas/render.ts` (playhead-aware ticks)

**Interfaces:**
- Consumes: the store, replay, `drill.commands`, `segmentAt`, `endState`, `compareToGhost`, `PLAN_UNAVAILABLE`.
- Produces: `mountOrders(el, store, replay)` and `mountReplayBar(el, store, replay)`.

**Orders panel** (for the single selected company; with several selected, "Select one company"):
- **Rows:** a numbered list of rows showing the `CommandDef.words` and inline parameter inputs (number or select, from `ParamDef`).
  - Each row has a drag handle for reordering (`moveOrder`), a delete button, and an "insert after" button that opens the command menu.
  - An error segment's row is red with `segment.error`. Rows after it are greyed with "not reached".
  - Clicking a row's text calls `replay.seek(segment.t0)` and pauses.
- **Adding:** a "+ command" menu lists `drill.commands`, and choosing one appends it with the param defaults.
- **Comparison readout:**
  - Format: `"{distance:.1f} paces off · front {frontDeg:.0f}° · " + mismatches or "shape ✓"`, with a ✓ / ✗ against `settings` tolerances.
  - Below that, tolerance inputs (paces and degrees).
- **Plan:** a disabled "Suggest orders" button with `PLAN_UNAVAILABLE` as its tooltip.
- **Make this the start:** dispatches `adoptEndAsStart` with `endState`.

**Replay bar:**
- Play/pause, previous/next order (seeks to the selected company's segment boundaries), and a scrub range of `0..duration` (step 0.05).
- Numbered tick marks above the range at the selected company's segment `t0`s.
- A time readout `m:ss / m:ss`, and speed 0.5× / 1× / 2× / 4×.
- Space toggles play.

- [ ] **Step 1:** Implement both panels.
- [ ] **Step 2:** Run `npm run typecheck && npm test`. Expected: PASS.
- [ ] **Step 3:** Check by hand in `npm run dev` with the default company. Add "Right — Wheel 90° by company", "March 20", "Left — Wheel 90° by company". Expected:
  - The ground arrow shows two arcs joined by a straight march, with ticks 1–3.
  - Playing shows the pivot man marking time on each wheel.
  - Clicking order 3 jumps to the start of the second wheel.
  - The comparison reads in paces.
  - "Make this the start" moves the solid company to the end position and clears the list.
  - Changing order 1 to "Right — Face" turns rows 2–3 red or "not reached" with a reason.
  - Wheel by platoons forms a column visibly. Wheeling back re-forms the line.
- [ ] **Step 4:** Commit `feat: orders panel, replay bar and ghost comparison readout`.

---

### Task 13: Final verification

**Files:** none new.

- [ ] **Step 1:** Run `npm run typecheck && npm test && npm run build`. Expected: all pass, and `dist/` is built.
- [ ] **Step 2:** Run `npx vite preview` and do the full spec walk-through:
  - Two companies, each with a ghost and orders.
  - Replay at 4×.
  - Undo across a frontage drag, an order edit and a setup edit.
  - Reload the page, and the autosave restores everything.
  - Check 60 fps with 10 × 100 men (DevTools performance panel).
- [ ] **Step 3:** Run `grep -rn "SOURCE NEEDED" src/drill` to list the placeholders for the user.
- [ ] **Step 4:** Commit any fixes. `git log --oneline` shows one commit per task.
