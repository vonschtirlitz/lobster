<p align="center"><img src="public/favicon.svg" width="96" alt="LOBSTER logo: a red lobster"></p>

<h1 align="center">LOBSTER</h1>

<p align="center"><b>L</b>ine <b>O</b>rder <b>B</b>uilder &amp; <b>S</b>imulated <b>T</b>roop <b>E</b>volution <b>R</b>ehearser</p>

<p align="center"><i>Wheel, march, dress, repeat.</i></p>

---

LOBSTER is a browser tool for planning and rehearsing 18th-century line-infantry drill. You place a company on the field, drag out where you want it to end up, and give the words of command. It then replays what the company actually does, wheel by wheel, and tells you how close you got.

It's built for reenactors, wargamers and drill researchers who already know their facings from their wheelings and want to practise *what to call out*, or check what a given call would really do.

![LOBSTER showing two companies: one wheeling right, marching and wheeling left along a curved ground arrow; another wheeling into a column of platoons](docs/screenshot.png)

## Features

- **Field:** a top-down field where every soldier is a dot with a facing tick. Officers, sergeants, corporals and the drummer each have their own mark, and a chevron marks the directing file.
- **Manipulation:** Total War style controls. Drag to move, use the handle to rotate, and right-drag a frontage line to spread or deepen the ranks. Drag a flank to widen or narrow the line about its dressing point.
- **Ghost targets:** each company has a see-through target. It can be set as a line or as an open column of platoons.
- **Companies and platoons:** set rank and file, telling off into platoons, officers and NCOs, 2 or 3 deep, close / open / extended order, and dress by the right, centre or left.
- **Words of command:** march, face, wheel by company or by platoons, take order, dress, form deep and mark time. Orders that can't be given in the company's current state are flagged with the reason.
- **Drill-faithful replay:**
  - wheels pivot on the flank man and follow true arcs, timed at the step's cadence;
  - a march to a flank goes by files, and changes of order spread from the dressing point;
  - a ground arrow traces the real path, with a numbered marker at each order;
  - several companies run in parallel.
- **"How close did you get":** the end of each company's orders is compared with its ghost on position, front, shape, files, ranks, order and dressing.
- **Save and share:** scenes save and load as JSON and autosave in the browser. Undo and redo cover everything.
- **Swappable drill systems:** every drill number and word of command lives in one module, so other manuals (Steuben, French 1791, …) can be added later.

## Quick start

Requires Node.js 18+.

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

> **WSL note:** on a Windows drive mounted in WSL (`/mnt/c`, `/mnt/e`, …), Vite can't see file changes. Restart it with `npx vite --force` after editing.

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm test` | Unit tests (Vitest) |
| `npm run typecheck` | Type-check with `tsc` |
| `npm run build` | Type-check and build the static site into `dist/` |
| `npm run preview` | Serve the built `dist/` locally |

## How to use it

| To… | Do this |
|---|---|
| Pan / zoom | Drag empty ground / mouse wheel. **Fit** frames every company |
| Choose what you're editing | **Edit: Start / Ghost** in the toolbar |
| Move a company | Drag it |
| Rotate | Drag the round handle in front of it. Hold Shift to snap to 45° |
| Set frontage | Right-drag (or the **Frontage** tool) from one flank to the other. The men face to the left of the drag direction |
| Widen or narrow | Drag a flank square |
| Select several | Shift-click |
| Give orders | **+ March**, **+ Wheel**, … in the Orders panel. Edit parameters inline and drag rows to reorder |
| Replay | Play / pause (Space), step between orders, scrub, speed up to 4×. Click an order's words to jump to it |
| Chain exercises | **Make this the start** turns the end of the replay into the new starting position |
| Undo / redo | Ctrl+Z / Ctrl+Shift+Z |

## Status and drill sources

LOBSTER is early work. The British **1764 Manual** is the first drill system, and **its numbers are placeholders**:
- file intervals and rank distances;
- paces per minute;
- where officers and NCOs are posted;
- the exact words of command.

They're marked `SOURCE NEEDED` in [`src/drill/gb1764.ts`](src/drill/gb1764.ts). Corrections with citations (the Manual, Cuthbertson, regimental standing orders) are very welcome.

Planned:
- working out the orders automatically from the ghost (the **Suggest orders** button);
- typed, free-text words of command;
- more commands (inclines, successive wheels of a column, firings);
- battalion level;
- other drill manuals.

The design and implementation notes are in [`docs/superpowers/`](docs/superpowers/).

## Deploying

`npm run build` produces a fully static site in `dist/`. It needs no server-side code, and asset paths are relative, so it works from any folder, bucket prefix or subpath. Any static host will do: GitHub Pages, Cloudflare Pages, Netlify, or AWS S3 + CloudFront / Amplify Hosting.

## Project layout

```
src/model/    formation geometry, telling off, soldier layout
src/drill/    drill systems (gb1764.ts) and their types
src/engine/   order primitives, timeline execution, ghost comparison
src/state/    scene store, undo/redo, persistence, replay clock
src/ui/       canvas renderer, interactions, panels
public/       static assets (the lobster)
tests/        Vitest unit tests
docs/         screenshot, design and implementation plan
```

## Licence

_To be decided._
