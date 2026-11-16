// WICKFALL - all tunables live here.
var CFG = {
  W: 960, H: 540, TILE: 48,
  STEP: 1 / 60,
  MAX_FRAME: 0.1,
  TITLE: 'WICKFALL',
  AREA_NAME: 'The Unlit Vale',

  player: {
    w: 22, h: 38,
    runSpeed: 290, accel: 2600, airAccel: 1900, friction: 2600,
    gravity: 2200, maxFall: 900,
    jumpVel: 760, jumpCut: 0.45, coyote: 0.1, jumpBuffer: 0.12,
    dashSpeed: 640, dashTime: 0.17, dashCooldown: 0.42,
    wallSlideSpeed: 130, wallJumpX: 330, wallJumpY: 700, wallJumpLock: 0.2,
    maxHealth: 5, invuln: 1.0, knockX: 300, knockY: 380, hurtLock: 0.25,
    maxEnergy: 99, energyPerHit: 11,
    healCost: 33, healTime: 1.0,
    boltCost: 33, boltSpeed: 900, boltDamage: 15, boltLife: 0.9,
    slashDamage: 10, slashActive: 0.12, slashShow: 0.2, slashCooldown: 0.3,
    slashReach: 64, slashRecoil: 170, pogoVel: 640,
    attackBuffer: 0.1
  },

  crawler: { w: 40, h: 26, hp: 20, speed: 55, lungeSpeed: 280, lungeRange: 175, lungeTell: 0.42, lungeTime: 0.42, lungeCooldown: 1.3, gravity: 2000 },
  grub:    { w: 34, h: 22, hp: 20, speed: 30 },
  flyer:   { w: 34, h: 28, hp: 20, aggro: 350, tell: 0.5, swoopSpeed: 540, cooldown: 1.2, hoverSpeed: 95 },
  spitter: { w: 36, h: 38, hp: 30, range: 540, tell: 0.6, cooldown: 1.7, flight: 1.1, gravity: 900, shotRadius: 10 },
  enemy:   { flash: 0.12, knock: 220, spawnTime: 0.7, hitstop: 0.06 },

  boss: {
    name: 'VESPERHORN',
    title: 'Warden of the Unlit Hour',
    w: 120, h: 110, chargeH: 92,
    hp: 460, phase2: 0.66, phase3: 0.33,
    staggerHits: 9, staggerTime: 1.7,
    idle: [0.95, 0.7, 0.5],          // pause between attacks, per phase
    speedMul: [1, 1.12, 1.25],        // movement speed per phase
    tellMul: [1, 0.9, 0.8],           // wind-up length per phase
    walkSpeed: 70, gravity: 2000,
    introTime: 2.6, roarTime: 1.9, deathTime: 2.6,
    charge: { tell: 0.62, speed: 640, recover: 0.75, retell: 0.45 },
    leap:   { tell: 0.52, gravity: 1800, flight: 0.85, recover: 0.6, waveSpeed: 390, waveLife: 1.5, waveH: 34, waveW: 30 },
    volley: { tell: 0.58, count: [3, 5, 7], gap: 0.13, recover: 0.7, gravity: 800, radius: 11 },
    dive:   { tell: 0.5, riseSpeed: 1500, track: 0.9, lock: 0.5, speed: 1500, recover: 1.0 },
    summon: { tell: 0.7, count: 2, recover: 0.5 },
    shards: { tell: 0.7, cols: 10, safe: 2, salvos: 2, salvoGap: 1.05, speed: 950, recover: 0.6, w: 26, h: 70 }
  },

  camera: { lerp: 0.1, lookAhead: 90, lookLerp: 0.04 },

  juice: {
    hitstopHit: 0.06, hitstopHurt: 0.085,
    shakeHit: 5, shakeHurt: 11, shakeBig: 20
  },

  light: { ambient: 0.74, player: 190, lantern: 230, crystal: 120, rest: 260 },

  colors: {
    gold:   [255, 214, 130],
    cyan:   [150, 235, 255],
    violet: [185, 135, 255],
    red:    [255, 95, 130],
    green:  [190, 255, 140],
    white:  [255, 255, 255],
    bone:   '#e9e3d0',
    skyTop: '#04060f', skyMid: '#0a1830', skyLow: '#11384a',
    rock: '#0b1826', rockDeep: '#060d16', moss: '#1c5a62', mossLight: '#3fa39a',
    cloak: '#2a566e', cloakDark: '#0f2434', scarf: '#eab95c',
    phase: [[255, 214, 130], [185, 135, 255], [255, 95, 130]]
  }
};
