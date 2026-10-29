# Goalie illustrations

One illustration per goalie type for the NHL DataViz page (goalies.html). The types come from
`build_goalie_types.py` (see `goalie-types-data.js`). Every picture is drawn by code as SVG, never traced
from a photo, and never shows a real player's likeness, mask art, or any NHL or team logo.

The brief, the type list and the budgets live in the Goalie Type Illustrations brief (a Claude Doc).

## Files

| File | What it is |
|---|---|
| `goalie-skeleton.js` | The canon, the shared skeleton, one pose per type, and the first style (`silhouette`) |
| `audit-silhouettes.cjs` | Step 2 audit: overlap of every pair at 32 px after a 1 px blur, plus bone-length drift |
| `audit/silhouettes.json` | The latest audit result |
| `preview/silhouettes.html` | The silhouette sheet (self-contained; built from `silhouettes.tpl.html`) |
| `styles.js` | The styles library: every style tried, each a function from the posed parts to SVG |
| `team-colours.json` | Team colours, saved with the source each was read from |
| `preview/styles.html` | Step 3 mockups: four styles on the same four goalies (built from `styles.tpl.html`) |
| `gilded.js` | Step 4: the chosen style, Knights: Gilded, with its colour rules and the 32 team crests |
| `medieval.js` | Step 4 round 2: the knight redrawn as smooth character shapes, in four medieval art styles (`preview/medieval.html`) |
| `STYLE.md` | The model sheet: conceit, tone, proportions, tokens, crests and don'ts |
| `check-colours.cjs` | Step 4 colour checks: number contrast (WCAG and APCA) and colour-blind simulations for all 32 teams |
| `audit/colours.json` | The latest colour check result |
| `preview/gilded-set.html` | Step 4 check sheet: the full set, every size in both themes, all 32 colour sets (built from `gilded-set.tpl.html`) |

Run the audits (the silhouette audit needs Playwright with Chromium):

    NODE_PATH=$(npm root -g) node illustrations/audit-silhouettes.cjs
    node illustrations/check-colours.cjs

## The canon

Fixed once. A pose is a set of joint angles on these bones, never free points, so no bone can stretch
between poses or animation frames. Each art style is a function from the posed points to SVG, so a restyle
reuses every pose.

| Part | Units (frame is 100 × 100, ice at y = 92) |
|---|---|
| Head (mask) | 11; a standing goalie is 7 heads tall |
| Neck to mask centre | 6.5 |
| Torso, pelvis to neck | 24; shoulders 15 apart, hips 10 apart |
| Arm | upper 13, forearm 12 |
| Leg | thigh 19, shin 20 (the pad starts 5 above the knee), skate 8 |
| Stick | up to 40; paddle on the lower 13, blade 10 |

The glove is on the viewer's right and the blocker and stick on the left: a left-catching goalie facing us.

## Shape language

Neighbouring types differ in shape, not in detail:

| Type | Shape |
|---|---|
| Steady | Compact upright rectangle, symmetric |
| Workhorse | Square stance framed by the net behind |
| High-Danger Stopper | Low wide triangle, pads flat on the ice |
| The Wall | Tall wide box, arms out to both posts |
| Rebound Controller | Low round dome, folded over the puck |
| Under Siege | Hunched wide crouch, shots raining in |
| Crease Battler | Hooked lean, head out past the screen |
| Standout | Upright with one spike: the glove held high |
| Donut King | Ring held over the head |
| Grandpa | Bent question mark, leaning on the stick |
| Young Gun | Airborne star, daylight under the skates |
| Style King | T-bar on top: stick across the shoulders |

## Styles library

Every style tried stays here, so a restyle costs minutes. Each one has a one-sentence conceit.

| Key | Style | Conceit |
|---|---|---|
| `glass` | Stained Glass | Each goalie is a cathedral window: lead lines and panes of team colour. |
| `plate` | Research Plate | A figure from the journal: each goalie drafted in white line on a plate of team colour. |
| `riso` | Two-Ink Print | A club-room risograph in two team inks, with halftone pads and a little misregistration. |
| `illuminated` | Illuminated Plate | A page from the GRJ's book of keepers: flat colour in ink outline, inside a gilded frame. |
| `skeletons` | Skeletons | The bone crew: every goalie is a skeleton suiting up, glowing in team colour after dark. |
| `knights` | Knights | Knights of the crease: plate armour under a team-colour tabard, with a kite shield for a blocker. |
| `skeletons-xray` | Skeletons: Light Box | An X-ray on the light box: see-through gear in team colour, the bones showing through. |
| `skeletons-bold` | Skeletons: Bold Bones | Chunky one-piece bones on a light team-tint card, cut back to read at leaderboard size. |
| `knights-tournament` | Knights: Tournament | Tilt-yard day: gunmetal armour against a light pavilion striped in team colour. |
| `knights-gilded` | Knights: Gilded | Gold armour on a deep team-colour field scattered with stars, like a herald's roll. |
| `fantasy` | High Fantasy | An epic-quest keeper: rune-lit armour and a team-colour cloak against a dusk sky over far mountains. |

Round 1 (Research Plate, Two-Ink Print, Stained Glass, Illuminated Plate): Goldy kept Illuminated Plate.
Round 2 added Skeletons, Knights and High Fantasy, and gave Illuminated Plate a gilded nimbus so dark jerseys
stand off its navy field.
Round 3: Goldy kept Skeletons and Knights and asked for two alternatives to each (Light Box, Bold Bones; Tournament, Gilded).
Goldy picked Knights: Gilded (F3). Step 4 draws the full set in it: see `STYLE.md`.
Round 2 of Step 4: Goldy asked for knights that read as characters, in a medieval art style, keeping the crests: Illuminated Miniature, Tapestry, Woodcut and Marginalia (`medieval.js`).
Round 3 of Step 4: Goldy picked Tapestry (H2) and asked for more definition and realism on the gear: a cage helm with a dangler, pad channels and straps, a laced catcher, a blocker cuff, floaters, elbow cops and a taped stick, in laid-and-couched wool (`preview/tapestry.html`). Below 100 px it draws a lighter cut. STYLE.md still describes Gilded and gets rewritten for Tapestry once it is locked.
