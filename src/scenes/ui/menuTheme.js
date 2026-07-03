// src/scenes/ui/menuTheme.js
// Shared visual language for the menu scenes. The App Select hub is a calm
// engineering "lab"; each app tile carries a slice of its own world. Bridge
// Builder's own screens use its bright in-game world (sky + water). Rocket and
// Farm are shown as "in construction" until their games exist.

export const FONT_DISPLAY = 'Fredoka';
export const FONT_BODY = 'Nunito';

export const T = {
  bgDeep: 0x0e1f3c,
  bgTop:  0x21508c,
  grid:   0x3a72b8,
  accent: 0x36e0d8,
  lock:   0x3a4a66,
  textHi:   '#f2f7ff',
  textMute: '#a9c0e0',
  onBrick:     '#13233b',
  onBrickSoft: '#33405c',
  faces: { sky: 0x3fa9f5, violet: 0x9b7bff, amber: 0xffb23e },
  phase: { tutorial: 0x3fd07a, topic: 0x3fa9f5, challenge: 0x9b7bff },
};

export const PHASE_LABEL = { tutorial: 'PLAY', topic: 'DISCOVER', challenge: 'PROVE IT' };

const RADIUS = 18;
const BEVEL = 10;

export function shade(hex, f) {
  const r = Math.round(((hex >> 16) & 255) * f);
  const g = Math.round(((hex >> 8) & 255) * f);
  const b = Math.round((hex & 255) * f);
  return (r << 16) | (g << 8) | b;
}

const hex = (n) => '#' + (n >>> 0).toString(16).padStart(6, '0').slice(-6);

// App Select hub: a richer engineering-lab backdrop — vertical gradient, a soft
// light pool behind the content, faint blueprint grid, and edge darkening.
export function drawHub(scene) {
  const W = scene.scale.width, H = scene.scale.height;
  scene.cameras.main.setBackgroundColor(hex(T.bgDeep));
  const g = scene.add.graphics().setDepth(-100);
  g.fillGradientStyle(T.bgTop, T.bgTop, T.bgDeep, T.bgDeep, 1);
  g.fillRect(0, 0, W, H);
  // Soft light pool behind the title/tiles for depth.
  scene.add.ellipse(W / 2, H * 0.46, W * 0.92, H * 0.7, 0x3f7fc0, 0.16).setDepth(-99);
  // Faint technical grid.
  const grid = scene.add.graphics().setDepth(-98);
  grid.lineStyle(1, T.grid, 0.08);
  for (let x = 0; x <= W; x += 40) grid.lineBetween(x, 0, x, H);
  for (let y = 0; y <= H; y += 40) grid.lineBetween(0, y, W, y);
  grid.lineStyle(1, T.grid, 0.16);
  for (let x = 0; x <= W; x += 200) grid.lineBetween(x, 0, x, H);
  for (let y = 0; y <= H; y += 200) grid.lineBetween(0, y, W, y);
  // Top + bottom darkening bands (cheap vignette for legibility).
  const v = scene.add.graphics().setDepth(-97);
  v.fillStyle(0x05101f, 0.45); v.fillRect(0, 0, W, 70);
  v.fillStyle(0x05101f, 0.40); v.fillRect(0, H - 80, W, 80);
}

// Bridge Builder world backdrop: a plain engineering-blue field (no in-game
// scene) so the menu reads as its own space. The color is picked so that, after
// the legibility overlay below, brick/text contrast matches the old backdrop.
const WORLD_BG = 0x24557f; // calm blueprint blue
export function drawWorld(scene) {
  const W = scene.scale.width, H = scene.scale.height;
  scene.cameras.main.setBackgroundColor(hex(WORLD_BG));
  const bg = scene.add.graphics().setDepth(-100);
  bg.fillStyle(WORLD_BG, 1);
  bg.fillRect(0, 0, W, H);
  // Legibility overlay: gentle global dim + a stronger top band under the title.
  const o = scene.add.graphics().setDepth(-90);
  o.fillStyle(0x0a1f3a, 0.34); o.fillRect(0, 0, W, H);
  o.fillStyle(0x081a33, 0.55); o.fillRect(0, 0, W, 170);
  o.fillStyle(0x081a33, 0.30); o.fillRect(0, H - 70, W, 70);
}

