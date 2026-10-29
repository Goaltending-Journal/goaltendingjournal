# Model sheet: Knights: Gilded

The chosen style for the goalie-type illustrations (Goldy, 2026-10-29). The code is `gilded.js`; the checks are
`check-colours.cjs` (results in `audit/colours.json`); the check sheet is `preview/gilded-set.html`.

## Conceit and tone

**Conceit:** each goalie is a knight of the crease on a page from a herald's roll: gold armour on a deep
team-colour field scattered with stars.

**Tone:** proud and a little playful, like a team banner. It honours the type without mocking the player.

## Proportions

Frame 100 × 100 units, ice at y = 92 before the figure is fitted into the card (ice at 82.4 after). A pose is joint
angles on these bones (see `goalie-skeleton.js`), never free points.

| Part | Units |
|---|---|
| Head (great helm) | 11; a standing goalie is 7 heads tall |
| Torso, pelvis to neck | 24; shoulders 15 apart, hips 10 apart |
| Arm | upper 13, forearm 12 |
| Leg | thigh 19, shin 20, skate 8 |
| Stick | up to 40 |
| Crest | up to 11 above the helm |
| Kite shield | 13 wide, 14 long, square to the blocker forearm |

**Turnaround:** front view only, by design. Every surface shows the goalie facing the reader, so the canon
fixes one view and no side or back view is drawn.

## Tokens

| Token | Value | Rule |
|---|---|---|
| Armour | `#FBEFB8` `#D8B256` `#9A6F1F` | Gold gradient, light to shadow, on every metal part |
| Ink | `#1d1e26` | Every outline; the outer hairline; the number's edge |
| Ice | `#E8ECF4` | Net posts, puck rims, blade tape |
| Tabard | team | The sweater colour: the first colour in the team's published list (`team-colours.json`) |
| Field | team | Sweater colour 45% darker; charcoal for a black sweater; the second team colour for a gold sweater (Nashville, Vegas) |
| Ground | team | Sweater colour 65% darker (black sweaters: near-black) |
| Trim | team | Crest, tabard edge, shield rim: the first other team colour reaching 3:1 on the field, and 2:1 on the tabard when the tabard needs its edge, under normal vision and simulated deuteranopia, protanopia and tritanopia; else white |
| Number | white or ink | Jost 600 at 8 units. White with an ink edge; ink with a white edge where white is under 3:1 on the tabard (Nashville, Vegas) |
| Frame | | Gold rule 3 units wide inside an ink hairline; four-point stars at 35% gold |

All 32 teams pass every pair in all four kinds of vision (`node illustrations/check-colours.cjs`). Each still
is under 6 KB.

## Crests (the marks)

One crest per team on top of the helm, drawn after the team's nickname as a plain heraldic figure: `CRESTS` in
`gilded.js`. None is a team logo, crest, wordmark or mask design. Toronto gets a plain leaf, not a maple leaf;
the star, crown, fin, bolt and arrowhead are generic shapes that avoid each team's logo layout. Each was
compared by eye against the team's logo. A formal trademark search has not been done and should be before launch.

## Don'ts

- No real team logo, wordmark or mask design, and no real player's face.
- No thin props: anything the type depends on (net, pucks) must survive 32 px.
- No gold field behind gold armour.
- No number without its fallback.
- No trim that only differs from its neighbour by hue; it has to hold contrast for colour-blind readers.
- No type told apart by colour alone; types differ by shape.
- No new pose drawn as free points; add joint angles to `POSES` in `goalie-skeleton.js`.
