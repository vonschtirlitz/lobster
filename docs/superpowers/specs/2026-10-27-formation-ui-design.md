# Formation Planner: UI and Drill Replay Design

Date: 2026-10-27
Status: draft for review

## Intent

A browser tool for planning 18th-century line-infantry manoeuvres. The end goal works in both directions:

1. **Orders → result:** build a sequence of words of command and watch exactly what the unit does.
2. **Plan → orders:** place a unit, place where you want it, and get the sequence of commands that takes it there.

It is a practice tool for reenactors, wargamers and drill researchers. They already know intermediate drill and tactics. They want to rehearse what to call out in real life, and to check what a given call would actually do. The tool should speak period language and never needs to teach basics.

**This phase builds:**
- the field, the draggable formations, the company/platoon setup, the ghost target;
- the **orders → result** direction for a core set of commands, so the replay follows the drill (two wheels trace two real arcs);
- a check of how close the orders brought the company to the ghost.

That makes the core practice loop: set the start, set the ghost, call the orders, watch, compare.

**Plan → orders** (generating commands from the ghost automatically) is a later phase. This phase leaves a seam for it.

## Goals

- A 2D top-down field where every soldier is drawn as a dot with a facing indicator.
- Total War / Master of Command style manipulation: move, rotate, and drag out a frontage line that spreads or deepens the ranks.
- A ghost (target) formation per company.
- An orders list per company, built from a palette of period commands.
- An animated replay that executes those orders step by step, with a ground arrow tracing the actual path.
- A "how close did you get" comparison against the ghost.
- A setup panel: total men per company, ranks, platoons inside each company, multiple companies on the field.
- The drill system (1764 Manual first) is a swappable module, not hard-coded into the UI or the executor.

## Non-goals (this phase)

- Generating orders from the ghost automatically (plan → orders). A stub stands in for this.
- Typing free-text words of command. Orders are picked from a palette, and the free-text parser comes later.
- Battalion level, and platoons told off across company lines (1764 firings practice). Deferred by the user.
- Commands outside the core set below. Examples: successive wheels of a column on a fixed point, oblique/incline steps, firings, forming square.
- Terrain, enemy units, fire, casualties, multiplayer, accounts.
- Mobile-first layout. Desktop with a mouse is the target. It should not break on a laptop trackpad.

## Anti-goals

- Gamey shortcuts that misrepresent drill. No formation change happens without an order, and the replay never "teleports" or blends men straight from start to end.
- Anachronistic terminology in the UI where a period term exists (files, ranks, telling off, wheel, platoon, subdivision).
- Coupling the 1764 specifics (rank count, intervals, cadence, officer posts, words of command) into UI or executor code. They must come from the drill module.

## Constraints and decisions made with the user

- **Stack:** TypeScript + Vite, runs in a modern desktop browser.
- **Base drill system:** British 1764 Manual. The user will supply Cuthbertson and other sources later to refine it. Other systems (Steuben, French 1791) should be addable as new drill modules.
- **Hierarchy:** the top level is the **company**. There can be several companies on the field. **Platoons always sit inside one company.**
- **Soldier rendering:** simple dots. Officers and NCOs are visually distinct. Each figure has a facing indicator.
- **Ghost + replay + ground arrow** are all wanted.
- **Order (spacing) and dressing:** close / open / extended order, and dress by right / left / centre.
- **The replay follows the orders**, not a blend from start to finish. Orders are picked from a list in this phase.

## Domain model

