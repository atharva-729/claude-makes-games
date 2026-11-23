// GLOAMREACH - all tunable numbers live here.
var CFG = {
  W: 960,
  H: 540,
  TILE: 32,
  DT: 1 / 60,
  MAX_FRAME: 0.25,          // clamp for large frame gaps (seconds)

  player: {
    w: 22, h: 42,
    runSpeed: 300,
    accelGround: 3400, decelGround: 4200,
    accelAir: 2400, decelAir: 1500,
    gravity: 2000, fallMult: 1.18, maxFall: 920,
    jumpVel: 720, jumpCut: 0.42,
    coyote: 0.10, jumpBuffer: 0.13,
    dashSpeed: 820, dashTime: 0.16, dashCooldown: 0.42,
    wallSlideSpeed: 130, wallJumpVx: 330, wallJumpVy: 690, wallJumpLock: 0.15,
    maxHp: 5,
    invuln: 1.0,
    knockbackX: 330, knockbackY: -400, hurtStun: 0.22,
    slashCooldown: 0.30, slashActive: 0.11,
    slashReachFwd: 62, slashReachUp: 64, slashReachDown: 58,
    slashDamage: 1,
    pogoVel: 660,
    hitRecoil: 220,
    energyMax: 99, energyPerHit: 11,
    healCost: 33, healTime: 1.0,
    boltCost: 33, boltSpeed: 940, boltDamage: 3, boltCooldown: 0.4,
    lightRadius: 190
  },

  hitStop: { hit: 0.06, hurt: 0.08, bossHit: 0.05, kill: 0.07 },

  enemies: {
    crawler:  { w: 34, h: 24, hp: 3, speed: 55, energy: true },
    flyer:    { w: 30, h: 26, hp: 3, aggro: 300, windup: 0.5, swoopSpeed: 440, swoopTime: 0.7, recover: 0.9, cooldown: 1.2 },
    wisp:     { w: 22, h: 20, hp: 2, aggro: 900, windup: 0.5, swoopSpeed: 400, swoopTime: 0.6, recover: 1.0, cooldown: 1.4 },
    spitter:  { w: 32, h: 40, hp: 4, range: 470, windup: 0.6, cooldown: 2.1 },
    spit:     { r: 9, gravity: 620, speedMin: 0.85, speedMax: 1.5 },
    knockback: 260,
    flash: 0.1
  },

  boss: {
    name: 'OSSIVETH',
    title: 'The Lantern-Glutton',
    hp: 50,
    w: 104, h: 118,
    phase2At: 2 / 3, phase3At: 1 / 3,
    staggerHits: [9, 10, 11],
    staggerTime: 1.9,
    idleGap: [0.95, 0.7, 0.5],
    walkSpeed: [70, 95, 120],
    // wind-up times per phase (seconds) - all within 0.4-0.7
    windCharge: [0.65, 0.55, 0.48],
    windLeap:   [0.6, 0.52, 0.45],
    windVolley: [0.65, 0.58, 0.5],
    windDive:   [0.6, 0.55, 0.5],
    windSummon: [0.6, 0.55, 0.5],
    chargeSpeed: [500, 590, 680],
    leapTime: [0.8, 0.72, 0.64],
    waveSpeed: [330, 380, 430],
    volleyCount: [3, 4, 5],
    diveLock: 0.55,
    diveTrack: [0.9, 0.75, 0.65],
    diveFallSpeed: 1500,
    hazardEvery: 2.6, hazardWarn: 0.7,
    roarTime: 1.7,
    contactDamage: 1,
    bigDamage: 2          // phase-3 dive slam
  },

  colors: {
    skyTop: '#03060f', skyMid: '#0a1830', skyLow: '#12324a',
    farLayer: '#0b1a2c', midLayer: '#081320', rock: '#060b14', rockEdge: '#173246',
    backWall: '#0a1422', moss: '#1f5a57', mossLight: '#4fb3a4',
    cyan: '#bff6ff', gold: '#ffd27a', violet: '#b48cff', danger: '#ff4d6d',
    darkness: 'rgba(2,5,14,', darkBase: 0.84
  }
};
