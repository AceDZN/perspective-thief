// The 18 authored heists. Pure data + small helpers; no Three.js.
//
// Coordinates: metres. x → east, z → south, y → up. Yaw 0 looks north (−z). A shape's local +z
// maps to world (sin yaw, cos yaw) on the floor. Distances d₁ / d₂ are horizontal (floor)
// distances from the player to an exhibit's or target's anchor.
import type { ConsequenceKind, Measure, Need } from './rules.ts';

export type V2 = [number, number];
export type V3 = [number, number, number];

export type Theme = 'lengths' | 'shadows' | 'canvas' | 'vault' | 'rooftop';

export type Shape =
  | { type: 'box'; w: number; h: number; d: number; look: 'crate' | 'plinth' | 'planter' | 'gold' | 'tower' }
  | { type: 'model'; model: ModelId; w: number; h: number; d: number }
  | { type: 'plank'; l: number; w: number; t: number }
  | { type: 'ladder'; h: number; w: number; d: number }
  | { type: 'mirror'; h: number; w: number; t: number }
  | { type: 'tri'; sides: [number, number, number]; t: number; labels: [string, string, string] }
  | { type: 'ramp'; run: number; rise: number; w: number }
  | { type: 'pole'; h: number; r: number }
  | { type: 'painting'; w: number; h: number; t: number }
  | { type: 'rug'; w: number; d: number; look: 'rug' | 'mat' }
  | { type: 'poly'; pts: V2[]; t: number; look: 'glass' | 'glassRect' }
  | { type: 'key'; l: number }
  | { type: 'banner'; w: number; h: number };

export type ModelId = 'dinoCrate' | 'bust' | 'statue' | 'sarcophagus' | 'guard' | 'raccoon' | 'lens';

export interface Exhibit {
  id: string;
  name: string;
  shape: Shape;
  /** Shape origin on the floor (or on the pedestal top). */
  pos: V2;
  yaw: number;
  pedestal: number;
  measures: Record<string, Measure>;
  placard: string[];
  /** Scale relative to the placard at level start (level 17 starts enlarged × 2). */
  initialScale?: number;
  /** Triangle orientation: which side index lies on the base. */
  orientation?: number;
  /** False for a piece that is not similar to the frame (never fits). */
  similar?: boolean;
}

export type SuccessKind = 'walkable' | 'raccoon' | 'open';

export interface Target {
  id: string;
  accepts: string;
  name: string;
  /** Where the exhibit's origin lands. */
  anchor: V3;
  yaw: number;
  /** Aim box: centre + half extents. */
  zone: { c: V3; h: V3 };
  measure: string;
  need: Need;
  orientation?: number;
  plate: string[];
  tooBig: ConsequenceKind;
  tooSmall: ConsequenceKind;
  success: SuccessKind;
  requires?: string;
  /** Visual kind of the socket. */
  socket: 'niche' | 'vent' | 'gap' | 'plinth' | 'doorway' | 'statueTop' | 'laserWall' | 'frameTri' | 'balcony' | 'loop' | 'window' | 'plate' | 'framePoly' | 'elevator' | 'keyhole' | 'billboard' | 'towerTop';
}

export type Prop =
  | { kind: 'solid'; min: V3; max: V3; mat: 'marble' | 'stone' | 'wood' | 'brass' | 'velvet' | 'steel' | 'dark'; walkable?: boolean }
  | { kind: 'model'; model: ModelId; pos: V3; h: number; yaw: number; collide?: boolean }
  | { kind: 'mannequin'; pos: V2; h: number }
  | { kind: 'laserLoop'; min: V2; max: V2; y: number }
  | { kind: 'laserBeam'; from: V3; to: V3 }
  | { kind: 'rope'; from: V3; to: V3 }
  | { kind: 'moonbeam'; from: V3; to: V3; w: number }
  | { kind: 'camera'; pos: V3; yaw: number }
  | { kind: 'sign'; pos: V3; yaw: number; lines: string[]; w?: number }
  | { kind: 'window'; pos: V3; yaw: number; w: number; h: number };

export interface Ruler {
  /** Point that reads 0. */
  origin: V2;
  /** Direction angle (radians) on the floor: 0 = +z (south), π/2 = +x (east). */
  dir: number;
  from: number;
  to: number;
}

export interface Pad {
  forId: string;
  pos: V2;
  d: number;
}

export interface Level {
  id: number;
  world: 1 | 2 | 3 | 4 | 5;
  title: string;
  objective: string;
  tutorial?: string[];
  modules: string[];
  skill: string;
  misconception: string;
  extension?: boolean;
  noHints?: boolean;
  room: { x0: number; x1: number; z0: number; z1: number; h: number; theme: Theme; pits?: { min: V2; max: V2 }[] };
  spawn: { pos: V2; yaw: number };
  exhibits: Exhibit[];
  targets: Target[];
  pads: Pad[];
  props: Prop[];
  rulers: Ruler[];
  hides: V2[];
  guardDoor: V2;
  patrol?: V2[];
  exit: { pos: V3; r: number };
  /** Shadow light: elevation (deg) and the floor direction shadows fall toward (radians, like Ruler.dir). */
  sun?: { elevation: number; shadowDir: number };
  hint: string[];
}

export interface World {
  id: 1 | 2 | 3 | 4 | 5;
  title: string;
  subtitle: string;
  theme: Theme;
  /** Difficulty tier shown on the map and in the hall banner. */
  tier: string;
  /** One or two lines shown when you enter the hall for the first time. */
  intro: string[];
}

export const WORLDS: World[] = [
  {
    id: 1, title: 'אולם האורכים', subtitle: 'יחס דמיון וצלעות מתאימות', theme: 'lengths', tier: 'מתחילים',
    intro: ['כל אורך מוכפל ביחס הדמיון ⟦k = d₂ ÷ d₁⟧.', 'מגדילים, מקטינים, ובוחרים איזו צלע מתאימה לאיזו.'],
  },
  {
    id: 2, title: 'אולם הצללים', subtitle: 'משולשים דומים לפי ז.ז.', theme: 'shadows', tier: 'בינוני',
    intro: ['כאן לא כתוב כמה גבוה היעד: מוצאים אותו ממשולשים דומים — צללים, לייזר, חבל.', 'קודם הגובה, אחר כך ⟦k⟧.'],
  },
  {
    id: 3, title: 'אולם הבד והשטיח', subtitle: 'יחס היקפים ויחס שטחים', theme: 'canvas', tier: 'מתקדם',
    intro: ['היקף גדל פי ⟦k⟧, אבל שטח גדל פי ⟦k²⟧.', 'שימו לב מה כתוב על הלוחית: היקף או שטח?'],
  },
  {
    id: 4, title: 'הכספת', subtitle: 'הרחבה: נפח · חפיפה מול דמיון', theme: 'vault', tier: 'מומחה · הרחבה',
    intro: ['הרחבה: נפח ומשקל גדלים פי ⟦k³⟧.', 'וחפיפה היא דמיון ביחס ⟦k = 1⟧.'],
  },
  {
    id: 5, title: 'היציאה הגדולה', subtitle: 'הגג, עם שחר — בלי רמזים', theme: 'rooftop', tier: 'אתגר סופי',
    intro: ['שלושה צעדים, שומר מסייר ובלי רמזים.', 'השומר זז רק כשאתם זזים — עצרו כדי לחשוב.'],
  },
];

const len = (value: number, label: string, unit: Measure['unit'] = 'm'): Measure => ({ value, power: 1, unit, label });
const area = (value: number, label: string, unit: Measure['unit'] = 'm2'): Measure => ({ value, power: 2, unit, label });
const weight = (value: number, label: string): Measure => ({ value, power: 3, unit: 'kg', label });

const PI = Math.PI;
const SHADOW_16_2 = (Math.atan(1.6 / 2) * 180) / PI; // 38.66°: a 1.6 m object casts a 2 m shadow
const SHADOW_15_2 = (Math.atan(1.5 / 2) * 180) / PI; // 36.87°

const W1 = ['similarity-concept', 'corresponding-sides-similarity'];