```ts
type Vec2 = { x: number; y: number };     // world units = paces
type OrderSpacing = 'close' | 'open' | 'extended';
type DressPoint = 'right' | 'left' | 'centre';
type MenFacing = 'front' | 'right' | 'left' | 'about';   // relative to the block's front

interface Company {
  id: string;
  name: string;                            // e.g. "Capt. Smith's Company"
  rankAndFile: number;                     // private men
  platoons: Platoon[];                     // ordered right → left when in line
  officers: OfficerSpec;                   // captain, lieutenant, ensign toggles
  ncos: NcoSpec;                           // sergeants, corporals, drummer
  colour: string;                          // display tint
}

interface Platoon {
  id: string;
  name: string;                            // "1st Platoon"
  men: number;                             // sum across platoons == company.rankAndFile
}

// One platoon standing as a rectangle of men.
interface Block {
  platoonId: string;
  anchor: Vec2;                            // centre of the block's front rank
  front: number;                           // radians, the block's front
  files: number;
  ranks: number;
}

interface FormationState {                 // one per company for "current", one for "target"
  blocks: Block[];                         // one per platoon
  menFacing: MenFacing;                    // after "To the Right, Face" etc.
  order: OrderSpacing;
  dressBy: DressPoint;
}

interface Figure {                         // computed, not stored
  role: 'private' | 'corporal' | 'sergeant' | 'drummer' | 'officer';
  platoonId?: string;
  slot: string;                            // stable identity, e.g. "p1:f3:r2", used for matching
  pos: Vec2;
  facing: number;
}
```

**Why per-platoon blocks (my call):** wheeling by platoons breaks a company line into a column of platoons. A single rectangle can't represent that, so the state is a list of platoon blocks from the start. In line, the blocks stand side by side, shoulder to shoulder, with the same front.

**Helpers:**
- `asLine(company, anchor, front, ranks, order, dressBy, drill)` builds a company line.
- `asColumnOfPlatoons(...)` builds an open column at full distance, so a wheel by platoons brings it back into line.
- `describe(state)` reports "line", "open column of platoons" or "irregular", for the UI readouts.

`layout(company, state, drill) → Figure[]` is the single pure function that turns a state into soldier positions. Everything that draws men calls it.

**Telling off within a company:**
- Platoons hold contiguous blocks of files counted from the right.
- Given a rank count, each platoon has `ceil(men / ranks)` files.
- If a platoon's men don't divide evenly by the rank count, its file on the side away from the dressing point is short in the rear rank(s), and the setup panel shows a warning.

## Drill system module

```ts
interface DrillSystem {
  id: string;                              // "gb-1764"
  name: string;
  defaults: {
    ranks: number;                         // 1764: 3
    allowedRanks: number[];                // [2, 3]
    allowedOrders: OrderSpacing[];
    fileInterval: Record<OrderSpacing, number>;  // paces between file centres
    rankDistance: Record<OrderSpacing, number>;  // paces between ranks
    defaultDress: DressPoint;              // 1764: 'right'
    platoonsPerCompany: number;
    steps: Record<string, { pacesPerMinute: number }>; // e.g. ordinary, quick
    beatSeconds: number;                   // time allowed for a facing or a motion
  };
  commands: CommandDef[];                  // the palette this manual offers
  postOfficersAndNcos(company: Company, s: FormationState): Figure[];
  terms: Record<string, string>;           // UI labels, so another manual can rename things
}

interface CommandDef {
  kind: CommandKind;                       // which executor primitive runs it
  words: string;                           // "To the Right, Wheel"
  params: ParamDef[];                      // e.g. degrees, paces, by company/by platoons
}
```

**Placeholder numbers:** the 1764 module's values are placeholders, documented with `// SOURCE NEEDED`. That covers intervals, rank distance, step cadences, where the captain, subalterns and sergeants stand, and the exact words of command. The user corrects them from the Manual and Cuthbertson. The UI and executor read these values from the module and never use literals.

## Order and dressing

Every formation state (current and ghost) carries an **order** (spacing) and a **dressing point**. The ghost can differ from the current state, so going from close to open order, or changing which side the line dresses by, is something the orders have to achieve.

**Order (spacing):**
- **Close**, **open** and **extended** order. Each sets the file interval and rank distance, read from the drill module.
- A drill system lists only the orders it supports in `allowedOrders`. The 1764 module includes all three, but its extended-order values are placeholders marked `SOURCE NEEDED`. Extended order is light-infantry practice, so the numbers should come from the user's sources (e.g. Cuthbertson).
- **Controls:** a three-way switch in the setup panel for the selected company, also on the toolbar. It edits whichever of current or ghost is being edited. In the replay, the order only changes through an order command.

