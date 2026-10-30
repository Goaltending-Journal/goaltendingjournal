# Model sheet: Skeletons: Light Box

The chosen style for the goalie archetypes (Goldy, 2026-10-30), after Gilded Knights, Tapestry and goalie masks
were tried and retired. The code is `skeletons("xray")` in `styles.js` (key `skeletons-xray`); the checks are
`audit-lightbox.cjs` (results in `audit/lightbox.json`); the sheets are `preview/lightbox.html` and
`preview/lightbox-motion.html`; the site panel is `../goalie-types-panel.js`.

## Conceit and tone

**Conceit:** every goalie is an X-ray pinned to a light box: the gear goes see-through in team colour and the whole
skeleton shows through, skull, ribs and shins included, with a goalie cage over the skull.

**Tone:** clever and a little playful, like a team doctor's light box. It honours the archetype without mocking
the player, and never shows a real face.

## Proportions

Frame 100 × 100 units. The skeleton, bone lengths and poses are unchanged (`goalie-skeleton.js`): a pose is joint
angles, never free points. The figure is scaled to fit at up to 0.86, from the highest point of its loop, so it
keeps one size in every frame.

| Part | Units |
|---|---|
| Card | 98.8 square, radius 3, edge 1.2; inner film frame 92 square |
| Grid | lines every 12.5, 0.4 wide (full cut only) |
| Bones | knuckled limb bones 4.6 wide (plain stadiums in the light cut), shins 3.6 |
| Skull | radius 5.4, jaw 6 wide; cage of three bars and two curved bars over the face |
| Spine and ribs | dashed spine; three ribs, 7.5 to 6 wide |
| Film label | Jost 500 at 3.6, at the foot (y = 93): ARCHETYPE · TEAM |
| R marker | Jost 600 at 5, top right |
| Number | Jost 600 at 7.5 on the chest (full cut only) |

**Turnaround:** front view only, by design.

## Tokens

| Token | Value | Rule |
|---|---|---|
| Box | `#dde9f1` | The light box |
| Card edge | `#5d7d95` | 3.8:1 on the light page; the box itself is 15:1 on the dark page |
| Grid, frame | `#b9cddb`, `#9fb7c8` | |
| Film label, R | `#56748a` | 3.8:1 on the box |
| Bone | `#FBFDFF` fill, `#1d3346` outline | The outline is 10.3:1 on the box |
| Gear | team colour at 60% (85% in the light cut) | Pads, glove, blocker, sweater |
| Gear outline | the team colour darkened until it reaches 3:1 on the box (`xrayEdge`) | Also the cage and the number |
| Number | gear outline colour with a 2.4 white halo | |
| Stick | `#3a2e24` | Fixed |
| Donut | `#E9A4B8` | Fixed |
| A type nobody holds yet | Deep Periwinkle `#5563C4` | The site's brand colour, labelled NHL |

All 32 teams pass in all four kinds of vision. Worst case Nashville: gear outline 3.5:1 on the box, number 4.3:1
on its halo.

## Cuts and modes

- **Full cut** at 100 px and over: grid, film frame, label, R marker, knuckled bones, shins and number.
- **Light cut** below 100 px (the site's cards are 64 px, 52 px on phones; leaderboard 32): denser gear, plain
  bones, no grid, label, shins or number. Shapes and colours are the same.
- **Plain mode** (`opts.plain`): the figure alone with a ground shadow (`#1d3346` at 16%) and no card, for boards
  where several goalies stand together; crop it to its drawn bounds.

Compressed, a full-cut still is 1.7 KB and a light-cut still 1.1 KB.

## Motion

Each archetype has a 3.2 to 3.9 second loop of three key poses (`motion.js`): A is the still, then B and C, each
held, with a 0.3 s eased move between. It plays at 12 frames a second, prebuilt in idle time. On the site a card
plays only while hovered or focused; nothing plays under reduced motion, and nothing flashes. Frame time is 1.1 ms
on average with the CPU slowed 6x (budget 8 ms).

## Don'ts

- No real team logo, wordmark or mask design, and no real player's face.
- No gear outline under 3:1 on the box; darken the team colour instead.
- No full cut below 100 px: the grid and knuckles turn to speckle.
- No archetype told apart by colour alone; archetypes differ by shape (closest pair at 32 px: 0.63, limit 0.85).
- No new pose drawn as free points; add joint angles to `POSES` in `goalie-skeleton.js`.
