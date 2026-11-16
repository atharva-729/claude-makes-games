# Results

Scoring (filled in after playing each game yourself):
- **Runs first try:** loads with no console errors and is playable, with no follow-up prompt.
- **Fix prompts:** number of follow-up prompts needed to get it working.
- **Feel (1-10):** your own rating after playing: jump feel, collisions, controls.
- **Model self-rating:** what the model rated itself, to compare with yours.
- **Spec coverage:** careful runs only: how much of the spec was actually done.

## L1: basic platformer

| Cell | Stack | Runs first try | Fix prompts | Feel (you) | Model self-rating | Spec coverage | Notes |
|------|-------|----------------|-------------|------------|-------------------|---------------|-------|
| opus-generic  | Canvas + vanilla JS + WebAudio, one ~1600-line file | Yes (played) | 0 | 8-8.5 | 7 | n/a | "Pip's Leap". Went furthest of all: 4 themed levels, wall-jump and wall-slide, enemies, lava, springs, moving platforms, gamepad support, unlockable levels, a rank screen. Test modes are built into the URL (`?test=1`: 29 checks pass; `?solve=N`, `?map=N`). Best character art so far. Everything is in one file. ~22 min, the slowest run. |
| opus-careful  | Canvas + vanilla JS, ~1100 lines | Yes (played) | 0 | 6.5 | 7 | Nearly full by its own account; adds checkpoints, tutorial signs, best time, corner correction | "Pip's Dash". 7 screens, 44 coins, 2 checkpoints, a room you reach by dropping through. Search bot on the real physics reached the flag; 27 physics checks; tested the title→pause→complete→restart flow with synthetic key events. No audio. On the title screen the controls hint overlaps a sign. ~12 min. |
| fable-generic | Canvas + vanilla JS + WebAudio, one ~970-line file | Yes (played) | 0 | 8.5 | 7 | n/a | "Ember Hop". Went well past L1 on its own: 3 themed levels, walking and flying enemies, stomping, springs, moving platforms, checkpoints, music and sound, best times. Its search script says every level can be finished and every coin reached. Best-looking title screen so far. Everything is in one file, so art is not separate. Left `_test.html` and debug URL hashes. ~12.5 min. |
| fable-careful | Canvas + vanilla JS, ~1000 lines | Yes (played) | 0 | 5 | 7 | Nearly full by its own account; adds checkpoints + sounds | "Sky Hop". 7 screens, 53 coins, 3 checkpoints. Wrote a route planner on the real physics to show the level can be finished. ~8 min. Left an unused `Game` test hook in game.js. |

### Observations
- All 4 runs loaded with no console errors and needed no fix prompts. A basic platformer is a solved problem for both models.
- All 4 picked plain canvas JS and wrote their own bots or tests on the real physics, without being told to, to show the levels can be finished.
- **The generic prompt produced bigger games**: 3-4 levels, enemies, springs and moving platforms, and Opus added wall-jumps. That already covers L2 and part of L3.
- **The careful prompt produced better-organised code**: config, level, art and logic in separate files, art drawing kept in one place. The generic runs each put everything in one file. That matters for the goal of swapping in new assets later.
- Every model rated itself 7/10, so their self-ratings tell us little. Human play-testing is the real measure.
- Time: fable-careful ~8 min, opus-careful ~12, fable-generic ~12.5, opus-generic ~22.

### Play-test notes (human)
Scores compare these four games with each other. They are not absolute: a game made with more effort could score far higher.

- **fable-careful (5):** one level, no music, easy, nothing unusual. A decent time-killer, like Chrome's dinosaur game, but not impressive.
- **fable-generic (8.5):** the best-looking one. Smooth, well-drawn characters (not pixel art), fun music, lots of animation: a dust cloud when you jump, the character breaks into pixels when you die. Several levels with different designs. Movement is standard platformer, nothing new.
- **opus-careful (6.5):** pixel art, more animation than fable-careful, no sound. Plays the same as the other careful run.
- **opus-generic (8-8.5):** the most mechanics. The wall-jump is the standout and appeared in no other run. 4 levels, good music. Pixel art that looks less good than fable-generic. You can see it took the longest.

### Takeaways
- **Generic beat careful (8-8.5 vs 5-6.5), but the careful spec was the reason.** It asked for one level and focused on engineering (code layout, collision rules, timestep). It never asked for music, animation, extra levels or new mechanics, so neither model added them. The generic prompt left room for the models to make it fun.
- **Lesson for future careful prompts:** describe the experience (music, animation, variety, a signature mechanic, number of levels), not only the engineering. A good spec should make the game better, not just smaller.
- **Fable vs Opus:** Fable was stronger on looks and polish; Opus was stronger on mechanics and scope. Overall about equal.

## A1: dark action-platformer with a boss ([spec](prompts/A1-careful.md))

A much harder test: sword combat, dash, wall-jump, pogo, healing and energy, 3 enemy types, a secret, and a 3-phase boss. The spec describes the experience, not just the engineering, which was the lesson from L1. Fable only, careful prompt only, because of limited usage.

| Cell | Stack | Runs first try | Fix prompts | Feel (you) | Model self-rating | Spec coverage | Notes |
|------|-------|----------------|-------------|------------|-------------------|---------------|-------|
| fable-careful | Canvas + vanilla JS + WebAudio, ~2,540 lines in 9 files | Loads clean (check.py); play-test pending | 0 | | 7 | Nearly full by its own account | "WICKFALL: a night in The Unlit Vale". Boss "Vesperhorn, Warden of the Unlit Hour": 3 phases, 6 attacks, staggers after 9 hits, rain and lightning in phase 3. Added a second rest point. Level is ~7.5x2.7 screens, just under the 8-12 target. Boss balance is untested: its test ran with invulnerability on. ~28 min, ~197k tokens. Debug keys: F1 invulnerability, F2 teleport to boss. |
