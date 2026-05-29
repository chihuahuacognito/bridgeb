// src/ui/BlockPalette.js
// Bottom-left material + size selector, Poly Bridge style.

const PANEL_H    = 128;
const MAT_ROW_H  = 70;
const SIZE_ROW_H = 54;
const ICON_W     = 76;
const ICON_H     = 58;
const ICON_PAD   = 6;
const ICON_START = 12;
const DEPTH      = 50;

const SIZES = ['S', 'M', 'L', 'XL'];

// ── colour tokens ────────────────────────────────────────────────────────────
const C = {
  panelBg:       0x1e2028,   // dark neutral charcoal — distinct from navy blue by hue, not brightness
  panelBorder:   0x4499ff,   // bright blue accent line
  sep:           0x32343e,

  btnOff:        0x383a48,   // clearly raised above panel bg
  btnHover:      0x484a5c,
  btnOn:         0x2060cc,
  borderOff:     0x5a607a,   // visible at rest
  borderOn:      0x55aaff,

  sizeOff:       0x303240,
  sizeOn:        0x2060cc,
  sizeBorderOff: 0x5a607a,
  sizeBorderOn:  0x55aaff,

  textDim:       '#c8d0e8',   // soft white — readable against charcoal
  textBright:    '#ffffff',
  textCost:      '#ffcc44',

  freeOff:       0x383a48,
  freeOn:        0x1a6080,
  freeBorderOff: 0x5a607a,
  freeBorderOn:  0x33bbdd,
  freeTextOff:   '#c8d0e8',
  freeTextOn:    '#66eeff',

  infoText:      '#88b8e8',
};

export class BlockPalette {
  constructor(scene, levelMaterials) {
    this.scene        = scene;
    this._mats        = levelMaterials;
    this._selMaterial = null;
    this._selSize     = null;
    this._freeform    = false;
    this._onChange    = null;
    this._objects     = [];
    this._buildUI();
  }

  onChange(fn)  { this._onChange = fn; }

  getSelection() {
    return { material: this._selMaterial, size: this._selSize, freeform: this._freeform };
  }

  selectMaterial(key) { this._pickMaterial(key); }
  selectFreeform()    { this._pickFreeform(); }

  isOverPalette(pointer) {
    return pointer.y >= this.scene.scale.height - PANEL_H;
  }

  reset() {
    this._selMaterial = null;
    this._selSize     = null;
    this._freeform    = false;
    this._refreshVisuals();
    this._showSizeRow(false);
    this._onChange?.({ type: 'reset' });
  }

  destroy() {
    for (const o of this._objects) o.destroy();
    this._objects = [];
  }

  // ── build ─────────────────────────────────────────────────────────────────

  _buildUI() {
    const { scene } = this;
    const sw = scene.scale.width;
    const sh = scene.scale.height;
    const panelTop = sh - PANEL_H;
    console.log('[Palette] sw:', sw, 'sh:', sh, 'canvas.w:', scene.sys.game.canvas.width, 'canvas.h:', scene.sys.game.canvas.height);

    // Solid panel background — use graphics so fillRect covers full width regardless of origin
    const panelBgGfx = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH);
    panelBgGfx.fillStyle(C.panelBg, 1);
    panelBgGfx.fillRect(0, panelTop, sw, PANEL_H);
    this._mk(panelBgGfx);

