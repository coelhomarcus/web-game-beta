export const SOCKET_URL = import.meta.env.DEV ? "http://localhost:3005" : window.location.origin;

export const PLAYER_HEIGHT = 1.6;
export const PLAYER_RADIUS = 0.4;
export const GRAVITY = -25;
export const JUMP_FORCE = 8;
export const ACCELERATION = 100;
export const FRICTION = 12;

export const BULLET_SPEED = 60.0;
export const BULLET_MAX_LIFETIME = 2.0;
export const BULLET_RADIUS = 0.06;

export const GRENADE_FUSE = 2.0;
export const GRENADE_COOLDOWN = 12.0;
export const GRENADE_GRAVITY = -18;
export const GRENADE_THROW_SPD = 14;
export const GRENADE_THROW_UP = 6;

export const MAG_SIZE = 20; // Default (AR) mag size for initial HUD display
export const INVINCIBLE_TIME = 3000;
