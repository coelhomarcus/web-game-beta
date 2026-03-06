"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isInsideBox = isInsideBox;
exports.resolveBoxCollision = resolveBoxCollision;
exports.getRandomSpawn = getRandomSpawn;
const map_1 = require("./map");
const config_1 = require("./config");
function isInsideBox(x, z) {
    return map_1.MAP_BOXES.some(b => Math.abs(x - b.cx) < b.hw + config_1.SPAWN_PLAYER_RADIUS &&
        Math.abs(z - b.cz) < b.hd + config_1.SPAWN_PLAYER_RADIUS);
}
function resolveBoxCollision(pos, box) {
    const hw = box.hw + config_1.PLAYER_RADIUS_SRV;
    const hd = box.hd + config_1.PLAYER_RADIUS_SRV;
    const pBot = pos.y - config_1.PLAYER_HEIGHT_SRV;
    const pTop = pos.y;
    const bBot = box.cy - box.hh;
    const bTop = box.cy + box.hh;
    const ox = hw - Math.abs(pos.x - box.cx);
    const oy = Math.min(pTop, bTop) - Math.max(pBot, bBot);
    const oz = hd - Math.abs(pos.z - box.cz);
    if (ox > 0 && oy > 0 && oz > 0) {
        if (ox < oz && ox < oy) {
            pos.x += ox * Math.sign(pos.x - box.cx);
        }
        else if (oz < ox && oz < oy) {
            pos.z += oz * Math.sign(pos.z - box.cz);
        }
        else if (pos.y > box.cy) {
            pos.y = bTop + config_1.PLAYER_HEIGHT_SRV;
        }
        else {
            pos.y = bBot - 0.01;
        }
    }
}
function getRandomSpawn() {
    let x, z;
    let attempts = 0;
    do {
        x = (Math.random() - 0.5) * 36;
        z = (Math.random() - 0.5) * 36;
        attempts++;
    } while (isInsideBox(x, z) && attempts < 50);
    return { x, y: 1, z };
}
