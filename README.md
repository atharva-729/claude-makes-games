# claude-makes-games

Experiments in how far AI coding models can get at building games on their own.

**▶ Play them in your browser: https://atharva-729.github.io/claude-makes-games/**

## Setup
Each **level** of the ladder is a harder game. Each level runs as a small grid:

|            | generic prompt | careful prompt |
|------------|----------------|----------------|
| Opus 5.5   | `runs/Lx/opus-generic` | `runs/Lx/opus-careful` |
| Fable 5.2  | `runs/Lx/fable-generic` | `runs/Lx/fable-careful` |

- **Generic prompt:** one line (e.g. "Make a 2D platformer game.").
- **Careful prompt:** a detailed spec covering tech, code layout, game feel and rules.
- Every run gets the same instructions from [prompts/_harness.md](prompts/_harness.md): browser-only, no build step, plus a smoke-test tool.
- Each run is a fresh agent that sees only its prompt, not the other runs.

## Ladder
| Level | Game | Status |
|-------|------|--------|
| L1 | Basic platformer: run, jump, collisions, one level | done |
| L2 | + enemies, collectibles, moving platforms, death/respawn | todo |
| L3 | + wall-jump, dash, physics puzzles | todo |
| L4 | Multiple / procedurally generated levels | todo |
| L5 | Multiplayer | todo |
| A1 | Dark action-platformer demo: sword combat, dash, wall-jump, healing, enemies, 3-phase boss ([spec](prompts/A1-careful.md)) | done (Fable, careful) |

## Running a game
Open `runs/<level>/<cell>/index.html` in a browser.

Smoke test (headless Chrome screenshot + console errors):
```
python tools/check.py runs/L1/opus-careful
```

## Results
See [results.md](results.md).
