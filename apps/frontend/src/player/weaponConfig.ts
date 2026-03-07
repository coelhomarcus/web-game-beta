// ─── Weapon transform configs ─────────────────────────────────────────────────
// Each has: scale [x,y,z], rotation [x,y,z] (radians), position [x,y,z]

export const FAL_FP = {
  scale: [2, 2, 2] as [number, number, number],
  rotation: [0, Math.PI, 0] as [number, number, number],
  position: [0.3, -0.75, -0.5] as [number, number, number],
  fpOffset: [0, 0, 0] as [number, number, number],
};

export const AWP_FP = {
  scale: [0.1, 0.1, 0.1] as [number, number, number],
  rotation: [0, 1.5, 0] as [number, number, number],
  position: [0.65, -0.35, -0.5] as [number, number, number],
  fpOffset: [0, 0, -0.6] as [number, number, number],
};

export const FAL_3P = {
  scale: [2, 2, 2] as [number, number, number],
  rotation: [0, Math.PI, 0] as [number, number, number],
  position: [0.08, -0.2, -0.42] as [number, number, number],
};

export const AWP_3P = {
  scale: [0.1, 0.1, 0.1] as [number, number, number],
  rotation: [0, 1.5, 0] as [number, number, number],
  position: [0.08, 0.1, -0.42] as [number, number, number],
};
