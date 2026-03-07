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
  isSliding?: boolean;
  weaponId?: string;
}

export interface Stats {
  name: string;
  kills: number;
  deaths: number;
  assists: number;
  color: string;
}

// ─── Abilities ───────────────────────────────────────────────────────────────

export interface Ability {
  id: string;
  name: string;
  description: string;
  icon: string;
  /** Called when the player activates it (Z). Returns true if the ability is consumed. */
  execute: () => boolean;
}