**Dressing point (right, left or centre):**
- **Held point:** the dressing point is the part of the line that stays put when the formation changes width. That applies whether the change comes from an order command, the edge handles or the setup panel. Dressed by the right, the right flank stays fixed and the line opens or closes toward the left. Dressed by the left, the reverse. Dressed by the centre, the line opens or closes evenly about the centre file.
- **Short files:** these go to the flank away from the dressing point. When dressed by the centre, they go to the left (my call).
- **Frontage drag:** the drag still sets both flanks explicitly. The dressing point only decides which end is the fixed anchor when the drag is adjusted afterwards with the edge handles.
- **On the field:** the directing file (right-hand file, left-hand file or centre file) is drawn with a small guide marker (a chevron in front of the front-rank man), so the dressing point is visible at a glance on both the current formation and the ghost.
- **Controls:** a right / centre / left switch beside the order switch. The default comes from the drill module (1764: right).

## Orders and execution

### Core command set (this phase)

Each command maps to one executor primitive. The words and parameter defaults come from the drill module. The words shown here are placeholders.

| Command (placeholder words) | Primitive | Parameters | Behaviour |
|---|---|---|---|
| March / Halt | `march` | paces, step (ordinary/quick) | Every man steps off in the direction he faces. Fronted, the block advances. Faced right or left, the block marches by files to that flank. Ends halted. |
| To the Right / Left, Face; To the Right About, Face; Front | `face` | direction | Men turn in place. Takes `beatSeconds`. Changes `menFacing`, not `front`. |
| Right / Left Wheel … Halt, Dress | `wheel` | degrees (default 90), by company or by platoons | Each wheeling unit rotates rigidly about its pivot flank man, who marks time. The wheeling flank man moves at the step's cadence along the arc, which sets the duration. "By platoons" wheels every platoon at once on its own pivot (line ↔ open column). Only allowed when fronted. |
| Open / Close Order (ranks) | `spacing` | target order | Rear ranks step back or close up to the new rank distance. Files open or close to the new interval, about the dressing point. |
| Dress (right / left / centre) | `dress` | point | Changes `dressBy`. Takes `beatSeconds`. No movement in this phase. |
| Form 2 deep / 3 deep | `depth` | ranks | Re-forms to the new rank count about the dressing point. Each man walks a straight line to his new slot, at the step's cadence, with men moving in parallel. Marked `SOURCE NEEDED` for the actual 1764 method. |
| Mark time / Wait | `wait` | seconds or beats | Nothing moves. Used to stagger companies against each other. |

Adding a command later means adding a `CommandDef` to the drill module and, if needed, a new primitive. The UI doesn't change.

**Rules the executor enforces:**
- **Invalid orders:** an order that isn't valid in the current state, such as wheeling while faced to a flank, is flagged in the orders list with the reason, and the replay stops before it.
- **Facing:** facing and marching use `menFacing` relative to each block's `front`, so "Right, Face, March 20, Front" is a flank march of 20 paces.

### Executor

```ts
interface Order { id: string; kind: CommandKind; params: Record<string, unknown>; }

interface Segment {                        // one executed order
  order: Order;
  t0: number; t1: number;                  // seconds
  start: FormationState; end: FormationState;
  sample(t: number): Figure[];             // true motion within the segment
  error?: string;                          // set if the order was invalid; replay stops here
}

interface Timeline {
  duration: number;
  segments: Map<string, Segment[]>;        // companyId → its segments
  sample(t: number): Map<string, Figure[]>;
  path(companyId: string): Vec2[];         // the company's guide point traced over time, for the ground arrow
}

interface OrdersEngine {
  execute(companies: { company: Company; start: FormationState; orders: Order[] }[], d: DrillSystem): Timeline;
  plan(from: FormationState, to: FormationState, c: Company, d: DrillSystem): Order[];   // stub this phase
}
```

