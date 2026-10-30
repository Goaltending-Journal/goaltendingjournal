# Goalie illustrations

One illustration per goalie archetype for the Archetypes section of the NHL DataViz page (goalies.html). The
archetypes come from `build_goalie_types.py` (see `goalie-types-data.js`, rebuilt nightly). Every picture is drawn
by code as SVG, never traced from a photo, and never shows a real player's likeness, mask art, or any NHL or team logo.

**The chosen style is Skeletons: Light Box** (`skeletons-xray` in `styles.js`; Goldy, 2026-10-30): each goalie is an
X-ray pinned to a light box, gear see-through in team colour with the skeleton showing through. The model sheet is
`STYLE.md`. On the site, `../goalie-types-panel.js` draws twelve compact cards; a card plays its loop on hover or focus.

## Files

| File | What it is |
|---|---|
| `goalie-skeleton.js` | The canon, the shared skeleton, one pose per archetype, and the flat `silhouette` style |
| `styles.js` | The styles library: every style tried, each a function from the posed parts to SVG. Light Box is `skeletons-xray`, with a light cut below 100 px and a `plain` mode for boards |
| `motion.js` | Three key poses per archetype and eased in-betweens for the 12 fps loop |
| `team-colours.json` | Team colours, saved with the source each was read from |
| `colour.js` | Contrast and colour-vision helpers for the audits |
| `audit-silhouettes.cjs` | Overlap of every pair at 32 px after a 1 px blur, plus bone-length drift (`audit/silhouettes.json`) |
| `audit-lightbox.cjs` | Light Box budgets on all 32 teams: contrast in every vision type, loop seams, framing, bone drift, size, frame time (`audit/lightbox.json`) |
| `audit-board.cjs` | The board: no overlap, clipping or sideways scroll at phone, tablet and desktop widths (`audit/board.json`) |
| `golden.cjs`, `golden/` | Reference pictures that lock the art: every archetype at every size in both themes, and every team. Fails on any change until rebuilt with `--update` |
| `build-previews.cjs` | Rebuilds the self-contained preview pages from their `.tpl.html` templates |
| `preview/lightbox.html` | The Light Box sheet: the set, every size in both themes, one team per row |
| `preview/lightbox-motion.html` | Every archetype's key poses and live loop |
| `preview/board.html` | Every goalie in plain mode, in rows by archetype, with name and stat plates |
| `preview/silhouettes.html`, `preview/styles.html` | The silhouette sheet and the style mockups from the earlier rounds |

Run the audits (they need Playwright with Chromium):

    NODE_PATH=$(npm root -g) node illustrations/audit-silhouettes.cjs
    NODE_PATH=$(npm root -g) node illustrations/audit-lightbox.cjs
    node illustrations/build-previews.cjs && NODE_PATH=$(npm root -g) node illustrations/audit-board.cjs

Check the art against the reference pictures, and rebuild them after a change made on purpose:

    NODE_PATH=$(npm root -g) node illustrations/golden.cjs
    NODE_PATH=$(npm root -g) node illustrations/golden.cjs --update

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

Neighbouring archetypes differ in shape, not in detail:

| Type | Shape |
|---|---|
| Streaky | Compact upright rectangle, symmetric |
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

## How we got here

- Styles round 1 to 3: Research Plate, Two-Ink Print, Stained Glass, Illuminated Plate, then Skeletons, Knights and High Fantasy, then two alternatives each to Skeletons (Light Box, Bold Bones) and Knights (Tournament, Gilded).
- Goldy first picked Knights: Gilded, then knights in medieval art styles (Tapestry was chosen), then goalie masks crossed with knight helms (2026-10-30). Those are retired and their code removed; the git history keeps them.
- Goldy then went back to Skeletons: Light Box (2026-10-30), drawn for every archetype and polished: a goalie cage on the skull, a haloed number, the film label at the foot, a light cut under 100 px, a gear outline darkened to 3:1 on the box, and a firm card edge.
- Steady became Streaky (the longest current win streak, 3+ wins), keeping its pose and loop. The section on the site is called Archetypes.
- The five-second picture test with readers was skipped at Goldy's request; the instrument audits all pass.
- The art is locked with reference pictures (`golden.cjs`), the brief's final step.