// Chunky, pressable toy-brick button. Face fill is either a solid `color` or a
// 2-stop vertical `gradient: [top, bottom]`; `accents(g, w, faceH)` draws extra
// shapes (stars, sun) clipped roughly to the face. Locked bricks dim + skip input.
export function makeBrick(scene, { x, y, w, h, color, gradient, bevelColor, accents, locked = false, onClick }) {
  const faceH = h - BEVEL;
  const base = gradient ? gradient[1] : (color ?? T.faces.sky);
  const bevelC = bevelColor ?? shade(base, 0.6);

  const container = scene.add.container(x, y);

  const bevel = scene.add.graphics();
  bevel.fillStyle(bevelC, 1);
  bevel.fillRoundedRect(-w / 2, -h / 2 + BEVEL, w, faceH, RADIUS);

  const face = scene.add.container(0, 0);
  const glow = scene.add.graphics();
  glow.lineStyle(4, T.accent, 1);
  glow.strokeRoundedRect(-w / 2 - 3, -h / 2 - 3, w + 6, faceH + 6, RADIUS + 3);
  glow.setAlpha(0);

  const faceG = scene.add.graphics();
  if (gradient) faceG.fillGradientStyle(gradient[0], gradient[0], gradient[1], gradient[1], 1);
  else faceG.fillStyle(color ?? T.faces.sky, 1);
  faceG.fillRoundedRect(-w / 2, -h / 2, w, faceH, RADIUS);
  if (accents) accents(faceG, w, faceH);
  faceG.fillStyle(0xffffff, 0.12); // top sheen
  faceG.fillRoundedRect(-w / 2 + 6, -h / 2 + 6, w - 12, faceH * 0.28, RADIUS - 6);
  if (locked) { faceG.fillStyle(0x0a1530, 0.45); faceG.fillRoundedRect(-w / 2, -h / 2, w, faceH, RADIUS); }

  face.add([glow, faceG]);
  container.add([bevel, face]);

  const faceCenterY = -h / 2 + faceH / 2;

  if (!locked && onClick) {
    const zone = scene.add.rectangle(0, faceCenterY, w, faceH, 0xffffff, 0).setInteractive({ useHandCursor: true });
    face.add(zone);
    const press = (down) => scene.tweens.add({ targets: face, y: down ? BEVEL - 3 : 0, duration: 90, ease: 'Quad.out' });
    const lift = (on) => scene.tweens.add({ targets: glow, alpha: on ? 1 : 0, duration: 120 });
    zone.on('pointerover', () => { press(true); lift(true); });
    zone.on('pointerout', () => { press(false); lift(false); });
    zone.on('pointerdown', () => onClick());
  }

  return { container, face, faceCenterY, faceH, w };
}

export function makeChip(scene, { x, y, text, fill = T.lock, textColor = T.textHi, fontSize = 16, padX = 16, onClick }) {
  const c = scene.add.container(x, y);
  const label = scene.add.text(0, 0, text, {
    fontFamily: FONT_BODY, fontStyle: '700', fontSize: `${fontSize}px`, color: textColor,
  }).setOrigin(0.5);
  const w = label.width + padX * 2;
  const h = fontSize + 16;
  const g = scene.add.graphics();
  g.fillStyle(fill, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  c.add([g, label]);
  if (onClick) {
    const zone = scene.add.rectangle(0, 0, w, h, 0xffffff, 0).setInteractive({ useHandCursor: true });
    c.add(zone);
    zone.on('pointerover', () => c.setAlpha(0.82));
    zone.on('pointerout', () => c.setAlpha(1));
    zone.on('pointerdown', () => onClick());
  }
  return c;
}

export function popIn(scene, containers, { from = 0.85, stagger = 60 } = {}) {
  containers.forEach((c, i) => {
    c.setScale(from);
    c.setAlpha(0);
    scene.tweens.add({ targets: c, scale: 1, alpha: 1, ease: 'Back.out', duration: 320, delay: i * stagger });
  });
}
