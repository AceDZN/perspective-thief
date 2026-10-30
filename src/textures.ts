// Procedural canvas textures: marble, wood, velvet, brass labels, floor rulers, art.
import * as THREE from 'three';

const LRI = '⁦';
const PDI = '⁩';

/** ⟦…⟧ marks numbers/formulas: isolate them left-to-right inside RTL text. */
export function bidi(s: string): string {
  return s.replace(/⟦([^⟧]*)⟧/g, (_m, inner: string) => LRI + inner + PDI);
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function tex(c: HTMLCanvasElement, repeat?: [number, number], srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

// Small deterministic RNG so textures look the same every load.
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const cache = new Map<string, THREE.Texture>();
function cached<T extends THREE.Texture>(key: string, make: () => T): T {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key) as T;
}

export function marbleTexture(tint: 'white' | 'grey' | 'dark' | 'teal' | 'red' | 'rose' = 'white'): THREE.CanvasTexture {
  return cached('marble-' + tint, () => {
    const [c, g] = canvas(512, 512);
    const base = { white: '#e8e6e2', grey: '#a9aab0', dark: '#2c2f38', teal: '#1f4a4f', red: '#5b1d22', rose: '#d9b8a6' }[tint];
    const vein = { white: 'rgba(90,90,100,', grey: 'rgba(40,40,50,', dark: 'rgba(200,190,170,', teal: 'rgba(170,220,210,', red: 'rgba(230,180,140,', rose: 'rgba(120,80,70,' }[tint];
    g.fillStyle = base;
    g.fillRect(0, 0, 512, 512);
    const r = rng(tint.length * 97 + 13);
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = `rgba(${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 255 : 0},0.025)`;
      const s = 4 + r() * 30;
      g.fillRect(r() * 512, r() * 512, s, s);
    }
    for (let v = 0; v < 9; v++) {
      g.beginPath();
      let x = r() * 512, y = r() * 512;
      g.moveTo(x, y);
      const ang = r() * Math.PI * 2;
      for (let s = 0; s < 40; s++) {
        x += Math.cos(ang + Math.sin(s * 0.4 + v) * 0.9) * 16;
        y += Math.sin(ang + Math.sin(s * 0.4 + v) * 0.9) * 16;
        g.lineTo(x, y);
      }
      g.strokeStyle = vein + (0.15 + r() * 0.3) + ')';
      g.lineWidth = 0.6 + r() * 2.2;
      g.stroke();
    }
    return tex(c, [1, 1]);
  });
}

