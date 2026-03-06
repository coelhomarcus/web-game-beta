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
}

export interface Stats {
  name: string;
  kills: number;
  deaths: number;
  color: string;
}