- **One segment per order:** each order runs from the end state of the one before. Within a segment, `sample(t)` gives the true motion: wheels follow arcs, flank marches move along the files, and changes of order spread from the dressing point.
- **Simultaneous companies:** all companies start at t = 0 and run their own lists in parallel. Staggering is done with `wait` (my call).
- **Pure and fast:** `execute` is pure and deterministic. Re-running it on every edit of the orders list must be fast enough to feel instant for about 10 companies × 20 orders.
- **Plan stub:** `plan()` returns an empty list with the message "Automatic orders not yet available". That is the seam for the later phase.

### Comparing with the ghost

After the timeline ends, each company's end state is compared with its ghost:
- **Position:** distance between the guide points, in paces.
- **Front:** difference in degrees.
- **Shape:** files, ranks, order, dressing and men's facing must match, or the mismatch is listed.
- **Shape of the whole:** line versus column, from `describe()`.

The result shows per company as a short readout ("4.5 paces short · front 0° · 3 deep ✓ · dress right ✓"). There is a pass mark when it's within tolerance. **My call:** 2 paces and 5°, both adjustable in settings.

## Screen

```
┌────────────────────────────────────────────────────────────┬────────────────┐
│ toolbar: [Select] [Frontage] [Edit: current|ghost] [Ghost] │  Setup panel   │
│          [Order: close|open|ext] [Dress: R|C|L] [Fit]      │  (companies,   │
├────────────────────────────────────────────────────────────┤   platoons)    │
│                                                            ├────────────────┤
│                    field canvas                            │  Orders panel  │
│                                                            │  1. Right Wheel│
│                                                            │  2. March 40   │
│                                                            │  3. Left Wheel │
│                                                            │  [+ command ▾] │
│                                                            │  vs ghost: ✓   │
├────────────────────────────────────────────────────────────┤                │
│ replay: ▶ ❚❚ |◀ ▶|  ──[1]──●──[2]────[3]──  0:12 / 0:40  1× │                │
└────────────────────────────────────────────────────────────┴────────────────┘
```

### Field canvas

- Canvas 2D rendering. Pan by dragging empty ground or holding space and dragging. The mouse wheel zooms around the cursor. "Fit" frames all companies.
- A light grid every 10 paces with a scale bar. The background is a plain field colour, not decorative.
- **Figures:**
  - **Privates:** filled dots tinted by platoon (company colour, shaded per platoon) with a short facing tick.
  - **Corporals:** same as privates, with a small outline.
  - **Sergeants:** diamonds.
  - **Officers:** larger rings.
  - **Drummer:** a small square.
  - All figures have facing ticks. At low zoom, figures may collapse into a filled block per platoon so it stays readable and fast.
- **Current formation:** solid. **Target (ghost):** same layout at about 35% opacity with a dashed outline around each block.
- **Ground arrow:**
  - A broad translucent arrow along `timeline.path(companyId)`, the guide point's real track through all the orders. Two wheels show as two arcs joined by the march between them.
  - Small tick marks along it show where each order begins, numbered to match the orders list.
  - Shown whenever the company has orders, not only during replay.
- **No orders yet:** a thin dashed straight line from current to ghost shows the gap to close. It is clearly styled as "not a path".
- **Invalid orders:** if an order is invalid, the arrow ends at that point with a red marker.

### Manipulation (applies to whichever is being edited: current or ghost)

Clicking a company selects it. The **Edit: current | ghost** toggle chooses which one drags change. The default is ghost. Editing current sets the starting position, and any change to it re-runs the orders.