/** Per-theme floor (one texture = 2 m × 2 m): marble slabs with inlays, parquet, carpet-marble, vault stone. */
export function floorTexture(theme: string): THREE.CanvasTexture {
  return cached('floor-' + theme, () => {
    const N = 1024;
    const [c, g] = canvas(N, N);
    const r = rng(theme.length * 31 + 7);
    const slab = (tint: 'white' | 'grey' | 'dark' | 'teal' | 'red' | 'rose', x: number, y: number, w: number, h: number) => {
      const t = marbleTexture(tint).image as HTMLCanvasElement;
      g.drawImage(t, Math.floor(r() * 256), Math.floor(r() * 256), 256, 256, x, y, w, h);
    };
    if (theme === 'shadows') {
      // Herringbone oak parquet.
      g.fillStyle = '#5a3a20';
      g.fillRect(0, 0, N, N);
      const bw = 64, bl = 256;
      for (let row = -4; row < 20; row++) {
        for (let col = -4; col < 20; col++) {
          const x = col * bw + row * bw, y = row * bw - col * bw;
          for (const vertical of [false, true]) {
            g.save();
            g.translate(x + (vertical ? bw : 0), y);
            const shade = 60 + Math.floor(r() * 40);
            g.fillStyle = `rgb(${shade + 70},${shade + 32},${shade - 10})`;
            if (vertical) g.fillRect(0, 0, bw, bl); else g.fillRect(-bl + bw, 0, bl, bw);
            g.strokeStyle = 'rgba(30,15,5,0.7)';
            g.lineWidth = 3;
            if (vertical) g.strokeRect(0, 0, bw, bl); else g.strokeRect(-bl + bw, 0, bl, bw);
            g.restore();
          }
        }
      }
      for (let i = 0; i < 1600; i++) {
        g.fillStyle = `rgba(30,15,5,${r() * 0.12})`;
        g.fillRect(r() * N, r() * N, 1 + r() * 40, 1);
      }
      return tex(c);
    }
    const scheme: Record<string, ['white' | 'grey' | 'dark' | 'teal' | 'red' | 'rose', 'white' | 'grey' | 'dark' | 'teal' | 'red' | 'rose', string]> = {
      lengths: ['white', 'dark', 'rgba(150,120,60,0.9)'],
      canvas: ['red', 'dark', 'rgba(220,180,90,0.95)'],
      vault: ['teal', 'dark', 'rgba(200,170,90,0.9)'],
      rooftop: ['rose', 'grey', 'rgba(120,90,70,0.6)'],
    };
    const [a, b, line] = scheme[theme] ?? scheme.lengths;
    // Four big slabs per tile.
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) slab(a, i * 512, j * 512, 512, 512);
    // Diamond inlay of the second marble at every slab corner.
    const d = 92;
    for (const [x, y] of [[0, 0], [512, 0], [1024, 0], [0, 512], [512, 512], [1024, 512], [0, 1024], [512, 1024], [1024, 1024]]) {
      g.save();
      g.beginPath();
      g.moveTo(x, y - d); g.lineTo(x + d, y); g.lineTo(x, y + d); g.lineTo(x - d, y); g.closePath();
      g.clip();
      slab(b, x - d, y - d, 2 * d, 2 * d);
      g.restore();
      g.strokeStyle = line;
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(x, y - d); g.lineTo(x + d, y); g.lineTo(x, y + d); g.lineTo(x - d, y); g.closePath();
      g.stroke();
    }
    // Thin brass joints + a soft polish highlight.
    g.strokeStyle = line;
    g.lineWidth = 3;
    for (const v of [0, 512, 1024]) {
      g.beginPath(); g.moveTo(v, 0); g.lineTo(v, N); g.stroke();
      g.beginPath(); g.moveTo(0, v); g.lineTo(N, v); g.stroke();
    }
    return tex(c);
  });
}

/** Dark walnut wall paneling with raised panels and a gold line (mezzanine and balcony faces). */
export function panelTexture(): THREE.CanvasTexture {
  return cached('panel', () => {
    const [c, g] = canvas(512, 512);
    g.drawImage(woodTexture(true).image as HTMLCanvasElement, 0, 0, 512, 512);
    g.fillStyle = 'rgba(20,10,4,0.35)';
    g.fillRect(0, 0, 512, 512);
    for (const [x, y, w, h] of [[28, 28, 200, 456], [284, 28, 200, 456]]) {
      g.fillStyle = 'rgba(255,200,140,0.06)';
      g.fillRect(x, y, w, h);
      g.strokeStyle = 'rgba(0,0,0,0.6)';
      g.lineWidth = 10;
      g.strokeRect(x, y, w, h);
      g.strokeStyle = 'rgba(225,185,95,0.85)';
      g.lineWidth = 4;
      g.strokeRect(x + 16, y + 16, w - 32, h - 32);
    }
    return tex(c, [1, 1]);
  });
}

/** Cut-stone blocks for big plain faces (mezzanines, balconies, tower). */
export function stoneBlockTexture(tint = '#b9b4aa'): THREE.CanvasTexture {
  return cached('stoneblock-' + tint, () => {
    const [c, g] = canvas(512, 512);
    g.fillStyle = tint;
    g.fillRect(0, 0, 512, 512);
    const r = rng(17);
    const bh = 128;
    for (let row = 0; row < 4; row++) {
      const off = row % 2 ? 128 : 0;
      for (let x = -off; x < 512; x += 256) {
        const l = 0.85 + r() * 0.25;
        g.fillStyle = `rgba(${Math.round(255 * l)},${Math.round(250 * l)},${Math.round(240 * l)},0.18)`;
        g.fillRect(x + 4, row * bh + 4, 248, bh - 8);
        g.strokeStyle = 'rgba(40,35,30,0.55)';
        g.lineWidth = 6;
        g.strokeRect(x + 2, row * bh + 2, 252, bh - 4);
      }
    }
    for (let i = 0; i < 3000; i++) {
      g.fillStyle = `rgba(0,0,0,${r() * 0.08})`;
      g.fillRect(r() * 512, r() * 512, 2, 2);
    }
    return tex(c, [1, 1]);
  });
}

