"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAP_BOXES = void 0;
function makeRng() {
    let s = 42;
    return () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 2 ** 32; };
}
exports.MAP_BOXES = [];
const rng = makeRng();
for (let i = 0; i < 20; i++) {
    const h = rng() * 4 + 1;
    const x = (rng() - 0.5) * 40;
    const z = (rng() - 0.5) * 40;
    exports.MAP_BOXES.push({ cx: x, cz: z, cy: h / 2, hw: 1, hd: 1, hh: h / 2 });
}
