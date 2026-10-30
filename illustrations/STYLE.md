# Model sheet: Tapestry

The chosen style for the goalie-type illustrations (Goldy, 2026-10-29), after Gilded Knights (Step 4 round 1) and
four medieval art options (round 2). The code is `tapestry()` in `medieval.js`; the colour rules are `tapTokens()`
there; the checks are `check-colours.cjs` (results in `audit/colours.json`, key `tapestry`); the sheet is
`preview/tapestry.html`.

## Conceit and tone

**Conceit:** each goalie is stitched into the Bayeux Tapestry: a knight of the crease in wool on linen, with a
Latin caption over the scene.

**Tone:** proud and a little playful, like a team banner. It honours the type without mocking the player
(Rex Nihili, "king of nothing", is a compliment to a shutout leader).

## Captions

| Type | Caption | Meaning |
|---|---|---|
| Streaky | VINCIT ITERVM | He wins again |
| Workhorse | HIC LABORAT | Here he labours |
| High-Danger Stopper | PERICVLVM VINCIT | He conquers danger |
| The Wall | MVRVS | The wall |
| Rebound Controller | HIC PVCK TENET | Here he holds the puck |
| Under Siege | OBSESSVS | Besieged |
| Crease Battler | IN TVRBA PVGNAT | He fights in the crowd |
| Standout | EGREGIVS | The outstanding one |
| Donut King | REX NIHILI | King of nothing |
| Grandpa | SENEX | The old man |
| Young Gun | IVVENIS | The youth |
| Style King | REX ELEGANTIAE | King of style |

## Proportions

Frame 100 × 100 units. The skeleton, bone lengths and poses are unchanged (`goalie-skeleton.js`): a pose is joint
angles, never free points. `figure()` in `medieval.js` draws over those joints with smooth, tapered parts.

| Part | Units |
|---|---|
| Helm | 1.2 × the skeleton head (13 wide), on the neck; cage in the face, dangler below |
| Torso | breastplate 16 at the hips to 21 at the shoulders; tabard 14 wide with a pointed hem |
| Arm | 8 at the shoulder, 7 at the elbow, 6.5 at the wrist; floaters 10.6 × 8.8, elbow cops 6.8 × 5.6 |
| Leg pad | 12.5 at the knee stack, 13.5 mid-pad, 11 at the boot |
| Catcher | 14.4 × 12.6 with a 6.8 × 4.8 thumb; cuff 9 wide |
| Kite shield | 13 wide, 15 long, square to the forearm |
| Crest | up to 12 above the helm |
| Caption | Cinzel 600 at 5.6, centred at y = 17.5; the figure stays below y = 21 |

**Turnaround:** front view only, by design. Every surface shows the goalie facing the reader.

## Tokens

| Token | Value | Rule |
|---|---|---|
| Linen | `#EADFC4` with a fine weave | The ground |
| Thread | `#3A3550` | Every outline, as a stitched dash (1.6 on, 0.7 off) at 1.1 |
| Cream | `#F2EBD8` | Net, tape, cage bars, light number |
| Armour | ochre `#C9962E` / `#94681E` | Two wools: the darker on the shaded side, as the tapestry does it |
| Steel | `#8E98AA` / `#5E6679` | Armour for gold sweaters (Nashville, Vegas), so the tabard shows |
| Tabard | team | The sweater colour; black is dyed dark indigo `#2E2A3A` |
| Crest | team | The trim if it reaches 3:1 on linen in every kind of vision, else the sweater colour, else thread |
| Number | cream or thread | Cinzel 600 at 8, cream with a thread edge; thread with a cream edge where cream is under 3:1 |
| Straps, sabatons | rust `#9E4A3A`, sage `#7E8F5A` | Fixed |
| Couching | 16% dark laid lines, 22% light ties | Over every armour, tabard, shield and catcher fill |
| Borders | `#E2D3B0` bands, stitched diagonals, four roundels | Top and bottom |

All 32 teams pass every pair in all four kinds of vision (`node illustrations/check-colours.cjs`).

## Two cuts

Full cut at 100 px and over (the 240 px detail card): stitched outlines, couching, gear seams and the caption.
Light cut below 100 px (leaderboard 32, profile 64, carousel 76): solid outlines, no couching, seams or caption.
Shapes, colours and crest are the same in both. Compressed, the full cut is 3.5 KB at most and the light cut
2.8 KB (raw 16 KB and 10 KB).

## Crests (the marks)

Unchanged from Gilded: one heraldic figure per team after its nickname (`CRESTS` in `gilded.js`), never a logo.
A formal trademark search has not been done and should be before launch.

## Don'ts

- No real team logo, wordmark or mask design, and no real player's face.
- No crest or prop that only shows by hue; it needs 3:1 on the linen.
- No gold sweater on ochre armour.
- No full cut below 100 px: the stitched dashes blur at small sizes.
- No type told apart by colour alone; types differ by shape.
- No new pose drawn as free points; add joint angles to `POSES` in `goalie-skeleton.js`.