export function woodTexture(dark = false): THREE.CanvasTexture {
  return cached('wood-' + dark, () => {
    const [c, g] = canvas(256, 256);
    g.fillStyle = dark ? '#3a2416' : '#8a5a32';
    g.fillRect(0, 0, 256, 256);
    const r = rng(dark ? 5 : 7);
    for (let i = 0; i < 70; i++) {
      g.strokeStyle = `rgba(${dark ? '20,10,5' : '60,30,10'},${0.1 + r() * 0.25})`;
      g.lineWidth = 1 + r() * 2;
      g.beginPath();
      const y = r() * 256;
      g.moveTo(0, y);
      for (let x = 0; x <= 256; x += 16) g.lineTo(x, y + Math.sin(x * 0.03 + i) * 3);
      g.stroke();
    }
    // Plank seams.
    g.fillStyle = 'rgba(0,0,0,0.35)';
    for (let y = 0; y < 256; y += 64) g.fillRect(0, y, 256, 3);
    return tex(c, [1, 1]);
  });
}

export function crateTexture(): THREE.CanvasTexture {
  return cached('crate', () => {
    const [c, g] = canvas(256, 256);
    g.drawImage(woodTexture().image as HTMLCanvasElement, 0, 0);
    g.strokeStyle = '#2a1a10';
    g.lineWidth = 18;
    g.strokeRect(9, 9, 238, 238);
    g.lineWidth = 14;
    g.beginPath(); g.moveTo(16, 16); g.lineTo(240, 240); g.stroke();
    g.fillStyle = '#6d6a66';
    for (const [x, y] of [[0, 0], [216, 0], [0, 216], [216, 216]]) g.fillRect(x, y, 40, 40);
    g.fillStyle = '#c9c4b8';
    for (const [x, y] of [[20, 20], [236, 20], [20, 236], [236, 236]]) { g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
    return tex(c);
  });
}

export function velvetTexture(color = '#7a0f1a'): THREE.CanvasTexture {
  return cached('velvet-' + color, () => {
    const [c, g] = canvas(128, 128);
    g.fillStyle = color;
    g.fillRect(0, 0, 128, 128);
    const r = rng(3);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(0,0,0,${r() * 0.12})`;
      g.fillRect(r() * 128, r() * 128, 2, 2);
    }
    return tex(c, [1, 1]);
  });
}

export function wallTexture(theme: string): THREE.CanvasTexture {
  return cached('wall-' + theme, () => {
    const [c, g] = canvas(512, 512);
    const colors: Record<string, [string, string]> = {
      lengths: ['#1d2a48', '#14203a'],
      shadows: ['#3b2a1c', '#2a1d13'],
      canvas: ['#4a1419', '#360d12'],
      vault: ['#173c40', '#0f2b2f'],
      rooftop: ['#c9a58e', '#b38f7a'],
    };
    const [a, b] = colors[theme] ?? colors.lengths;
    g.fillStyle = a;
    g.fillRect(0, 0, 512, 512);
    // Damask-ish pattern.
    g.fillStyle = b;
    for (let y = 0; y < 512; y += 64) for (let x = (y / 64) % 2 ? 32 : 0; x < 512; x += 64) {
      g.beginPath();
      g.ellipse(x + 16, y + 32, 9, 20, 0, 0, 7);
      g.fill();
    }
    // Wainscot band at the bottom: drawn by geometry instead.
    return tex(c, [1, 1]);
  });
}

export function paintingTexture(kind: 'cat' | 'landscape' | 'portrait' = 'cat'): THREE.CanvasTexture {
  return cached('painting-' + kind, () => {
    const [c, g] = canvas(384, 256);
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, kind === 'landscape' ? '#2d4a7a' : '#4b3a2a');
    grad.addColorStop(1, kind === 'landscape' ? '#c98a4b' : '#1d140d');
    g.fillStyle = grad;
    g.fillRect(0, 0, 384, 256);
    if (kind === 'cat') {
      // A smug museum cat (Mona-Lisa pose).
      g.fillStyle = '#c38a52';
      g.beginPath(); g.ellipse(192, 200, 90, 70, 0, 0, 7); g.fill();
      g.beginPath(); g.arc(192, 110, 56, 0, 7); g.fill();
      g.beginPath(); g.moveTo(146, 80); g.lineTo(150, 30); g.lineTo(180, 64); g.fill();
      g.beginPath(); g.moveTo(238, 80); g.lineTo(234, 30); g.lineTo(204, 64); g.fill();
      g.fillStyle = '#7a4f2a';
      for (let i = 0; i < 5; i++) g.fillRect(150 + i * 18, 70, 6, 26);
      g.fillStyle = '#e8e2b0';
      g.beginPath(); g.ellipse(170, 106, 11, 8, 0, 0, 7); g.ellipse(214, 106, 11, 8, 0, 0, 7); g.fill();
      g.fillStyle = '#1a1a1a';
      g.beginPath(); g.ellipse(170, 106, 3, 7, 0, 0, 7); g.ellipse(214, 106, 3, 7, 0, 0, 7); g.fill();
      g.fillStyle = '#e07a8a';
      g.beginPath(); g.moveTo(186, 124); g.lineTo(198, 124); g.lineTo(192, 131); g.fill();
      g.strokeStyle = '#3b2a1c'; g.lineWidth = 2;
      g.beginPath(); g.arc(186, 136, 6, 0, Math.PI); g.arc(198, 136, 6, 0, Math.PI); g.stroke();
      g.fillStyle = '#5a3a20';
      g.beginPath(); g.ellipse(192, 230, 60, 22, 0, 0, 7); g.fill();
    } else if (kind === 'landscape') {
      g.fillStyle = '#f2e3a0';
      g.beginPath(); g.arc(300, 70, 26, 0, 7); g.fill();
      g.fillStyle = '#2b3b2a';
      g.beginPath(); g.moveTo(0, 200); for (let x = 0; x <= 384; x += 32) g.lineTo(x, 170 + Math.sin(x * 0.03) * 30); g.lineTo(384, 256); g.lineTo(0, 256); g.fill();
      g.fillStyle = '#4c3b2a';
      g.fillRect(90, 90, 26, 100); g.fillRect(80, 80, 46, 16);
    } else {
      g.fillStyle = '#d8b48c';
      g.beginPath(); g.ellipse(192, 110, 48, 60, 0, 0, 7); g.fill();
      g.fillStyle = '#2a1a10';
      g.beginPath(); g.ellipse(192, 230, 100, 70, 0, 0, 7); g.fill();
    }
    // Craquelure + varnish.
    g.fillStyle = 'rgba(255,220,150,0.08)';
    g.fillRect(0, 0, 384, 256);
    return tex(c);
  });
}

export function rugTexture(look: 'rug' | 'mat'): THREE.CanvasTexture {
  return cached('rug-' + look, () => {
    const [c, g] = canvas(look === 'rug' ? 512 : 256, 256);
    const w = c.width, h = c.height;
    g.fillStyle = look === 'rug' ? '#7b1420' : '#1c3d6b';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#e0b85a';
    g.lineWidth = 10;
    g.strokeRect(14, 14, w - 28, h - 28);
    g.strokeStyle = '#1b1430';
    g.lineWidth = 6;
    g.strokeRect(30, 30, w - 60, h - 60);
    g.fillStyle = '#e0b85a';
    g.beginPath();
    g.moveTo(w / 2, 50); g.lineTo(w / 2 + 70, h / 2); g.lineTo(w / 2, h - 50); g.lineTo(w / 2 - 70, h / 2);
    g.fill();
    g.fillStyle = look === 'rug' ? '#7b1420' : '#1c3d6b';
    g.beginPath(); g.arc(w / 2, h / 2, 26, 0, 7); g.fill();
    return tex(c);
  });
}

export function glassTexture(rect: boolean): THREE.CanvasTexture {
  return cached('glass-' + rect, () => {
    const [c, g] = canvas(256, 256);
    const cols = rect ? ['#3aa76d', '#a7e05a', '#2c7a52'] : ['#d64545', '#3b6fd6', '#f2c14e', '#7a3bd6', '#38b2a6'];
    const r = rng(rect ? 2 : 9);
    for (let i = 0; i < 26; i++) {
      g.fillStyle = cols[Math.floor(r() * cols.length)];
      g.beginPath();
      const x = r() * 256, y = r() * 256;
      g.moveTo(x, y);
      for (let k = 0; k < 4; k++) g.lineTo(x + (r() - 0.5) * 140, y + (r() - 0.5) * 140);
      g.fill();
    }
    g.strokeStyle = '#1a1a1a';
    g.lineWidth = 5;
    for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(r() * 256, r() * 256); g.lineTo(r() * 256, r() * 256); g.stroke(); }
    return tex(c);
  });
}

export function bannerTexture(): THREE.CanvasTexture {
  return cached('banner', () => {
    const [c, g] = canvas(320, 256);
    g.fillStyle = '#1d2b5a';
    g.fillRect(0, 0, 320, 256);
    g.fillStyle = '#e0b85a';
    g.fillRect(0, 0, 320, 20);
    g.fillRect(0, 236, 320, 20);
    g.font = '700 64px Rubik, sans-serif';
    g.textAlign = 'center';
    g.direction = 'rtl';
    g.fillText('מוזיאון', 160, 120);
    g.font = '500 34px Rubik, sans-serif';
    g.fillText('הפרופורציות', 160, 180);
    return tex(c);
  });
}

export interface LabelTex {
  texture: THREE.CanvasTexture;
  aspect: number;
}

/**
 * A placard / plate with Hebrew lines. First line is the title (bolder). Numbers inside ⟦…⟧.
 */
export function labelTexture(lines: string[], style: 'brass' | 'paper' | 'dark' | 'floor' = 'brass'): LabelTex {
  const key = style + '|' + lines.join('\n');
  const hit = cache.get(key) as THREE.CanvasTexture | undefined;
  const W = 512;
  const lineH = 70;
  const H = 40 + lines.length * lineH;
  if (hit) return { texture: hit, aspect: W / H };
  const [c, g] = canvas(W, H);
  const fill = { brass: ['#e3c26a', '#9c7425'], paper: ['#f3ead2', '#d9c9a0'], dark: ['#1c1a22', '#0d0c12'], floor: ['#e3c26a', '#9c7425'] }[style];
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, fill[0]);
  grad.addColorStop(1, fill[1]);
  g.fillStyle = grad;
  roundRect(g, 4, 4, W - 8, H - 8, 22);
  g.fill();
  g.strokeStyle = style === 'dark' ? '#c9a24a' : 'rgba(60,35,5,0.8)';
  g.lineWidth = 6;
  roundRect(g, 12, 12, W - 24, H - 24, 16);
  g.stroke();
  // Screws.
  g.fillStyle = style === 'dark' ? '#c9a24a' : '#6b4a14';
  for (const [x, y] of [[26, 26], [W - 26, 26], [26, H - 26], [W - 26, H - 26]]) { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); }
  g.direction = 'rtl';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  lines.forEach((ln, i) => {
    const size = i === 0 ? 46 : 52;
    g.font = `${i === 0 ? 500 : 700} ${size}px Rubik, sans-serif`;
    const txt = bidi(ln);
    let s = size;
    while (g.measureText(txt).width > W - 60 && s > 20) {
      s -= 2;
      g.font = `${i === 0 ? 500 : 700} ${s}px Rubik, sans-serif`;
    }
    g.fillStyle = style === 'dark' ? '#f2e3b3' : '#2a1904';
    g.fillText(txt, W / 2, 20 + lineH * i + lineH / 2 + 4);
  });
  const t = tex(c);
  cache.set(key, t);
  return { texture: t, aspect: W / H };
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Brass measuring strip from `from` to `to` metres, ticks each 0.5 m, numbers each metre. */
export function rulerTexture(from: number, to: number): THREE.CanvasTexture {
  return cached(`ruler-${from}-${to}`, () => {
    const pxPerM = 160;
    const L = Math.max(0.5, to - from);
    const [c, g] = canvas(96, Math.ceil(L * pxPerM));
    const H = c.height;
    const grad = g.createLinearGradient(0, 0, 96, 0);
    grad.addColorStop(0, '#8a6420');
    grad.addColorStop(0.5, '#e8c873');
    grad.addColorStop(1, '#8a6420');
    g.fillStyle = grad;
    g.fillRect(0, 0, 96, H);
    g.fillStyle = '#3a2506';
    g.strokeStyle = '#3a2506';
    // Canvas y = 0 is the far end (to); y = H is `from`.
    const yOf = (m: number) => H - (m - from) * pxPerM;
    for (let m = Math.ceil(from * 10) / 10; m <= to + 1e-6; m += 0.1) {
      const mm = Math.round(m * 10) / 10;
      const y = yOf(mm);
      const isM = Math.abs(mm - Math.round(mm)) < 1e-6;
      const isHalf = Math.abs(mm * 2 - Math.round(mm * 2)) < 1e-6;
      const len = isM ? 40 : isHalf ? 28 : 12;
      g.lineWidth = isM ? 4 : isHalf ? 3 : 1.5;
      g.beginPath(); g.moveTo(0, y); g.lineTo(len, y); g.stroke();
      g.beginPath(); g.moveTo(96, y); g.lineTo(96 - len, y); g.stroke();
      if (isM && mm > 0) {
        g.save();
        // Numbers read from the far end looking back toward 0 (where the player stands to drop).
        g.translate(48, y + 2);
        g.rotate(Math.PI);
        g.font = '700 40px Rubik, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'bottom';
        g.fillText(String(mm), 0, 0);
        g.restore();
      }
    }
    const t = tex(c);
    t.anisotropy = 16;
    return t;
  });
}

/** Round floor marker for a grab pad. */
export function padTexture(d: number): THREE.CanvasTexture {
  return cached('pad-' + d, () => {
    const [c, g] = canvas(256, 256);
    g.strokeStyle = '#e8c873';
    g.lineWidth = 10;
    g.beginPath(); g.arc(128, 128, 112, 0, 7); g.stroke();
    g.lineWidth = 3;
    g.setLineDash([10, 10]);
    g.beginPath(); g.arc(128, 128, 92, 0, 7); g.stroke();
    g.setLineDash([]);
    g.fillStyle = 'rgba(232,200,115,0.18)';
    g.beginPath(); g.arc(128, 128, 108, 0, 7); g.fill();
    g.fillStyle = '#f3dc95';
    g.font = '700 64px Rubik, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.direction = 'rtl';
    g.fillText(bidi(`⟦${d}⟧ מ'`), 128, 132);
    return tex(c);
  });
}

export function glowSprite(color = '#ffcc66'): THREE.CanvasTexture {
  return cached('glow-' + color, () => {
    const [c, g] = canvas(64, 64);
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, color);
    grad.addColorStop(0.3, color + 'aa');
    grad.addColorStop(1, color + '00');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return tex(c);
  });
}

export function skyTexture(theme: string): THREE.CanvasTexture {
  return cached('sky-' + theme, () => {
    const [c, g] = canvas(512, 256);
    const grad = g.createLinearGradient(0, 0, 0, 256);
    if (theme === 'rooftop') {
      grad.addColorStop(0, '#3b3f78');
      grad.addColorStop(0.55, '#e58a7a');
      grad.addColorStop(1, '#ffd29a');
    } else {
      grad.addColorStop(0, '#05081a');
      grad.addColorStop(1, '#1a2a55');
    }
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 256);
    const r = rng(11);
    if (theme !== 'rooftop') {
      for (let i = 0; i < 160; i++) {
        g.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.7})`;
        g.fillRect(r() * 512, r() * 180, 1.5, 1.5);
      }
      g.fillStyle = '#f6f1d8';
      g.beginPath(); g.arc(380, 70, 26, 0, 7); g.fill();
    } else {
      g.fillStyle = '#fff1c4';
      g.beginPath(); g.arc(420, 200, 34, 0, 7); g.fill();
    }
    const t = tex(c);
    t.mapping = THREE.EquirectangularReflectionMapping;
    return t;
  });
}