- **Move:** drag the body of the block.
- **Rotate:** drag a handle in front of the centre of the front rank. Hold Shift to snap to 45°.
- **Frontage drag (Total War style):**
  - In Frontage mode, or with right-drag on the field while a company is selected, press at one flank and drag to the other.
  - Line length sets the target total files: `floor(length / fileInterval) + 1`, clamped to [1, men].
  - Ranks become `ceil(men / files)`, snapped to `allowedRanks` with the reason shown. Platoon files then follow from the telling-off rule.
  - The line's direction sets the front: men face to the left of the drag direction, so dragging left to right makes them face up the screen.
  - A live readout shows "24 files × 3 ranks". This always produces a line.
- **Edge handles:** drag a flank to widen or narrow the line about the dressing point.
- **Ghost as column (my call):** the ghost has a **Line | Column of platoons** switch, so a target like "be in open column here" can be set. Move and rotate work the same on a column.
- **Several companies (my call):** Shift-click to select more than one. Move and rotate apply to the group, with rotation about the group's centre. Frontage drag applies only when one company is selected. Companies may overlap, with no collision checks.
- **Undo/redo** (Ctrl+Z / Ctrl+Shift+Z) for all field, setup and orders edits.

### Setup panel

- A list of companies: add, remove, rename, colour. Selecting one in the list selects it on the field.
- Per company:
  - **Rank and file** (number).
  - **Platoons:** count. Men are split evenly by default, and each platoon's count can be edited. The total must equal rank and file, with a live mismatch warning.
  - **Officers:** captain, lieutenant, ensign (toggle each).
  - **NCOs:** sergeants (count), corporals (count), drummer (toggle).
  - **Ranks:** chosen from the drill system's `allowedRanks`.
  - **Order and dressing:** close / open / extended, and dress by right / centre / left.
- A drill system selector at the top, with only "1764 Manual" available for now.
- Changing setup values updates current, ghost and the replay immediately.

### Orders panel

- **The list:** the orders for the selected company, as a numbered list of words of command with their parameters ("Right, Wheel, 90°, by platoons").
  - Each row can be edited inline (parameters), reordered by dragging, deleted, and have an order inserted after it.
  - Invalid orders show in red with the reason.
- **Adding orders:** a **+ command** menu lists the drill module's `commands`. Choosing one appends it with default parameters.
- **Clicking an order** scrubs the replay to the start of that order. The field then shows the formation as it stands when that word is given.
- **Comparison:** the "vs ghost" readout sits at the bottom.
- **Plan button:** a disabled "Suggest orders" button marks the plan → orders seam.

### Replay bar

- Play, pause, step to the previous or next order, scrub, and speed (0.5×, 1×, 2×, 4×).
- The scrub track shows numbered order boundaries for the selected company. Time is real drill time at the module's cadences, so a 90° wheel of a long line visibly takes longer than one of a platoon.
- During the replay, the animated figures draw in place of the current formation. The ghost stays visible.
- **Make this the start (my call):** a button that copies the end state into "current" and clears the orders. This chains manoeuvres one exercise at a time.

## Persistence (my call)

- The whole scene (drill system id, companies, current and ghost states, orders lists) saves and loads as a JSON file, and autosaves to localStorage. That makes iteration and sharing exercises easy.

## Testing (my call)

Vitest unit tests for:
- `layout()`, the telling-off rule and short-file placement.
- Frontage-drag maths: length → files, direction → front.
- **The executor**, which is where most of the risk is:
  - A 90° right wheel keeps the pivot man fixed, and its duration matches the outer flank's arc at the cadence.
  - A wheel by platoons from line gives an open column, and wheeling back restores the line.
  - "Right, Face, March N, Front" moves the block N paces to its right.
  - Opening order holds the dressing point.
  - Invalid orders are flagged and stop the timeline.
  - `sample(t)` is continuous at segment boundaries.
- The ghost comparison.

Rendering and interaction are checked manually in the browser.

## Left to the builder

- Whether to use plain DOM or a small UI library (e.g. Preact) for the panels. The canvas must stay framework-free.
- File and folder layout, state store shape, hit-testing approach.
- Exact colours and figure sizes, within the readability rules above.
- Performance tactics. Target: about 10 companies of about 100 men each at 60 fps on a laptop.
