// Every tunable number lives here. Units: pixels, seconds, pixels/second, pixels/second^2.
window.CONFIG = {
  // Logical canvas size (scaled to fit the window, aspect ratio preserved).
  view: { width: 960, height: 540 },
  tileSize: 32,

  // Fixed-timestep simulation.
  physicsHz: 60,
  maxFrameTime: 0.1, // longer frame gaps (tab switch, hitch) are clamped to this

  // Player body (collision box).
  player: { width: 22, height: 28 },

  // Vertical movement.
  gravity: 2000,
  fallGravityMultiplier: 1.2, // a bit heavier on the way down: snappier arcs
  maxFallSpeed: 900, // terminal velocity (must stay below tileSize * physicsHz)
  jumpVelocity: 700, // ~3.8 tiles high with jump held
  jumpCutMultiplier: 0.45, // upward speed kept when jump is released early

  // Horizontal movement.
  runSpeed: 260,
  groundAccel: 2400,
  groundDecel: 2800, // friction when no direction is held
  groundTurnAccel: 4200, // pushing against current velocity on the ground
  airAccel: 1500, // less control in the air
  airDecel: 450,
  airTurnAccel: 1900,

  // Forgiveness.
  coyoteTime: 0.1, // can still jump this long after walking off a ledge
  jumpBufferTime: 0.1, // jump pressed this long before landing still counts
  dropThroughTime: 0.2, // one-way platforms are ignored this long after Down+Jump
  cornerCorrection: 6, // head clipping a ceiling corner by <= this many px slides around it

  // Hazards.
  spikeInsetX: 5, // spike hitbox is narrower than the tile...
  spikeInsetTop: 15, // ...and only covers the lower part of it
  fallDeathMargin: 64, // dying this far below the bottom of the level
  deathDuration: 0.75, // pause before respawn
  deathFlashTime: 0.3, // white screen flash on death fades over this long

  // Pickups / goal.
  coinRadius: 10,

  // Camera.
  camera: {
    followRate: 7, // higher = snappier horizontal follow (exponential lerp rate)
    lookAhead: 90, // px ahead of the player in the direction of movement
    lookAheadRate: 2.5,
    verticalRate: 5,
    verticalAnchor: 0.58 // player sits at this fraction of the screen height
  },

  // UI timing.
  hintDuration: 7, // controls hint stays this long after starting
  hintFade: 1,

  // Juice.
  squashRecoverRate: 14,
  landDustSpeed: 350, // landing faster than this kicks up dust

  colors: {
    background: '#0b0d17',
    skyTop: '#3a6ea5',
    skyBottom: '#9ad1e8',
    mountains: '#6f8fb8',
    mountainsShade: '#5f7ea6',
    hills: '#4f9a6a',
    hillsShade: '#43875c',
    cloud: '#eef6fb',
    dirt: '#8a5a3b',
    dirtDark: '#6e4429',
    dirtLight: '#a06c48',
    grass: '#5cc04f',
    grassDark: '#3e9a3a',
    grassLight: '#8ee36f',
    plank: '#c98f4e',
    plankDark: '#8e5a2b',
    plankLight: '#e8b475',
    spike: '#d7dde6',
    spikeShade: '#8b95a5',
    spikeTip: '#ffffff',
    coin: '#ffd23f',
    coinDark: '#c7901a',
    coinShine: '#fff6c2',
    player: '#ff6b5a',
    playerDark: '#c9433a',
    playerLight: '#ff9b8a',
    eye: '#ffffff',
    pupil: '#1a1a2e',
    feet: '#3b2a4a',
    flagPole: '#e9eef5',
    flagCloth: '#ffd23f',
    flagClothDark: '#e0a91c',
    flagBase: '#56607a',
    checkpointOff: '#c9433a',
    checkpointOn: '#4fe07a',
    signWood: '#b07a45',
    signWoodDark: '#7a4f28',
    signText: '#fff4dc',
    hudText: '#ffffff',
    hudShadow: '#1a1a2e',
    hudPanel: 'rgba(16, 18, 34, 0.55)',
    overlay: 'rgba(10, 12, 26, 0.72)',
    accent: '#ffd23f',
    deathFlash: '#ffffff',
    dust: '#e8dcc8'
  }
};
