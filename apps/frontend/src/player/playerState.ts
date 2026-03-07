import * as THREE from "three";

// Shared mutable state accessed by multiple player subsystems.
export const otherPlayers: Record<string, THREE.Group> = {};
export const playerOriginalMaterial: Record<
  string,
  THREE.MeshStandardMaterial
> = {};
export const playerCurrentNames: Record<string, string> = {};

// Network interpolation targets — updated on game_state, consumed every render frame
export const networkTargets: Map<string, THREE.Vector3> = new Map();
