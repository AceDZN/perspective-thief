// Prints a compact JSON summary of every authored level (positions only) for the playtest scripts.
import { LEVELS } from '../../src/levels.ts';
const out = LEVELS.map((l) => ({
  id: l.id, title: l.title, room: l.room, spawn: l.spawn, exit: l.exit, hides: l.hides, guardDoor: l.guardDoor, patrol: l.patrol,
  pads: l.pads, noHints: l.noHints, hint: l.hint, objective: l.objective, tutorial: l.tutorial,
  exhibits: l.exhibits.map((e) => ({ id: e.id, pos: e.pos, pedestal: e.pedestal, placard: e.placard, similar: e.similar, measures: e.measures })),
  targets: l.targets.map((t) => ({ id: t.id, accepts: t.accepts, anchor: t.anchor, zone: t.zone, plate: t.plate, need: t.need, measure: t.measure, tooBig: t.tooBig, tooSmall: t.tooSmall, orientation: t.orientation, requires: t.requires })),
}));
console.log(JSON.stringify(out));
