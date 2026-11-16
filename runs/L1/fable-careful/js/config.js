// Every tunable number lives here. Units: pixels, seconds, pixels/second.
var CONFIG = {
  // --- display / loop ---
  viewWidth: 960,
  viewHeight: 540,
  logicHz: 60,            // fixed update rate
  maxFrameTime: 0.1,      // clamp for long frame gaps (tab switch etc.)

  // --- world ---
  tile: 32,
  fallDeathMargin: 96,    // how far below the level before the player dies

  // --- player body ---
  playerWidth: 22,
  playerHeight: 28,

  // --- horizontal movement ---
  runSpeed: 260,
  groundAccel: 2400,
  groundFriction: 2800,   // deceleration with no input on the ground
  groundTurnAccel: 4200,  // deceleration when pushing against current motion
  airAccel: 1500,
  airFriction: 500,
  airTurnAccel: 2000,

  // --- vertical movement ---
  gravity: 2000,
  fallGravityMultiplier: 1.25, // heavier on the way down = snappier arc
  maxFallSpeed: 900,           // terminal velocity (must stay < tile * logicHz)
  jumpVelocity: 720,
  jumpCutMultiplier: 0.45,     // applied to upward speed when jump is released early
  coyoteTime: 0.1,
  jumpBuffer: 0.1,
  dropThroughTime: 0.15,       // how long one-way platforms are ignored after Down+Jump

  // --- hazards / pickups ---
  spikeInset: 7,          // spike hitbox is narrower than the tile by this much per side
  spikeHeight: 14,        // spike hitbox height measured from the tile bottom
  coinRadius: 10,
  deathTime: 0.6,         // pause between dying and respawning
  deathFlashTime: 0.25,   // length of the white flash

  // --- camera ---
  cameraLerp: 7,          // higher = snappier follow
  lookAhead: 90,          // pixels the camera leads in the movement direction
  lookAheadLerp: 2.5,
  lookAheadMinSpeed: 40,  // speed needed before the look-ahead switches side

  // --- juice ---
  squashRecover: 12,
  jumpStretch: 0.22,
  landSquash: 0.28,
  hintDuration: 7,        // seconds the controls hint stays on screen
  hintFade: 1,

  // --- sound ---
  soundEnabled: true,
  soundVolume: 0.06,

  colors: {
    page: '#10131c',
    skyTop: '#4aa3df',
    skyBottom: '#c9ecff',
    sun: '#fff3b0',
    cloud: '#ffffff',
    hillFar: '#9ad0c2',
    hillNear: '#6fb98f',
    dirt: '#8a5a3c',
    dirtDark: '#6e452d',
    dirtLight: '#a06c48',
    grass: '#4caf50',
    grassLight: '#7ed957',
    grassDark: '#2e7d32',
    wood: '#c98b4a',
    woodLight: '#e8b877',
    woodDark: '#8a5a2b',
    spike: '#d7dde5',
    spikeDark: '#8792a2',
    spikeBase: '#5a6372',
    coin: '#ffd23f',
    coinLight: '#fff3a8',
    coinDark: '#c9971c',
    player: '#e8503a',
    playerDark: '#b53a28',
    playerBand: '#ffe9a8',
    playerEye: '#ffffff',
    playerPupil: '#1b1b28',
    playerFeet: '#3b2a2a',
    flagPole: '#e9eef5',
    flag: '#ff4d6d',
    flagDark: '#c9304f',
    checkpointOff: '#9aa3b1',
    checkpointOn: '#4be07a',
    dust: '#f1e9d8',
    deathParticle: '#e8503a',
    flash: '#ffffff',
    hudText: '#ffffff',
    hudShadow: 'rgba(0,0,0,0.6)',
    hudPanel: 'rgba(16,19,28,0.55)',
    overlay: 'rgba(12,16,28,0.72)',
    accent: '#ffd23f'
  }
};
