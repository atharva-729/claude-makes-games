Build a short, difficult 2D action-platformer demo: one atmospheric night-time area full of enemies, ending in a multi-phase boss fight. Think of the genre of challenging, hand-crafted action-platformers with melee combat and boss fights, but make everything original: the name, world, characters, enemies, boss and art are yours. Do not copy or reference any existing game.

The goal is a demo that feels like a real game: tight combat, readable but punishing enemies, a memorable boss, a strong mood. Polish and feel matter as much as features.

## Tech
- Plain HTML5 canvas + vanilla JavaScript. No libraries, no frameworks, no image or audio files: all art is drawn in code and all audio is made with WebAudio.
- Classic `<script>` tags only (no ES modules), so it works when `index.html` is opened straight from disk.
- Fixed-timestep logic (60 Hz) with an accumulator, rendering via `requestAnimationFrame`. Clamp large frame gaps.
- Canvas 960x540 logical pixels, scaled to fit the window with aspect ratio kept.

## Code layout (keep art and audio swappable)
- `index.html`: canvas and script tags only.
- `js/config.js`: all tunables (player physics, combat numbers, enemy and boss stats, timings, colors).
- `js/level.js`: the area as an ASCII tile map plus a list of entity placements (enemies, rest point, secret, boss gate).
- `js/assets.js`: **all** drawing (player, enemies, boss, tiles, background, effects, UI) behind small functions like `drawPlayer(ctx, p)`. Replacing the art later should only touch this file.
- `js/audio.js`: all music and sound effects.
- `js/player.js`, `js/enemies.js`, `js/boss.js`: entity logic.
- `js/game.js`: input, camera, collisions, game states, HUD, main loop.

## Look and mood: night
- Smooth, illustrated vector-style art drawn with canvas paths and gradients, **not pixel art**.
- A dark palette of deep blues, teals and near-black, with glowing accents (pale cyan, soft gold, eerie violet).
- At least 3 parallax background layers (distant silhouettes, mid-ground structures, foreground fog).
- Lighting: a soft radial glow around the player, glowing objects (lanterns, crystals, the rest point) that light their surroundings, and darkness elsewhere.
- Ambient particles: drifting spores, fireflies or embers, plus low fog.
- The player character, every enemy and the boss should each have a distinct, readable silhouette and simple animations (idle, move, attack wind-up, hurt, death).

## Player moveset
- Run with acceleration, variable-height jump, coyote time, jump buffer.
- **Dash:** a short burst on the ground or in the air, with a cooldown. One air dash per airtime. Leaves afterimages.
- **Wall slide and wall jump.**
- **Melee slash:** forward, upward (hold Up) and downward (hold Down in the air). A downward slash that hits an enemy, a projectile or spikes bounces the player up (pogo). Slashes have a short recovery and push the player back slightly on hit.
- **Health:** 5 health points shown as glowing icons. Taking damage gives 1 s of invulnerability (flicker) and knockback.
- **Energy:** a meter filled by landing hits on enemies. Spend it to:
  - heal 1 health point by holding the heal key for about 1 s while standing still (you can be interrupted, and you are vulnerable while healing);
  - fire an energy bolt, a fast horizontal projectile.

## Enemies (at least 3 types, each with a clear tell)
- **Crawler:** patrols platforms and turns at edges. Contact damage.
- **Flyer:** hovers, then telegraphs and swoops at the player.
- **Spitter:** stationary, telegraphs, then lobs slow projectiles in an arc. A downward slash can pogo off the projectiles.
- All enemies flash white when hit, get knocked back, burst into particles on death and give energy.

## The area (one level, about 8-12 screens, horizontal and vertical)
The camera follows on both axes. In order:
1. A quiet opening with the title card fading in. Teaches running, jumping and slashing on a harmless crawler.
2. A gap that needs a dash, then a vertical shaft that needs wall jumps.
3. A spike corridor that needs pogo slashes off spikes or enemies.
4. Mixed enemy encounters, including at least one tight arena-style fight.
5. A **rest point**. Resting refills health, sets the respawn point and plays a calm sound.
6. A hidden **secret**: a breakable wall (slash it) leading to a small room with a +1 max health upgrade.
7. The **boss arena**: the gate shuts behind the player, the music changes and the boss's name appears.

## Boss (the centerpiece)
- An original, large, memorable creature with a name and a title shown on its health bar.
- **3 phases**, at 100%, 66% and 33% health. Each phase adds attacks and speeds up.
- **At least 5 distinct attacks** across the fight, for example: ground charge, leaping slam with shockwaves, projectile volley, diving aerial strike, summoned minions or an arena hazard.
- **Every attack is telegraphed** with a clear wind-up pose plus a sound, lasting roughly 0.4-0.7 s. The fight should be hard but fair: learnable patterns, no unavoidable damage.
- After a certain number of hits the boss staggers briefly (a punish window).
- **Phase transitions** are a moment: the boss roars, the screen shakes, and the arena changes (lights dim, spikes appear, rain starts, or similar).
- **Death** is a moment too: slow motion, a big particle burst, a short silence, then a victory screen showing time and deaths.
- **Difficulty target:** a competent player should die to the boss a few times before winning. Contact and attacks deal 1 damage each (2 for the biggest attack in phase 3).

## Feel and polish ("juice")
- Hit-stop (50-80 ms) on every successful hit and when the player takes damage.
- Screen shake scaled to impact. Camera lerp with look-ahead.
- Particles for slashes, hits, dashes, landings and deaths. A red vignette pulse when hurt.
- Dying respawns the player at the last rest point with full health. Enemies reset; the boss resets to full.

## Audio (WebAudio, generated in code)
- Ambient night music for exploring: slow pads and a sparse melody, moody.
- More intense boss music that gets more intense again in phase 3.
- Sound effects: slash, hit, enemy death, player hurt, jump, dash, heal, energy bolt, rest point, boss wind-ups, boss roar.
- Audio starts on the first key press. M toggles mute.

## Controls
- Move and aim: Arrow keys or WASD (Up/Down aim the slash).
- Jump: Space or Z. Attack: X or J. Dash: C, K or Shift. Energy bolt: V or L. Heal: hold F.
- Pause: Esc or P. Restart from the rest point: R.
- Show the controls on the title screen and in the pause menu.
- Debug keys for testing: F1 toggles invulnerability, F2 teleports to the boss gate. Don't show these in game, but list them in your final report.

## Screens
Title screen ("Press Enter to begin"), pause menu, death fade-out and respawn, victory screen.

## Testing budget
Tokens are limited, so put most of your effort into building the game. Keep verification proportionate:
- run `tools/check.py`;
- a few quick in-page checks of core systems (player movement and collision, slash hits, boss phase changes);
- look at a handful of screenshots.

Do **not** build a full automated level solver.

## Done means
- Opening `index.html` shows the title screen, and you can play from the opening through the area to the boss and beat it.
- No errors in the browser console.