export const LEVELS: Level[] = [
  // ───────────── World 1 — Gallery of Lengths ─────────────
  {
    id: 1,
    world: 1,
    title: 'הרמה ראשונה',
    objective: "הניחו את הקובייה בגומחה שגובהה ⟦1.5⟧ מ', וטפסו ליציאה",
    tutorial: [
      'העדשה הגנובה שומרת על הגודל שאתם רואים — לא על הגודל האמיתי.',
      'תופסים חפץ ממרחק ⟦d₁⟧ ומניחים ממרחק ⟦d₂⟧: כל אורך מוכפל ביחס הדמיון ⟦k = d₂ ÷ d₁⟧.',
      'רחוק יותר: גדול יותר. קרוב יותר: קטן יותר. וכש־⟦k = 1⟧ — חופף למקור.',
      'בעדשה תראו את ⟦k⟧ ואת הגודל שיתקבל. התרחקו או התקרבו עד שהגודל מתאים לגומחה.',
    ],
    modules: ['similarity-concept'],
    skill: 'יחס דמיון ⟦k⟧ כמנה של שני אורכים מתאימים; ⟦d₂ = k·d₁⟧',
    misconception: 'k = d₂ − d₁ במקום d₂ ÷ d₁',
    room: { x0: -5, x1: 5, z0: -7, z1: 7, h: 6, theme: 'lengths' },
    spawn: { pos: [0, 6], yaw: 0 },
    exhibits: [
      {
        id: 'cube',
        name: 'קובייה עתיקה',
        shape: { type: 'box', w: 0.5, h: 0.5, d: 0.5, look: 'crate' },
        pos: [-2.5, 0],
        yaw: 0,
        pedestal: 1,
        measures: { side: len(0.5, 'מקצוע') },
        placard: ['קובייה עתיקה', "מקצוע ⟦0.5⟧ מ'"],
      },
    ],
    targets: [
      {
        id: 'niche',
        accepts: 'cube',
        name: 'גומחה',
        anchor: [0, 0, -4.22],
        yaw: 0,
        zone: { c: [0, 0.8, -4.2], h: [0.95, 0.85, 0.85] },
        measure: 'side',
        need: { measure: 'side', value: 1.5 },
        plate: ['גומחה למדרגה', "גובה ⟦1.5⟧ מ'"],
        tooBig: 'crash',
        tooSmall: 'fallThrough',
        success: 'walkable',
        socket: 'niche',
      },
    ],
    pads: [{ forId: 'cube', pos: [-2.5, 2], d: 2 }],
    props: [
      { kind: 'solid', min: [-5, 0, -7], max: [5, 3, -5], mat: 'marble', walkable: true },
      { kind: 'solid', min: [-1.7, 0, -5], max: [-0.79, 1.6, -3.4], mat: 'stone' },
      { kind: 'solid', min: [0.79, 0, -5], max: [1.7, 1.6, -3.4], mat: 'stone' },
      { kind: 'sign', pos: [0, 3.6, -6.2], yaw: 0, lines: ['יציאה ←'], w: 1.2 },
      { kind: 'model', model: 'bust', pos: [3.8, 0, -3.5], h: 0.7, yaw: -0.6 },
      { kind: 'rope', from: [3, 0, 2], to: [3, 0, 5] },
      { kind: 'window', pos: [-5, 3.2, 2], yaw: PI / 2, w: 1.6, h: 2.6 },
      { kind: 'window', pos: [5, 3.2, 2], yaw: -PI / 2, w: 1.6, h: 2.6 },
    ],
    rulers: [{ origin: [0, -4.22], dir: 0, from: 1, to: 10 }],
    hides: [[3.8, 4.8]],
    guardDoor: [-5, -2],
    exit: { pos: [0, 3, -6], r: 1.1 },
    hint: ['הגומחה ⟦1.5⟧ והקובייה ⟦0.5⟧: ⟦k = 1.5 ÷ 0.5 = 3⟧.', 'תפסו מהמשטח (⟦d₁ = 2⟧) והניחו ממרחק ⟦d₂ = 3 × 2 = 6⟧ מ\' — הסרגל על הרצפה עוזר.'],
  },
  {
    id: 2,
    world: 1,
    title: 'מכווצים כדי להתגנב',
    objective: 'כווצו את ארגז הדינוזאור כך שייכנס לפתח האוורור — הדביבון מחכה',
    modules: ['similarity-concept'],
    skill: 'הקטנה: ⟦0 < k < 1⟧, מניחים קרוב יותר',
    misconception: 'k ו־1/k: מניחים רחוק כדי "להקטין"',
    room: { x0: -6, x1: 6, z0: -9, z1: 9, h: 7, theme: 'lengths' },
    spawn: { pos: [0, 7.6], yaw: 0 },
    exhibits: [
      {
        id: 'dino',
        name: 'ארגז הדינוזאור',
        shape: { type: 'model', model: 'dinoCrate', w: 3, h: 3, d: 3 },
        pos: [-3, -5.5],
        yaw: 0.2,
        pedestal: 0,
        measures: { height: len(3, 'גובה') },
        placard: ['ארגז שלד דינוזאור', "גובה ⟦3⟧ מ'"],
      },
    ],
    targets: [
      {
        id: 'vent',
        accepts: 'dino',
        name: 'פתח אוורור',
        anchor: [5.55, 0, 4],
        yaw: -PI / 2,
        zone: { c: [5.5, 0.5, 4], h: [0.6, 0.6, 0.7] },
        measure: 'height',
        need: { measure: 'height', value: 0.75, min: 0.7, max: 0.8 },
        plate: ['פתח אוורור', "גובה ⟦0.75⟧ מ'", "מרווח ⟦±0.05⟧ מ'"],
        tooBig: 'crash',
        tooSmall: 'blownAway',
        success: 'raccoon',
        socket: 'vent',
      },
    ],
    pads: [{ forId: 'dino', pos: [-3, 2.5], d: 8 }],
    props: [
      { kind: 'model', model: 'statue', pos: [4.5, 0, -7.5], h: 2.4, yaw: -0.5 },
      { kind: 'model', model: 'bust', pos: [-5, 1.0, 5], h: 0.6, yaw: 1.2 },
      { kind: 'solid', min: [-5.4, 0, 4.6], max: [-4.6, 1.0, 5.4], mat: 'marble' },
      { kind: 'rope', from: [-1, 0, -2], to: [-5, 0, -2] },
      { kind: 'window', pos: [-6, 3.5, 0], yaw: PI / 2, w: 1.8, h: 3 },
    ],
    rulers: [{ origin: [5.55, 4], dir: -PI / 2, from: 0.5, to: 10 }],
    hides: [[-4.6, 7.2]],
    guardDoor: [0, -9],
    exit: { pos: [-5.4, 0, -6.5], r: 0.9 },
    hint: ['השוו את גובה הארגז ⟦3⟧ לגובה הפתח ⟦0.75⟧ — יחס אורכים, וזו הקטנה.'],
  },
  {
    id: 3,
    world: 1,
    title: 'גשר על התהום',
    objective: 'הפכו את הקרש לגשר מעל התהום — לא קצר מדי, לא ארוך מדי',
    modules: ['similarity-concept', 'missing-lengths-proportion'],
    skill: 'טווח של ⟦k⟧ מתוך שני גבולות אורך',
    misconception: 'מחפשים k אחד "נכון" במקום טווח',
    room: { x0: -6, x1: 6, z0: -8, z1: 8, h: 6, theme: 'lengths', pits: [{ min: [-6, -3], max: [6, 0] }] },
    spawn: { pos: [0, 7], yaw: 0 },
    exhibits: [
      {
        id: 'plank',
        name: 'קרש',
        shape: { type: 'plank', l: 1.2, w: 0.4, t: 0.05 },
        pos: [3, 4.5],
        yaw: 0,
        pedestal: 1,
        measures: { length: len(1.2, 'אורך') },
        placard: ['קרש אלון', "אורך ⟦1.2⟧ מ'"],
      },
    ],
    targets: [
      {
        id: 'gap',
        accepts: 'plank',
        name: 'תהום',
        anchor: [0, 0, -1.5],
        yaw: 0,
        zone: { c: [0, 0.2, -1.5], h: [1.0, 0.7, 1.9] },
        measure: 'length',
        need: { measure: 'length', value: 3.15, min: 3.0, max: 3.3 },
        plate: ['תהום', "רוחב ⟦3⟧ מ'", "בין העמודים ⟦3.3⟧ מ'"],
        tooBig: 'crash',
        tooSmall: 'fallThrough',
        success: 'walkable',
        socket: 'gap',
      },
    ],
    pads: [{ forId: 'plank', pos: [3, 6.5], d: 2 }],
    props: [
      { kind: 'solid', min: [-1.1, 0, -3.45], max: [-0.65, 1.4, -3.15], mat: 'stone' },
      { kind: 'solid', min: [0.65, 0, -3.45], max: [1.1, 1.4, -3.15], mat: 'stone' },
      { kind: 'solid', min: [-1.1, 0, 0.15], max: [-0.65, 1.4, 0.45], mat: 'stone' },
      { kind: 'solid', min: [0.65, 0, 0.15], max: [1.1, 1.4, 0.45], mat: 'stone' },
      { kind: 'solid', min: [-0.65, 0, -3.3], max: [0.65, 0.12, -3.15], mat: 'brass' },
      { kind: 'solid', min: [-0.65, 0, 0.15], max: [0.65, 0.12, 0.3], mat: 'brass' },
      { kind: 'model', model: 'bust', pos: [-4.5, 1.0, -6], h: 0.6, yaw: 0.4 },
      { kind: 'solid', min: [-4.9, 0, -6.4], max: [-4.1, 1.0, -5.6], mat: 'marble' },
      { kind: 'window', pos: [6, 3, 4], yaw: -PI / 2, w: 1.6, h: 2.6 },
    ],
    rulers: [{ origin: [0, -1.5], dir: 0, from: 1.5, to: 9 }],
    hides: [[-4.5, 5]],
    guardDoor: [6, 5],
    exit: { pos: [0, 0, -6], r: 1.2 },
    hint: ['הקרש צריך להיות ארוך מ־⟦3⟧ וקצר מ־⟦3.3⟧. השוו כל גבול לאורך הקרש ⟦1.2⟧ — יחס אורכים.'],
  },
  {
    id: 4,
    world: 1,
    title: 'מרחק לא עגול',
    objective: "הציבו פסל על הכן הריק: החיישן מצפה לפסל בגובה ⟦0.9⟧ מ'",
    modules: ['corresponding-sides-similarity', 'missing-lengths-proportion'],
    skill: '⟦k⟧ לא שלם (1.5) ומרחק תפיסה לא עגול',
    misconception: 'מוסיפים את ההפרש (2.4 + 0.3) במקום לכפול',
    room: { x0: -5, x1: 5, z0: -6, z1: 6, h: 4.5, theme: 'lengths' },
    spawn: { pos: [0, 5], yaw: 0 },
    exhibits: [
      {
        id: 'bust',
        name: 'פסל ראש',
        shape: { type: 'model', model: 'bust', w: 0.42, h: 0.6, d: 0.36 },
        pos: [-3, 2],
        yaw: 0.5,
        pedestal: 1,
        measures: { height: len(0.6, 'גובה') },
        placard: ['פסל ראש משיש', "גובה ⟦0.6⟧ מ'"],
      },
    ],
    targets: [
      {
        id: 'plinth',
        accepts: 'bust',
        name: 'כן ריק',
        anchor: [0, 1, -4.5],
        yaw: 0,
        zone: { c: [0, 1.4, -4.5], h: [0.6, 0.6, 0.6] },
        measure: 'height',
        need: { measure: 'height', value: 0.9 },
        plate: ['כן ריק · חיישן גובה', "גובה הפסל ⟦0.9⟧ מ'"],
        tooBig: 'crash',
        tooSmall: 'pocketed',
        success: 'open',
        socket: 'plinth',
      },
    ],
    pads: [{ forId: 'bust', pos: [-3, 4.4], d: 2.4 }],
    props: [
      { kind: 'solid', min: [-0.45, 0, -4.95], max: [0.45, 1, -4.05], mat: 'marble' },
      { kind: 'solid', min: [-3.45, 0, -4.95], max: [-2.55, 1, -4.05], mat: 'marble' },
      { kind: 'solid', min: [2.55, 0, -4.95], max: [3.45, 1, -4.05], mat: 'marble' },
      { kind: 'model', model: 'bust', pos: [-3, 1, -4.5], h: 0.9, yaw: 0.2 },
      { kind: 'model', model: 'bust', pos: [3, 1, -4.5], h: 0.9, yaw: -0.2 },
      { kind: 'rope', from: [-4, 0, -3.4], to: [4, 0, -3.4] },
    ],
    rulers: [{ origin: [0, -4.5], dir: 0, from: 1, to: 10 }],
    hides: [[-3.9, 4.2]],
    guardDoor: [5, 0],
    exit: { pos: [-4.4, 0, -2], r: 0.9 },
    hint: ['השוו את גובה הפסל שלכם ⟦0.6⟧ לגובה הנדרש ⟦0.9⟧ — יחס אורכים.'],
  },
  {
    id: 5,
    world: 1,
    title: 'פקק לדלת',
    objective: 'חסמו את דלת השומר בפסל — שלא יישאר רווח',
    modules: ['corresponding-sides-similarity', 'similarity-concept'],
    skill: 'בחירת הצלע המתאימה (רוחב ↔ רוחב), ובדיקת מגבלה נוספת (תקרה)',
    misconception: 'מתאימים גובה לגובה הפתח במקום רוחב לרוחב',
    room: { x0: -6, x1: 6, z0: -6, z1: 7, h: 3.5, theme: 'lengths' },
    spawn: { pos: [0, 6], yaw: 0 },
    exhibits: [
      {
        id: 'statue',
        name: 'פסל',
        shape: { type: 'model', model: 'statue', w: 0.3, h: 0.8, d: 0.3 },
        pos: [3.5, 3],
        yaw: 0,
        pedestal: 0.8,
        measures: { width: len(0.3, 'רוחב'), height: len(0.8, 'גובה') },
        placard: ['פסל אלה', "גובה ⟦0.8⟧ מ'", "רוחב ⟦0.3⟧ מ'"],
      },
    ],
    targets: [
      {
        id: 'door',
        accepts: 'statue',
        name: 'דלת השומר',
        anchor: [0, 0, -5.6],
        yaw: 0,
        zone: { c: [0, 1.4, -5.6], h: [1.0, 1.4, 0.7] },
        measure: 'width',
        need: { measure: 'width', value: 1.2 },
        plate: ['דלת השומר', "רוחב ⟦1.2⟧ מ' · גובה ⟦3⟧ מ'"],
        tooBig: 'crash',
        tooSmall: 'gapLeft',
        success: 'open',
        socket: 'doorway',
      },
    ],
    pads: [{ forId: 'statue', pos: [3.5, 4.5], d: 1.5 }],
    props: [
      { kind: 'solid', min: [-6, 0, -6.3], max: [-0.6, 3.5, -6], mat: 'stone' },
      { kind: 'solid', min: [0.6, 0, -6.3], max: [6, 3.5, -6], mat: 'stone' },
      { kind: 'solid', min: [-0.6, 3, -6.3], max: [0.6, 3.5, -6], mat: 'stone' },
      { kind: 'sign', pos: [-3, 2.6, -5.95], yaw: 0, lines: ['גובה התקרה', "⟦3.5⟧ מ'"], w: 1.2 },
      { kind: 'model', model: 'bust', pos: [-4.5, 1, 1.5], h: 0.6, yaw: 1 },
      { kind: 'solid', min: [-4.9, 0, 1.1], max: [-4.1, 1, 1.9], mat: 'marble' },
    ],
    rulers: [{ origin: [0, -5.6], dir: 0, from: 1, to: 12 }],
    hides: [[-4.6, 4.6]],
    guardDoor: [0, -6.2],
    exit: { pos: [5.4, 0, -3], r: 0.9 },
    hint: [
      'איזו מידה של הפסל צריכה למלא את הפתח — הגובה או הרוחב? השוו את המידה הזאת למידה המתאימה של הדלת — יחס אורכים.',
      'אחר כך בדקו את המידה השנייה: הפסל המוגדל חייב להיות נמוך מהתקרה.',
    ],
    noHints: false,
  },

  // ───────────── World 2 — Hall of Shadows ─────────────
  {
    id: 6,
    world: 2,
    title: 'מודדים בצל',
    objective: 'הציבו סולם שמגיע בדיוק לכתר שבראש הפסל',
    tutorial: [
      'קרני הירח מגיעות מקבילות, באותה זווית לכל החפצים. לכן הגובה והצל של כל חפץ יוצרים משולשים דומים (דמיון לפי ז.ז.).',
      'גובה מתאים לגובה, צל מתאים לצל: גובה ÷ צל זהה לבובה ולפסל.',
    ],
    modules: ['real-life-similarity', 'similar-triangles-aa', 'missing-lengths-proportion'],
    skill: 'מציאת גובה בעזרת צללים (משולשים דומים), ואז ⟦k⟧',
    misconception: 'משווים צל לגובה של חפץ אחר (צלעות לא מתאימות)',
    room: { x0: -7, x1: 7, z0: -8, z1: 8, h: 10, theme: 'shadows' },
    spawn: { pos: [0, 7], yaw: 0 },
    sun: { elevation: SHADOW_16_2, shadowDir: 0 },
    exhibits: [
      {
        id: 'ladder',
        name: 'סולם',
        shape: { type: 'ladder', h: 1.8, w: 0.5, d: 0.25 },
        pos: [-4, 5],
        yaw: 0,
        pedestal: 0,
        measures: { height: len(1.8, 'גובה') },
        placard: ['סולם', "גובה ⟦1.8⟧ מ'"],
      },
    ],
    targets: [
      {
        id: 'crown',
        accepts: 'ladder',
        name: 'הכתר',
        anchor: [2.5, 0, -5.1],
        yaw: 0,
        zone: { c: [2.5, 1.5, -4.8], h: [1.3, 1.5, 0.9] },
        measure: 'height',
        need: { measure: 'height', value: 7.2 },
        plate: ['הכתר בראש הפסל', 'הגיעו אליו בדיוק'],
        tooBig: 'crash',
        tooSmall: 'tooShort',
        success: 'raccoon',
        socket: 'statueTop',
      },
    ],
    pads: [{ forId: 'ladder', pos: [-4, 6.5], d: 1.5 }],
    props: [
      { kind: 'mannequin', pos: [-4, -3], h: 1.6 },
      { kind: 'sign', pos: [-4.65, 1.2, -3], yaw: 0, lines: ['בובה', "גובה ⟦1.6⟧ מ'"], w: 0.7 },
      { kind: 'model', model: 'statue', pos: [2.5, 0, -6], h: 7.2, yaw: 0 },
    ],
    rulers: [
      { origin: [-4, -3], dir: 0, from: 0, to: 3 },
      { origin: [2.5, -6], dir: 0, from: 0, to: 10 },
    ],
    hides: [[-5.6, 1.5]],
    guardDoor: [7, -6],
    exit: { pos: [6.4, 0, 0], r: 0.9 },
    hint: ['בובה: גובה ⟦1.6⟧, צל ⟦2⟧. הפסל: צל ⟦9⟧. משולשים דומים — גובה מול גובה, צל מול צל.', 'אחר כך: יחס אורכים בין הסולם לגובה שמצאתם.'],
  },
  {
    id: 7,
    world: 2,
    title: 'משולש הלייזר',
    objective: 'הציבו מראה שהקצה העליון שלה יתפוס את הלייזר על הקיר',
    modules: ['similar-triangles-aa', 'missing-lengths-proportion'],
    skill: 'משולשים דומים עם קודקוד משותף (ז.ז.) — גובה לא ידוע',
    misconception: 'מחברים במקום לכפול: 1 + (6 − 2)',
    room: { x0: -6, x1: 6, z0: -6, z1: 6, h: 5, theme: 'shadows' },
    spawn: { pos: [0, 5.2], yaw: 0 },
    exhibits: [
      {
        id: 'mirror',
        name: 'מראה',
        shape: { type: 'mirror', h: 0.5, w: 0.3, t: 0.04 },
        pos: [-3, 3],
        yaw: 0,
        pedestal: 1,
        measures: { height: len(0.5, 'גובה') },
        placard: ['מראה עתיקה', "גובה ⟦0.5⟧ מ'"],
      },
    ],
    targets: [
      {
        id: 'wall',
        accepts: 'mirror',
        name: 'נקודת הלייזר',
        anchor: [5.98, 0, -3],
        yaw: -PI / 2,
        zone: { c: [5.6, 1.5, -3], h: [0.6, 1.5, 0.9] },
        measure: 'height',
        need: { measure: 'height', value: 3 },
        plate: ['כאן פוגע הלייזר', 'הציבו מראה שתגיע אליו בדיוק'],
        tooBig: 'crash',
        tooSmall: 'tooShort',
        success: 'open',
        socket: 'laserWall',
      },
    ],
    pads: [{ forId: 'mirror', pos: [-3, 4], d: 1 }],
    props: [
      { kind: 'solid', min: [2, 0, -3.25], max: [2.4, 1, -2.75], mat: 'brass' },
      { kind: 'laserBeam', from: [0, 0.03, -3], to: [6, 3, -3] },
      { kind: 'sign', pos: [2.2, 1.35, -2.7], yaw: 0, lines: ['עמוד', "גובה ⟦1⟧ מ'"], w: 0.7 },
      { kind: 'mannequin', pos: [-4.5, -4.5], h: 1.6 },
    ],
    rulers: [{ origin: [0, -3], dir: PI / 2, from: 0, to: 6 }],
    hides: [[-4.6, -1.5]],
    guardDoor: [6, 1],
    exit: { pos: [5.4, 0, 4], r: 0.9 },
    hint: [
      'המשולש הקטן: ⟦2⟧ על הרצפה, ⟦1⟧ גובה. הגדול: ⟦6⟧ על הרצפה, גובה? רצפה מול רצפה, גובה מול גובה — צלעות מתאימות.',
      'אחר כך: יחס אורכים בין גובה המראה לגובה שמצאתם.',
    ],
  },
  {
    id: 8,
    world: 2,
    title: 'צלעות מתאימות',
    objective: 'הכניסו את השלט המשולש למסגרת — באותה צורה ובכיוון הנכון',
    modules: ['corresponding-sides-similarity', 'similar-triangles-aa'],
    skill: 'התאמת צלעות: הקצרה לקצרה, הארוכה לארוכה',
    misconception: 'מתאימים צלעות לפי המיקום בציור ולא לפי האורך',
    room: { x0: -5, x1: 5, z0: -6, z1: 6, h: 4, theme: 'shadows' },
    spawn: { pos: [0, 5], yaw: 0 },
    exhibits: [
      {
        id: 'sign',
        name: 'שלט משולש',
        shape: { type: 'tri', sides: [0.3, 0.4, 0.5], t: 0.03, labels: ['30', '40', '50'] },
        pos: [3, 2],
        yaw: 0,
        pedestal: 1,
        measures: { short: len(30, 'צלע קצרה', 'cm') },
        placard: ['שלט משולש', 'צלעות ⟦30, 40, 50⟧ ס"מ'],
        orientation: 1,
      },
    ],
    targets: [
      {
        id: 'frame',
        accepts: 'sign',
        name: 'מסגרת משולשת',
        anchor: [0, 1, -5.92],
        yaw: 0,
        zone: { c: [0, 1.5, -5.7], h: [0.8, 0.8, 0.5] },
        measure: 'short',
        need: { measure: 'short', value: 60 },
        orientation: 0,
        plate: ['מסגרת', 'צלעות ⟦60, 80, 100⟧ ס"מ'],
        tooBig: 'crash',
        tooSmall: 'fallThrough',
        success: 'open',
        socket: 'frameTri',
      },
    ],
    pads: [{ forId: 'sign', pos: [3, 3.5], d: 1.5 }],
    props: [{ kind: 'mannequin', pos: [-3.5, -4], h: 1.6 }],
    rulers: [{ origin: [0, -5.92], dir: 0, from: 1, to: 11 }],
    hides: [[-3.8, 4.2]],
    guardDoor: [5, -2],
    exit: { pos: [-4.4, 0, 0], r: 0.9 },
    hint: ['השוו צלע מתאימה לצלע מתאימה: הקצרה ⟦30⟧ מול הקצרה ⟦60⟧ — יחס אורכים. מקש ⟦R⟧ (או כפתור הסיבוב) מסובב את השלט.'],
  },
  {
    id: 9,
    world: 2,
    title: 'רמפה למרפסת',
    objective: 'הפכו את הרמפה הקטנה לדרך עד המרפסת — והיא צריכה להיכנס לאורך האולם',
    modules: ['similar-triangles-aa', 'corresponding-sides-similarity'],
    skill: 'משולש ישר זווית דומה: גובה מול גובה, ובדיקה שהבסיס נכנס',
    misconception: 'מתאימים את אורך הרמפה לגובה המרפסת',
    room: { x0: -6, x1: 6, z0: -6, z1: 4, h: 5, theme: 'shadows' },
    spawn: { pos: [4, 2], yaw: 0.5 },
    exhibits: [
      {
        id: 'ramp',
        name: 'רמפה',
        shape: { type: 'ramp', run: 2, rise: 0.5, w: 0.8 },
        pos: [-4, 0],
        yaw: 0,
        pedestal: 0,
        measures: { rise: len(0.5, 'גובה'), run: len(2, 'בסיס') },
        placard: ['רמפה', "בסיס ⟦2⟧ מ' · גובה ⟦0.5⟧ מ'"],
      },
    ],
    targets: [
      {
        id: 'balcony',
        accepts: 'ramp',
        name: 'מרפסת',
        anchor: [1.5, 0, -3.5],
        yaw: 0,
        zone: { c: [1.5, 0.875, -3.0], h: [1.4, 0.95, 0.8] },
        measure: 'rise',
        need: { measure: 'rise', value: 1.75 },
        plate: ['מרפסת', "גובה ⟦1.75⟧ מ'"],
        tooBig: 'crash',
        tooSmall: 'tooShort',
        success: 'walkable',
        socket: 'balcony',
      },
    ],
    // Balcony 1.75 m: too high to climb (1.6 m), so the ramp is the only way up. k = 3.5 keeps the
    // "always ×3" shortcut from winning. d₁ = 2 (not 1.5): with 1.5 the wrong additive rule d₂ = d₁ + k gives 4.5 = 1.5 × 3 and wins.
    pads: [{ forId: 'ramp', pos: [-2, 0], d: 2 }],
    props: [
      { kind: 'solid', min: [-6, 0, -6], max: [6, 1.75, -3.5], mat: 'marble', walkable: true },
      { kind: 'sign', pos: [-2, 1.4, 3.95], yaw: PI, lines: ['אורך האולם', "⟦7.5⟧ מ'"], w: 1.2 },
      { kind: 'model', model: 'bust', pos: [-4.5, 1.75, -5], h: 0.7, yaw: 0.3 },
    ],
    rulers: [{ origin: [1.5, -3.5], dir: -PI / 4, from: 1, to: 8 }],
    hides: [[-5, 2]],
    guardDoor: [6, 0],
    exit: { pos: [1.5, 1.75, -5], r: 1 },
    hint: ['גובה הרמפה ⟦0.5⟧ מול גובה המרפסת ⟦1.75⟧ — יחס אורכים. ודאו שהבסיס החדש קצר מ־⟦7.5⟧.'],
  },
  {
    id: 10,
    world: 2,
    title: 'משולש בתוך משולש',
    objective: 'הציבו עמוד טיפוס שמגיע בדיוק למעקה המרפסת',
    modules: ['similar-triangles-aa', 'missing-lengths-proportion', 'real-life-similarity'],
    skill: 'העברה: משולש קטן בתוך גדול (קו מקביל) — בלי קווי עזר',
    misconception: 'משתמשים במרחק מהבאנר לקיר (6) במקום כל הבסיס (8)',
    room: { x0: -7, x1: 7, z0: -7, z1: 6, h: 9, theme: 'shadows' },
    spawn: { pos: [0, 5], yaw: 0 },
    exhibits: [
      {
        id: 'pole',
        name: 'עמוד',
        shape: { type: 'pole', h: 1.2, r: 0.04 },
        pos: [3, 3],
        yaw: 0,
        pedestal: 0,
        measures: { height: len(1.2, 'גובה') },
        placard: ['עמוד טיפוס', "גובה ⟦1.2⟧ מ'"],
      },
    ],
    targets: [
      {
        id: 'rail',
        accepts: 'pole',
        name: 'מעקה',
        anchor: [2, 0, -4.9],
        yaw: 0,
        zone: { c: [2, 1.5, -4.7], h: [0.9, 1.5, 0.6] },
        measure: 'height',
        need: { measure: 'height', value: 6 },
        plate: ['מעקה המרפסת', 'הגיעו אליו בדיוק'],
        tooBig: 'crash',
        tooSmall: 'tooShort',
        success: 'raccoon',
        socket: 'balcony',
      },
    ],
    pads: [{ forId: 'pole', pos: [3, 4], d: 1 }],
    props: [
      { kind: 'solid', min: [-7, 0, -7], max: [7, 6, -5], mat: 'marble' },
      { kind: 'rope', from: [-3, 6, -5], to: [-3, 0, 3] },
      // The banner itself: vertical, parallel to the balcony wall, 2 m from the rope's foot, its top
      // touching the rope at 1.5 m (6 × 2/8). Without it the small triangle is not visible.
      { kind: 'solid', min: [-3.3, 0, 0.98], max: [-2.7, 1.5, 1.02], mat: 'velvet' },
      { kind: 'sign', pos: [-3.6, 1.0, 1], yaw: 0, lines: ['באנר', "גובה ⟦1.5⟧ מ'"], w: 0.8 },
    ],
    rulers: [{ origin: [-3, 3], dir: PI, from: 0, to: 8 }],
    hides: [[5.6, -1.5]],
    guardDoor: [-7, 4],
    exit: { pos: [-6.4, 0, -1], r: 0.9 },
    hint: [
      'יש כאן משולש קטן בתוך משולש גדול. השוו בסיס לבסיס — מכף החבל עד הבאנר, ומכף החבל עד הקיר — ובאותו יחס גובה הבאנר מול גובה המרפסת. יחס אורכים.',
      'אחר כך: גובה העמוד מול הגובה שמצאתם — שוב יחס אורכים.',
    ],
    noHints: false,
  },

  // ───────────── World 3 — Canvas & Carpet ─────────────
  {
    id: 11,
    world: 3,
    title: 'גדר לייזר',
    objective: 'מלאו את לולאת הלייזר בבסיס — בדיוק עד הקרניים',
    modules: ['perimeter-area-ratio', 'similar-polygons'],
    skill: 'יחס היקפים = ⟦k⟧',
    misconception: 'משווים צלע להיקף (1 מול 14)',
    room: { x0: -6, x1: 6, z0: -7, z1: 7, h: 5, theme: 'canvas' },
    spawn: { pos: [0, 6], yaw: 0 },
    exhibits: [
      {
        id: 'plinth',
        name: 'בסיס',
        shape: { type: 'box', w: 1, h: 0.5, d: 1, look: 'plinth' },
        pos: [-3.5, 3],
        yaw: 0,
        pedestal: 0,
        measures: { perimeter: len(4, 'היקף') },
        placard: ['בסיס ריבועי', "צלע ⟦1⟧ מ'"],
      },
    ],
    targets: [
      {
        id: 'loop',
        accepts: 'plinth',
        name: 'לולאת לייזר',
        anchor: [0, 0, -3],
        yaw: 0,
        zone: { c: [0, 0.5, -3], h: [1.85, 0.6, 1.85] },
        measure: 'perimeter',
        need: { measure: 'perimeter', value: 14 },
        plate: ['לולאת לייזר', "היקף ⟦14⟧ מ'"],
        tooBig: 'crash',
        tooSmall: 'gapLeft',
        success: 'open',
        socket: 'loop',
      },
    ],
    pads: [{ forId: 'plinth', pos: [-3.5, 5], d: 2 }],
    props: [{ kind: 'laserLoop', min: [-1.75, -4.75], max: [1.75, -1.25], y: 0.3 }],
    rulers: [{ origin: [0, -3], dir: 0, from: 1.5, to: 9.5 }],
    hides: [[4.6, 4.6]],
    guardDoor: [-6, -2],
    exit: { pos: [5.4, 0, -5], r: 0.9 },
    hint: ['היקף הבסיס: ⟦4 × 1⟧. השוו אותו להיקף הלולאה ⟦14⟧ — יחס היקפים = ⟦k⟧.'],
  },
  {
    id: 12,
    world: 3,
    title: 'מכסים את חלון הירח',
    objective: 'חסמו את קרן הירח בציור — החלון דומה לציור',
    tutorial: ['כשכל אורך גדל פי ⟦k⟧, השטח גדל פי ⟦k²⟧.'],
    modules: ['perimeter-area-ratio', 'similar-polygons'],
    skill: 'יחס שטחים = ⟦k²⟧, לכן ⟦k = √(יחס השטחים)⟧',
    misconception: 'יחס שטחים = k (מניחים פי 9 במקום פי 3)',
    // z1 = 9 (not 6) so the k = 9 mistake is physically possible: d₂ = 9 × 1.5 = 13.5 m from the
    // window must be a real standing spot, or the roof-crash can never happen.
    room: { x0: -6, x1: 6, z0: -6, z1: 9, h: 4, theme: 'canvas' },
    spawn: { pos: [0, 5], yaw: 0 },
    exhibits: [
      {
        id: 'painting',
        name: 'ציור',
        shape: { type: 'painting', w: 0.6, h: 0.4, t: 0.03 },
        pos: [3.5, 2.5],
        yaw: 0,
        pedestal: 1,
        measures: { area: area(0.24, 'שטח') },
        placard: ['ציור שמן', "⟦0.6 × 0.4⟧ מ'"],
      },
    ],
    targets: [
      {
        id: 'window',
        accepts: 'painting',
        name: 'חלון הירח',
        anchor: [0, 1, -5.95],
        yaw: 0,
        zone: { c: [0, 1.6, -5.7], h: [1.2, 0.9, 0.5] },
        measure: 'area',
        need: { measure: 'area', value: 2.16 },
        plate: ['חלון הירח', 'שטח ⟦2.16⟧ מ"ר', 'אותה צורה כמו הציור'],
        tooBig: 'crash',
        tooSmall: 'gapLeft',
        success: 'open',
        socket: 'window',
      },
    ],
    pads: [{ forId: 'painting', pos: [3.5, 3.7], d: 1.2 }],
    props: [
      { kind: 'moonbeam', from: [0, 1.6, -5.95], to: [0, 0, -2], w: 1.8 },
      { kind: 'model', model: 'bust', pos: [-4.5, 1, -4], h: 0.6, yaw: 0.6 },
      { kind: 'solid', min: [-4.9, 0, -4.4], max: [-4.1, 1, -3.6], mat: 'marble' },
    ],
    rulers: [{ origin: [0, -5.95], dir: 0, from: 1, to: 11 }],
    hides: [[-4.6, 3.2]],
    guardDoor: [6, 2],
    exit: { pos: [-5.4, 0, -1], r: 0.9 },
    hint: ['שטח הציור ⟦0.24⟧ מול שטח החלון ⟦2.16⟧ — זה יחס שטחים, כלומר ⟦k²⟧.'],
  },
  {
    id: 13,
    world: 3,
    title: 'שטיח על לוחית',
    objective: 'כסו את לוחית הלחץ בשטיח — בדיוק בשטח שלה',
    modules: ['perimeter-area-ratio'],
    skill: 'יחס שטחים 4 ← ⟦k = 2⟧',
    misconception: 'k = 4',
    room: { x0: -6, x1: 6, z0: -6, z1: 6, h: 4, theme: 'canvas' },
    spawn: { pos: [0, 5], yaw: 0 },
    exhibits: [
      {
        id: 'rug',
        name: 'שטיח',
        shape: { type: 'rug', w: 1, d: 0.5, look: 'rug' },
        pos: [-3.5, 3],
        yaw: 0,
        pedestal: 0.8,
        measures: { area: area(0.5, 'שטח') },
        placard: ['שטיח פרסי', "⟦1 × 0.5⟧ מ'"],
      },
    ],
    targets: [
      {
        id: 'plate',
        accepts: 'rug',
        name: 'לוחית לחץ',
        anchor: [0, 0, -3],
        yaw: 0,
        zone: { c: [0, 0.3, -3], h: [1.3, 0.4, 0.8] },
        measure: 'area',
        need: { measure: 'area', value: 2 },
        plate: ['לוחית לחץ', 'שטח ⟦2⟧ מ"ר', 'אותה צורה כמו השטיח'],
        tooBig: 'crash',
        tooSmall: 'gapLeft',
        success: 'open',
        socket: 'plate',
      },
    ],
    pads: [{ forId: 'rug', pos: [-3.5, 4.5], d: 1.5 }],
    props: [
      // Outline of the 2 × 1 m (2 m²) plate, 5 cm margin like level 14 (was 2.9 × 1.5: wrong shape).
      { kind: 'laserLoop', min: [-1.05, -3.55], max: [1.05, -2.45], y: 0.06 },
      { kind: 'model', model: 'statue', pos: [4.5, 0, -4.5], h: 2.2, yaw: -0.6 },
    ],
    rulers: [{ origin: [0, -3], dir: 0, from: 1, to: 8.5 }],
    hides: [[4.6, 4.2]],
    guardDoor: [-6, 0],
    exit: { pos: [3, 0, -5.4], r: 0.9 },
    hint: ['שטח השטיח ⟦0.5⟧ מול שטח הלוחית ⟦2⟧ — יחס שטחים = ⟦k²⟧.'],
  },
  {
    id: 14,
    world: 3,
    title: 'שתי לוחיות',
    objective: 'שני חפצים, שתי מטרות: לולאת לייזר לפי היקף ולוחית לפי שטח',
    modules: ['perimeter-area-ratio', 'similar-polygons'],
    skill: 'להבדיל: היקף ← ⟦k⟧, שטח ← ⟦k²⟧',
    misconception: 'אותו כלל לשניהם',
    room: { x0: -7, x1: 7, z0: -7, z1: 7, h: 5, theme: 'canvas' },
    spawn: { pos: [0, 6], yaw: 0 },
    exhibits: [
      {
        id: 'planter',
        name: 'אדנית',
        shape: { type: 'box', w: 1.5, h: 0.6, d: 1.5, look: 'planter' },
        pos: [-4.5, 3.5],
        yaw: 0,
        pedestal: 0,
        measures: { perimeter: len(6, 'היקף') },
        placard: ['אדנית ריבועית', "צלע ⟦1.5⟧ מ'"],
      },
      {
        id: 'mat',
        name: 'שטיחון',
        shape: { type: 'rug', w: 0.5, d: 0.5, look: 'mat' },
        pos: [4.5, 3.5],
        yaw: 0,
        pedestal: 0.8,
        measures: { area: area(0.25, 'שטח') },
        placard: ['שטיחון ריבועי', "⟦0.5 × 0.5⟧ מ'"],
      },
    ],
    targets: [
      {
        id: 'loop',
        accepts: 'planter',
        name: 'לולאת לייזר',
        anchor: [-3, 0, -3.5],
        yaw: 0,
        zone: { c: [-3, 0.5, -3.5], h: [1.6, 0.6, 1.6] },
        measure: 'perimeter',
        need: { measure: 'perimeter', value: 12 },
        plate: ['לולאת לייזר', "היקף ⟦12⟧ מ'"],
        tooBig: 'crash',
        tooSmall: 'gapLeft',
        success: 'open',
        socket: 'loop',
      },
      {
        id: 'plate',
        accepts: 'mat',
        name: 'לוחית לחץ',
        anchor: [3.5, 0, -3.5],
        yaw: 0,
        zone: { c: [3.5, 0.3, -3.5], h: [1.2, 0.4, 1.2] },
        measure: 'area',
        need: { measure: 'area', value: 4 },
        plate: ['לוחית לחץ ריבועית', 'שטח ⟦4⟧ מ"ר'],
        tooBig: 'crash',
        tooSmall: 'gapLeft',
        success: 'open',
        socket: 'plate',
      },
    ],
    pads: [
      { forId: 'planter', pos: [-4.5, 5], d: 1.5 },
      { forId: 'mat', pos: [4.5, 5], d: 1.5 },
    ],
    props: [
      { kind: 'laserLoop', min: [-4.5, -5], max: [-1.5, -2], y: 0.3 },
      { kind: 'laserLoop', min: [2.45, -4.55], max: [4.55, -2.45], y: 0.06 },
    ],
    rulers: [
      { origin: [-3, -3.5], dir: 0, from: 1.5, to: 9.5 },
      { origin: [3.5, -3.5], dir: 0, from: 1, to: 9.5 },
    ],
    hides: [[5.6, 5.8]],
    guardDoor: [0, -7],
    exit: { pos: [6.4, 0, 0], r: 0.9 },
    hint: ['לולאה: היקף מול היקף ← ⟦k⟧. לוחית: שטח מול שטח ← ⟦k²⟧.'],
  },
  {
    id: 15,
    world: 3,
    title: 'ויטראז׳',
    objective: 'מלאו את מסגרת הוויטראז׳ — רק צורה דומה תתאים',
    modules: ['similar-polygons', 'perimeter-area-ratio'],
    skill: 'העברה: מצולעים דומים — שטח פי 16, צלע פי 4; מלבן לא דומה לא נכנס',
    misconception: 'כל שני מצולעים באותו שטח "מתאימים"',
    room: { x0: -5, x1: 5, z0: -5, z1: 6, h: 4, theme: 'canvas' },
    spawn: { pos: [0, 5], yaw: 0 },
    exhibits: [
      {
        id: 'penta',
        name: 'זכוכית מחומשת',
        shape: { type: 'poly', pts: [[-0.04, 0], [0.04, 0], [0.04, 0.04], [0, 0.085], [-0.04, 0.04]], t: 0.006, look: 'glass' },
        pos: [-2, 1.5],
        yaw: 0,
        pedestal: 1.1,
        measures: { area: area(50, 'שטח', 'cm2'), wall: len(4, 'צלע', 'cm') },
        placard: ['זכוכית מחומשת', 'שטח ⟦50⟧ סמ"ר', 'צלע אנכית ⟦4⟧ ס"מ'],
      },
      {
        id: 'rect',
        name: 'זכוכית מלבנית',
        shape: { type: 'poly', pts: [[-0.05, 0], [0.05, 0], [0.05, 0.05], [-0.05, 0.05]], t: 0.006, look: 'glassRect' },
        pos: [2, 1.5],
        yaw: 0,
        pedestal: 1.1,
        measures: { area: area(50, 'שטח', 'cm2') },
        placard: ['זכוכית מלבנית', '⟦10 × 5⟧ ס"מ', 'שטח ⟦50⟧ סמ"ר'],
        similar: false,
      },
    ],
    targets: [
      {
        id: 'frame',
        accepts: 'penta',
        name: 'מסגרת ויטראז׳',
        anchor: [0, 1.4, -4.5],
        yaw: 0,
        zone: { c: [0, 1.57, -4.5], h: [0.45, 0.4, 0.3] },
        measure: 'area',
        need: { measure: 'area', value: 800 },
        plate: ['מסגרת ויטראז׳', 'שטח ⟦800⟧ סמ"ר'],
        tooBig: 'crash',
        tooSmall: 'fallThrough',
        success: 'open',
        socket: 'framePoly',
      },
    ],
    pads: [
      { forId: 'penta', pos: [-2, 2.3], d: 0.8 },
      { forId: 'rect', pos: [2, 2.3], d: 0.8 },
    ],
    props: [
      { kind: 'solid', min: [-0.5, 0, -4.7], max: [0.5, 1.4, -4.3], mat: 'wood' },
      { kind: 'window', pos: [-5, 2.2, -1], yaw: PI / 2, w: 1.4, h: 2.4 },
    ],
    rulers: [{ origin: [0, -4.5], dir: 0, from: 0.5, to: 9 }],
    hides: [[3.6, 4.2]],
    guardDoor: [-5, -3],
    exit: { pos: [-4.4, 0, 1], r: 0.9 },
    hint: [
      'קודם בדקו: איזו זכוכית דומה למסגרת — אותה צורה, לא רק אותו שטח?',
      'אחר כך השוו את שטח הזכוכית לשטח המסגרת — זה יחס שטחים, כלומר ⟦k²⟧.',
    ],
    noHints: false,
  },

  // ───────────── World 4 — The Vault (extension) ─────────────
  {
    id: 16,
    world: 4,
    title: 'משקל המעלית',
    objective: 'הפעילו את מעלית הכספת: היא זזה רק עם משקל של ⟦16⟧ ק"ג',
    tutorial: ['הרחבה: כשכל אורך גדל פי ⟦k⟧, הנפח — וגם המשקל — גדלים פי ⟦k³⟧ (שלושה ממדים).'],
    modules: ['perimeter-area-ratio'],
    extension: true,
    skill: 'הרחבה: נפח ומשקל ביחס ⟦k³⟧',
    misconception: 'k = 8 (משקל כמו אורך) או k = √8',
    room: { x0: -6, x1: 6, z0: -6, z1: 6, h: 4, theme: 'vault' },
    spawn: { pos: [0, 5], yaw: 0 },
    exhibits: [
      {
        id: 'gold',
        name: 'קוביית זהב',
        shape: { type: 'box', w: 0.2, h: 0.2, d: 0.2, look: 'gold' },
        pos: [-3.5, 2],
        yaw: 0,
        pedestal: 1,
        measures: { weight: weight(2, 'משקל') },
        placard: ['קוביית זהב', 'מקצוע ⟦20⟧ ס"מ · משקל ⟦2⟧ ק"ג'],
      },
    ],
    targets: [
      {
        id: 'elevator',
        accepts: 'gold',
        name: 'מעלית',
        anchor: [0, 0, -4.4],
        yaw: 0,
        zone: { c: [0, 0.5, -4.4], h: [1.1, 0.7, 1.1] },
        measure: 'weight',
        need: { measure: 'weight', value: 16 },
        plate: ['מעלית', 'משקל נדרש ⟦16⟧ ק"ג'],
        tooBig: 'crash',
        tooSmall: 'tooShort',
        success: 'open',
        socket: 'elevator',
      },
    ],
    pads: [{ forId: 'gold', pos: [-3.5, 3.2], d: 1.2 }],
    props: [{ kind: 'model', model: 'sarcophagus', pos: [4.5, 0, -4.5], h: 0.9, yaw: -0.4 }],
    rulers: [{ origin: [0, -4.4], dir: 0, from: 1, to: 10 }],
    hides: [[4, 3]],
    guardDoor: [-6, 0],
    exit: { pos: [5.4, 0, -2], r: 0.9 },
    hint: ['משקל הקובייה ⟦2⟧ מול המשקל הנדרש ⟦16⟧ — המשקל גדל כמו הנפח: יחס נפחים = ⟦k³⟧.'],
  },
  {
    id: 17,
    world: 4,
    title: 'מפתח חופף',
    objective: 'הכספת נפתחת רק במפתח חופף למקורי',
    modules: ['congruence-vs-similarity', 'similarity-concept'],
    skill: 'חפיפה = דמיון ביחס 1; ביטול הגדלה ביחס ⟦1/k⟧',
    misconception: 'כדי לבטל פי 2 מניחים שוב פי 2 (או מחסירים)',
    room: { x0: -6, x1: 6, z0: -6, z1: 6, h: 4, theme: 'vault' },
    spawn: { pos: [0, 5], yaw: 0 },
    exhibits: [
      {
        id: 'key',
        name: 'מפתח',
        shape: { type: 'key', l: 0.12 },
        pos: [3, 0],
        yaw: 0,
        pedestal: 1,
        measures: { length: len(12, 'אורך', 'cm') },
        placard: ['המפתח הגנוב', 'אורך עכשיו ⟦24⟧ ס"מ', '(הגדלתם אותו פי ⟦2⟧)'],
        initialScale: 2,
      },
    ],
    targets: [
      {
        id: 'keyhole',
        accepts: 'key',
        name: 'מנעול',
        anchor: [0, 1.2, -5.9],
        yaw: 0,
        zone: { c: [0, 1.3, -5.7], h: [0.5, 0.4, 0.5] },
        measure: 'length',
        need: { measure: 'length', value: 12 },
        plate: ['מנעול הכספת', 'רק מפתח חופף למקורי', 'מקורי: ⟦12⟧ ס"מ'],
        tooBig: 'crash',
        tooSmall: 'fallThrough',
        success: 'open',
        socket: 'keyhole',
      },
    ],
    pads: [{ forId: 'key', pos: [3, 3], d: 3 }],
    props: [
      { kind: 'model', model: 'sarcophagus', pos: [-4.6, 0, -4.4], h: 0.9, yaw: 0.5 },
      { kind: 'solid', min: [-1.8, 0, -6], max: [1.8, 3.2, -5.9], mat: 'steel' },
    ],
    rulers: [{ origin: [0, -5.9], dir: 0, from: 1, to: 11 }],
    hides: [[-4.5, 3]],
    guardDoor: [6, 2],
    exit: { pos: [4.3, 0, -5.2], r: 0.8 },
    hint: ['השוו את אורך המפתח עכשיו ⟦24⟧ לאורך המקורי ⟦12⟧ — יחס אורכים. איזה ⟦k⟧ מחזיר אותו ליחס ⟦1⟧ (חפיפה)?'],
  },

  // ───────────── Finale — the Grand Exit ─────────────
  {
    id: 18,
    world: 5,
    title: 'היציאה הגדולה',
    objective: 'שלושה צעדים ליציאה: מגדל לפי צללים, באנר מול המצלמה, ארגז בלולאת הלייזר',
    modules: ['real-life-similarity', 'perimeter-area-ratio', 'similar-triangles-aa'],
    skill: 'העברה סופית: צללים (ז.ז.), יחס שטחים, יחס היקפים — בלי רמזים',
    misconception: 'כל הטעויות: k מול k², k מול 1/k, צלעות לא מתאימות',
    noHints: true,
    room: { x0: -12, x1: 12, z0: -12, z1: 12, h: 60, theme: 'rooftop' },
    spawn: { pos: [0, 11], yaw: 0 },
    sun: { elevation: SHADOW_15_2, shadowDir: -PI / 2 },
    exhibits: [
      {
        id: 'ladder',
        name: 'סולם',
        shape: { type: 'ladder', h: 1.5, w: 0.45, d: 0.22 },
        pos: [-6, 8],
        yaw: 0,
        pedestal: 0,
        measures: { height: len(1.5, 'גובה') },
        placard: ['סולם', "גובה ⟦1.5⟧ מ'"],
      },
      {
        id: 'banner',
        name: 'באנר',
        shape: { type: 'banner', w: 0.5, h: 0.4 },
        pos: [2, 9],
        yaw: 0,
        pedestal: 1,
        measures: { area: area(0.2, 'שטח') },
        placard: ['באנר', "⟦0.5 × 0.4⟧ מ'"],
      },
      {
        id: 'crate',
        name: 'ארגז',
        shape: { type: 'box', w: 0.5, h: 0.5, d: 0.5, look: 'crate' },
        pos: [9, 9],
        yaw: 0,
        pedestal: 0,
        measures: { perimeter: len(2, 'היקף') },
        placard: ['ארגז', "בסיס ריבועי · צלע ⟦0.5⟧ מ'"],
      },
    ],
    targets: [
      {
        id: 'tower',
        accepts: 'ladder',
        name: 'ראש המגדל',
        anchor: [5.25, 0, -6],
        yaw: -PI / 2,
        zone: { c: [4.8, 1.5, -6], h: [0.9, 1.5, 1.0] },
        measure: 'height',
        need: { measure: 'height', value: 9 },
        plate: ['ראש המגדל', 'הגיעו אליו בדיוק'],
        tooBig: 'crash',
        tooSmall: 'tooShort',
        success: 'raccoon',
        socket: 'towerTop',
      },
      {
        id: 'billboard',
        accepts: 'banner',
        name: 'מסגרת מול המצלמה',
        anchor: [-6, 1, 2],
        yaw: PI / 2,
        zone: { c: [-5.8, 1.6, 2], h: [0.5, 0.9, 1.1] },
        measure: 'area',
        need: { measure: 'area', value: 1.8 },
        plate: ['מסגרת מול המצלמה', 'שטח ⟦1.8⟧ מ"ר', 'אותה צורה כמו הבאנר'],
        tooBig: 'crash',
        tooSmall: 'gapLeft',
        success: 'open',
        requires: 'tower',
        socket: 'billboard',
      },
      {
        id: 'loop',
        accepts: 'crate',
        name: 'לולאת לייזר',
        anchor: [-2, 0, -9],
        yaw: 0,
        zone: { c: [-2, 0.5, -9], h: [0.9, 0.6, 0.9] },
        measure: 'perimeter',
        need: { measure: 'perimeter', value: 5 },
        plate: ['לולאת לייזר', "היקף ⟦5⟧ מ'"],
        tooBig: 'crash',
        tooSmall: 'gapLeft',
        success: 'open',
        requires: 'billboard',
        socket: 'loop',
      },
    ],
    pads: [
      { forId: 'ladder', pos: [-6, 9], d: 1 },
      { forId: 'banner', pos: [2, 10.2], d: 1.2 },
      { forId: 'crate', pos: [9, 11], d: 2 },
    ],
    props: [
      { kind: 'solid', min: [5.25, 0, -6.75], max: [6.75, 9, -5.25], mat: 'stone' },
      { kind: 'solid', min: [7.85, 0, 5.85], max: [8.15, 1.5, 6.15], mat: 'stone' },
      { kind: 'sign', pos: [8, 1.9, 6.2], yaw: 0, lines: ['אובליסק', "גובה ⟦1.5⟧ מ'"], w: 0.8 },
      { kind: 'camera', pos: [-9.5, 3, 2], yaw: PI / 2 },
      { kind: 'laserLoop', min: [-2.625, -9.625], max: [-1.375, -8.375], y: 0.3 },
      { kind: 'model', model: 'statue', pos: [9, 0, -10], h: 3, yaw: -0.8 },
      { kind: 'model', model: 'bust', pos: [-9, 0.9, -11], h: 0.7, yaw: 0.6 },
    ],
    rulers: [
      { origin: [7.85, 6], dir: -PI / 2, from: 0, to: 3 },
      { origin: [5.25, -6], dir: -PI / 2, from: 0, to: 13 },
    ],
    hides: [
      [-9, 9],
      [9.5, -1],
      [-9.5, -6],
    ],
    guardDoor: [0, -12],
    patrol: [
      [-3, -3],
      [3, -3],
      [3, 3],
      [-3, 3],
    ],
    exit: { pos: [-10.8, 0, -10.8], r: 1.2 },
    hint: [],
  },
];

export function levelById(id: number): Level {
  const l = LEVELS.find((x) => x.id === id);
  if (!l) throw new Error(`no level ${id}`);
  return l;
}

export function worldLevels(world: number): Level[] {
  return LEVELS.filter((l) => l.world === world);
}

/** Is this level a world's transfer level (last of its world)? */
export function isTransfer(l: Level): boolean {
  const ws = worldLevels(l.world);
  return ws[ws.length - 1].id === l.id;
}
