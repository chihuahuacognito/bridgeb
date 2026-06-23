// src/scenes/ui/menuTheme.js
// Shared visual language for the menu scenes: "construction toy on blueprint
// paper". Tokens + a reusable pressable-brick button + the blueprint backdrop.
// Used by AppSelectScene / ModuleSelectScene / LevelSelectScene.

export const FONT_DISPLAY = 'Fredoka';
export const FONT_BODY = 'Nunito';

export const T = {
  bgDeep: 0x102a4c,
  bgTop:  0x1c4d86,
  grid:   0x2e6bb0,
  accent: 0x36e0d8,
  lock:   0x3a4a66,
  textHi:   '#f2f7ff',
  textMute: '#a9c0e0',
  onBrick:     '#13233b', // dark text on bright brick faces
  onBrickSoft: '#33405c',
  // Bright toy-block faces.
  faces: {
    bridge: 0xffb23e, rocket: 0xff6b6b, farm: 0x3fd07a,
    sky: 0x3fa9f5, violet: 0x9b7bff, amber: 0xffb23e,
  },
  // Phase pill colors (level tags).
  phase: { tutorial: 0x3fd07a, topic: 0x3fa9f5, challenge: 0x9b7bff },
};

export const PHASE_LABEL = { tutorial: 'LEARN', topic: 'DISCOVER', challenge: 'PROVE IT' };

// Multiply an 0xRRGGBB color toward black by factor f (0..1).
export function shade(hex, f) {
  const r = Math.round(((hex >> 16) & 255) * f);
  const g = Math.round(((hex >> 8) & 255) * f);
  const b = Math.round((hex & 255) * f);
  return (r << 16) | (g << 8) | b;
}

// Blueprint backdrop: blue gradient + faint technical grid. Call once per scene.
export function drawBlueprint(scene) {
  const W = scene.scale.width, H = scene.scale.height;
  scene.cameras.main.setBackgroundColor('#' + T.bgDeep.toString(16).padStart(6, '0'));
  const g = scene.add.graphics().setDepth(-100);
  g.fillGradientStyle(T.bgTop, T.bgTop, T.bgDeep, T.bgDeep, 1);
  g.fillRect(0, 0, W, H);
  g.lineStyle(1, T.grid, 0.10);
  for (let x = 0; x <= W; x += 40) g.lineBetween(x, 0, x, H);
  for (let y = 0; y <= H; y += 40) g.lineBetween(0, y, W, y);
  g.lineStyle(1, T.grid, 0.20); // bolder major lines
  for (let x = 0; x <= W; x += 200) g.lineBetween(x, 0, x, H);
  for (let y = 0; y <= H; y += 200) g.lineBetween(0, y, W, y);
}

const RADIUS = 18;
const BEVEL = 10;

// A chunky, pressable toy-brick button. Returns { container, face, faceCenterY,
// faceH, w } — add content (text/icons) into `face` positioned relative to the
// brick center; the face presses down on hover.
export function makeBrick(scene, { x, y, w, h, color, locked = false, onClick }) {
  const faceH = h - BEVEL;
  const faceColor = locked ? T.lock : color;
  const bevelColor = shade(faceColor, 0.62);

  const container = scene.add.container(x, y);

  const bevel = scene.add.graphics();
  bevel.fillStyle(bevelColor, 1);
  bevel.fillRoundedRect(-w / 2, -h / 2 + BEVEL, w, faceH, RADIUS);

  const face = scene.add.container(0, 0);
  const glow = scene.add.graphics();
  glow.lineStyle(4, T.accent, 1);
  glow.strokeRoundedRect(-w / 2 - 3, -h / 2 - 3, w + 6, faceH + 6, RADIUS + 3);
  glow.setAlpha(0);
  const faceG = scene.add.graphics();
  faceG.fillStyle(faceColor, 1);
  faceG.fillRoundedRect(-w / 2, -h / 2, w, faceH, RADIUS);
  faceG.fillStyle(0xffffff, locked ? 0.04 : 0.12); // top sheen
  faceG.fillRoundedRect(-w / 2 + 6, -h / 2 + 6, w - 12, faceH * 0.30, RADIUS - 6);
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

// Small pill-shaped utility chip (Back, Dev Stress, phase tag, badges).
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

// Staggered pop-in for a list of brick containers.
export function popIn(scene, containers, { from = 0.85, stagger = 60 } = {}) {
  containers.forEach((c, i) => {
    c.setScale(from);
    c.setAlpha(0);
    scene.tweens.add({
      targets: c, scale: 1, alpha: 1, ease: 'Back.out', duration: 320, delay: i * stagger,
    });
  });
}