    // Bright top border – makes the panel "pop" off the game world
    const border = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH + 1);
    border.lineStyle(3, C.panelBorder, 1);
    border.beginPath();
    border.moveTo(0, panelTop);
    border.lineTo(sw, panelTop);
    border.strokePath();
    this._mk(border);

    // Row separator
    const sep = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH + 1);
    sep.lineStyle(1, C.sep, 1);
    sep.beginPath();
    sep.moveTo(0, panelTop + SIZE_ROW_H);
    sep.lineTo(sw, panelTop + SIZE_ROW_H);
    sep.strokePath();
    this._mk(sep);

    // ── material buttons ────────────────────────────────────────────────────
    const matRowCY = sh - MAT_ROW_H / 2;
    const mats = [
      { key: 'road', label: 'ROAD' },
      { key: 'wood', label: 'BEAM' },
    ];
    this._matBtns = {};

    mats.forEach((m, i) => {
      const cx = ICON_START + ICON_W / 2 + i * (ICON_W + ICON_PAD);
      const btn = scene.add.rectangle(cx, matRowCY, ICON_W, ICON_H, C.btnOff)
        .setStrokeStyle(1.5, C.borderOff).setInteractive().setScrollFactor(0).setDepth(DEPTH + 1);

      const iconGfx = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH + 2);
      this._drawMatIcon(iconGfx, cx, matRowCY - 6, m.key);

      const lbl = scene.add.text(cx, matRowCY + 19, m.label, {
        fontSize: '12px', color: C.textDim, fontFamily: 'monospace', fontStyle: 'bold',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH + 2);

      btn.on('pointerdown', (_p, _lx, _ly, ev) => { ev.stopPropagation(); this._pickMaterial(m.key); });
      btn.on('pointerover', () => { if (this._selMaterial !== m.key) btn.setFillStyle(C.btnHover); });
      btn.on('pointerout',  () => { this._refreshMatBtn(m.key); });

      this._matBtns[m.key] = { btn, iconGfx, lbl, key: m.key };
      this._mk(btn); this._mk(iconGfx); this._mk(lbl);
    });

    // ── freeform toggle ─────────────────────────────────────────────────────
    const freeCX = ICON_START + ICON_W / 2 + mats.length * (ICON_W + ICON_PAD);
    this._freeformBtn = scene.add.rectangle(freeCX, matRowCY, ICON_W, ICON_H, C.freeOff)
      .setStrokeStyle(1.5, C.freeBorderOff).setInteractive().setScrollFactor(0).setDepth(DEPTH + 1);

    // pencil icon drawn in graphics
    const freeGfx = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH + 2);
    this._drawFreeformIcon(freeGfx, freeCX, matRowCY - 6);
    this._freeformIconGfx = freeGfx;

    this._freeformLbl = scene.add.text(freeCX, matRowCY + 19, 'FREE', {
      fontSize: '12px', color: C.freeTextOff, fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH + 2);

    this._freeformBtn.on('pointerdown', (_p, _lx, _ly, ev) => { ev.stopPropagation(); this._pickFreeform(); });
    this._freeformBtn.on('pointerover', () => { if (!this._freeform) this._freeformBtn.setFillStyle(C.btnHover); });
    this._freeformBtn.on('pointerout',  () => { this._refreshFreeformBtn(); });
    this._mk(this._freeformBtn); this._mk(freeGfx); this._mk(this._freeformLbl);

    // ── size row ─────────────────────────────────────────────────────────────
    const sizeRowCY = panelTop + SIZE_ROW_H / 2;
    this._sizeBtns = {};

    SIZES.forEach((sz, i) => {
      const cx = ICON_START + ICON_W / 2 + i * (ICON_W + ICON_PAD);
      const btn = scene.add.rectangle(cx, sizeRowCY, ICON_W, SIZE_ROW_H - 8, C.sizeOff)
        .setStrokeStyle(1.5, C.sizeBorderOff).setInteractive().setScrollFactor(0).setDepth(DEPTH + 1).setVisible(false);

      const lbl = scene.add.text(cx, sizeRowCY - 9, sz, {
        fontSize: '17px', color: C.textDim, fontFamily: 'monospace', fontStyle: 'bold',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH + 2).setVisible(false);

      const costLbl = scene.add.text(cx, sizeRowCY + 13, '', {
        fontSize: '12px', color: C.textCost, fontFamily: 'monospace',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH + 2).setVisible(false);

      btn.on('pointerdown', (_p, _lx, _ly, ev) => { ev.stopPropagation(); this._pickSize(sz); });
      btn.on('pointerover', () => { if (this._selSize !== sz) btn.setFillStyle(C.btnHover); });
      btn.on('pointerout',  () => { this._refreshSizeBtn(sz); });

      this._sizeBtns[sz] = { btn, lbl, costLbl };
      this._mk(btn); this._mk(lbl); this._mk(costLbl);
    });

    // ── info label (right of icons) ──────────────────────────────────────────
    const infoX = ICON_START + ICON_W / 2 + (mats.length + 1) * (ICON_W + ICON_PAD) + 20;
    this._infoLbl = scene.add.text(infoX, matRowCY, '', {
      fontSize: '14px', color: C.infoText, fontFamily: 'monospace',
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(DEPTH + 2);
    this._mk(this._infoLbl);
  }

  // ── icon drawing ──────────────────────────────────────────────────────────

  _drawMatIcon(gfx, cx, cy, key) {
    gfx.clear();
    if (key === 'road') {
      // Road cross-section: light grey filled rect + white dashes
      gfx.fillStyle(0x555566, 1);
      gfx.fillRect(cx - 26, cy - 5, 52, 12);
      gfx.fillStyle(0xccccdd, 1);
      gfx.fillRect(cx - 26, cy - 5, 52, 12);  // lighter top face
      gfx.lineStyle(8, 0x444455, 1);
      gfx.beginPath(); gfx.moveTo(cx - 26, cy + 1); gfx.lineTo(cx + 26, cy + 1); gfx.strokePath();
      // Centre line dashes (white)
      gfx.lineStyle(2, 0xffffff, 0.9);
      for (let x = cx - 18; x < cx + 26; x += 12) {
        gfx.beginPath(); gfx.moveTo(x, cy + 1); gfx.lineTo(x + 7, cy + 1); gfx.strokePath();
      }
    } else {
      // Beam: bright orange diagonal + gold joints
      gfx.lineStyle(5, 0xf09020, 1);
      gfx.beginPath(); gfx.moveTo(cx - 22, cy + 8); gfx.lineTo(cx + 22, cy - 8); gfx.strokePath();
      gfx.fillStyle(0xf5d400, 1);
      gfx.fillCircle(cx - 22, cy + 8, 5);
      gfx.fillCircle(cx + 22, cy - 8, 5);
      gfx.lineStyle(1.5, 0xffee80, 0.8);
      gfx.strokeCircle(cx - 22, cy + 8, 5);
      gfx.strokeCircle(cx + 22, cy - 8, 5);
    }
  }

  _drawFreeformIcon(gfx, cx, cy) {
    gfx.clear();
    // Simple pencil: angled line + eraser end
    gfx.lineStyle(3, 0x88aacc, 0.9);
    gfx.beginPath(); gfx.moveTo(cx - 10, cy + 10); gfx.lineTo(cx + 10, cy - 10); gfx.strokePath();
    gfx.fillStyle(0x3399dd, 1);
    gfx.fillCircle(cx - 10, cy + 10, 4);
    gfx.fillStyle(0xeebb44, 1);
    gfx.fillCircle(cx + 10, cy - 10, 4);
  }

  // ── selection logic ───────────────────────────────────────────────────────

  _pickMaterial(key) {
    const wasSelected = this._selMaterial === key;
    this._selMaterial = wasSelected ? null : key;
    this._selSize     = null;
    this._freeform    = false;
    this._showSizeRow(!!this._selMaterial);
    this._refreshVisuals();
    this._onChange?.({ type: 'material', material: this._selMaterial });
  }

  _pickSize(sz) {
    this._selSize = sz;
    this._refreshVisuals();
    this._onChange?.({ type: 'size', material: this._selMaterial, size: sz });
  }

  _pickFreeform() {
    this._freeform    = !this._freeform;
    this._selMaterial = null;
    this._selSize     = null;
    this._showSizeRow(false);
    this._refreshVisuals();
    this._onChange?.({ type: 'freeform', active: this._freeform });
  }

  // ── visuals ───────────────────────────────────────────────────────────────

  _showSizeRow(visible) {
    for (const sz of SIZES) {
      const { btn, lbl, costLbl } = this._sizeBtns[sz];
      btn.setVisible(visible);
      lbl.setVisible(visible);
      if (visible && this._selMaterial) {
        const block = this._mats[this._selMaterial]?.blocks?.[sz];
        costLbl.setText(block ? `$${block.cost}` : '').setVisible(true);
      } else {
        costLbl.setVisible(false);
      }
    }
  }

  _refreshVisuals() {
    for (const key of Object.keys(this._matBtns)) this._refreshMatBtn(key);
    for (const sz of SIZES) this._refreshSizeBtn(sz);
    this._refreshFreeformBtn();
    this._refreshInfoLabel();
  }

  _refreshMatBtn(key) {
    const { btn, lbl } = this._matBtns[key];
    const on = this._selMaterial === key;
    btn.setFillStyle(on ? C.btnOn : C.btnOff);
    btn.setStrokeStyle(on ? 2 : 1.5, on ? C.borderOn : C.borderOff);
    lbl.setColor(on ? C.textBright : C.textDim);
  }

  _refreshSizeBtn(sz) {
    const { btn, lbl } = this._sizeBtns[sz];
    const on = this._selSize === sz;
    btn.setFillStyle(on ? C.sizeOn : C.sizeOff);
    btn.setStrokeStyle(on ? 2 : 1.5, on ? C.sizeBorderOn : C.sizeBorderOff);
    lbl.setColor(on ? C.textBright : C.textDim);
  }

  _refreshFreeformBtn() {
    const on = this._freeform;
    this._freeformBtn.setFillStyle(on ? C.freeOn : C.freeOff);
    this._freeformBtn.setStrokeStyle(on ? 2 : 1.5, on ? C.freeBorderOn : C.freeBorderOff);
    this._freeformLbl.setColor(on ? C.freeTextOn : C.freeTextOff);
  }

  _refreshInfoLabel() {
    if (this._freeform) { this._infoLbl.setText('FREEFORM  [F]').setColor('#66ddff'); return; }
    if (!this._selMaterial) { this._infoLbl.setText(''); return; }
    if (!this._selSize) { this._infoLbl.setText('← pick a size').setColor(C.infoText); return; }
    const mat   = this._mats[this._selMaterial];
    const block = mat?.blocks?.[this._selSize];
    if (!block) { this._infoLbl.setText(''); return; }
    const name = mat.type === 'road' ? 'ROAD' : 'BEAM';
    this._infoLbl
      .setText(`${this._selSize} ${name}  ·  ${block.length}px  ·  $${block.cost}`)
      .setColor(C.infoText);
  }

  _mk(obj) { this._objects.push(obj); return obj; }
}
