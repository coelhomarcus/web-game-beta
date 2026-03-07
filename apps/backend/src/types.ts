export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface PlayerState {
  id: string;
  name: string;
  position: Vec3;
  rotation: Vec3;
  color: string;
  hp: number;
  isDead: boolean;
  isInvincible: boolean;
  face?: string;
}

export interface BoxBounds {
  cx: number;
  cz: number;
  cy: number;
  hw: number;
  hd: number;
  hh: number;
}
