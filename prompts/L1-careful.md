Build a 2D side-scrolling platformer with one complete level.

## Tech
- Plain HTML5 canvas + vanilla JavaScript. No libraries, no frameworks.
- Classic `<script>` tags only (no ES modules), so it works when `index.html` is opened straight from disk.
- Fixed-timestep update loop (60 Hz logic) decoupled from rendering via `requestAnimationFrame`, with an accumulator. Clamp large frame gaps (e.g. tab switching) so the player can't tunnel.
- Canvas is 960x540 logical pixels, scaled to fit the window while keeping the aspect ratio. Pixel-art friendly (no smoothing).

## Code layout
- `index.html`: canvas and script tags only.
- `js/config.js`: every tunable number in one object (gravity, run speed, acceleration, friction, jump velocity, coyote time, jump buffer, tile size, colors).
- `js/level.js`: the level as an array of strings (ASCII tile map). Legend:
  `#` solid ground, `=` one-way platform (solid only from above), `^` spikes, `o` coin, `P` player start, `F` goal flag, `.` empty.
- `js/assets.js`: all drawing for each entity type lives here, behind a small interface (e.g. `drawPlayer(ctx, player)`, `drawTile(ctx, type, x, y)`). It draws simple shapes now, but should be written so that swapping in sprite images later only touches this file.
- `js/game.js`: input, physics, collisions, camera, game state, HUD.

## Player feel (this matters most)
- Horizontal acceleration and deceleration, not instant velocity. Less control in the air than on the ground.
- Variable jump height: releasing jump early cuts upward velocity.
- Coyote time (about 0.1 s) and jump buffering (about 0.1 s).
- Terminal fall speed.
- Collision: axis-separated AABB against tiles. Resolve X, then Y. No getting stuck in walls, no jitter when standing, no snagging on tile seams while running along the floor.
- One-way platforms: can jump up through them and land on top. Press Down + Jump to drop through.

## Level and game rules
- One level, roughly 6-8 screens wide, that teaches: running, a simple jump, a gap, one-way platforms, spikes, a section that needs a well-timed jump, then the flag.
- Camera follows the player smoothly (lerp) with a small look-ahead in the direction of movement, clamped to level bounds.
- Touching spikes or falling below the level means death: short flash, then respawn at the start (or at the most recent checkpoint if you add one).
- Coins can be collected; the HUD shows coins collected / total, deaths, and elapsed time.
- Reaching the flag shows a "Level complete" screen with time, coins and deaths, plus "Press R to play again".

## Controls
- Left/Right: Arrow keys or A/D. Jump: Space, Up or W. Down: Down or S. Restart: R. Pause: P or Esc.
- Show a short controls hint on screen for the first few seconds.

## Done means
- Opening `index.html` starts a game with a title screen ("Press Enter or Space to start").
- No errors in the browser console.
- You can finish the level from start to flag.
