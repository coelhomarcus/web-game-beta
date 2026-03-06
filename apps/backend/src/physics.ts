import { Vec3, BoxBounds } from './types';
import { MAP_BOXES } from './map';
import { SPAWN_PLAYER_RADIUS, PLAYER_RADIUS_SRV, PLAYER_HEIGHT_SRV } from './config';

export function isInsideBox(x: number, z: number): boolean {
    return MAP_BOXES.some(b =>
        Math.abs(x - b.cx) < b.hw + SPAWN_PLAYER_RADIUS &&
        Math.abs(z - b.cz) < b.hd + SPAWN_PLAYER_RADIUS
    );
}

export function resolveBoxCollision(pos: Vec3, box: BoxBounds): void {
    const hw = box.hw + PLAYER_RADIUS_SRV;
    const hd = box.hd + PLAYER_RADIUS_SRV;
    const pBot = pos.y - PLAYER_HEIGHT_SRV;
    const pTop = pos.y;
    const bBot = box.cy - box.hh;
    const bTop = box.cy + box.hh;
    const ox = hw - Math.abs(pos.x - box.cx);
    const oy = Math.min(pTop, bTop) - Math.max(pBot, bBot);
    const oz = hd - Math.abs(pos.z - box.cz);
    if (ox > 0 && oy > 0 && oz > 0) {
        if (ox < oz && ox < oy) {
            pos.x += ox * Math.sign(pos.x - box.cx);
        } else if (oz < ox && oz < oy) {
            pos.z += oz * Math.sign(pos.z - box.cz);
        } else if (pos.y > box.cy) {
            pos.y = bTop + PLAYER_HEIGHT_SRV;
        } else {
            pos.y = bBot - 0.01;
        }
    }
}

export function getRandomSpawn(): Vec3 {
    let x: number, z: number;
    let attempts = 0;
    do {
        x = (Math.random() - 0.5) * 36;
        z = (Math.random() - 0.5) * 36;
        attempts++;
    } while (isInsideBox(x, z) && attempts < 50);
    return { x, y: 1, z };
}
