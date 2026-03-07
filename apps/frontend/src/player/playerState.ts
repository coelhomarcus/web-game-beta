import * as THREE from "three";

// Shared mutable state accessed by multiple player subsystems.
export const otherPlayers: Record<string, THREE.Group> = {};
export const playerOriginalMaterial: Record<
  string,
  THREE.MeshStandardMaterial
> = {};
export const playerCurrentNames: Record<string, string> = {};
