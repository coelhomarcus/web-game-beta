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

export const KATANA_FP = {
  scale: [1, 1, 1] as [number, number, number],
  rotation: [0.9, 3.04, 0.2] as [number, number, number],
  position: [0.45, -0.65, -0.6] as [number, number, number],
  fpOffset: [0.05, 0.85, -1] as [number, number, number],
};

export const KATANA_3P = {
  scale: [1, 1, 1] as [number, number, number],
  rotation: [0.6, 3.14, 0] as [number, number, number],
  position: [0.2, 0.3, -0.9] as [number, number, number],
};


// ─── Debug helper ────────────────────────────────────────────────────────────
// Console: tweakKatana()   → adjust 1st person (FP)
// Console: tweakKatana3P() → adjust 3rd person (3P)
// Keys: Q/A pos.X  W/S pos.Y  E/D pos.Z  R/F rot.X  T/G rot.Y  Y/H rot.Z  U/J scale
// FP only: O/L fpOff.X  P/; fpOff.Y  [/' fpOff.Z
// Enter → print final values
if (import.meta.env.DEV) {
  function _tweakCfg(
    cfg: { scale: [number, number, number]; rotation: [number, number, number]; position: [number, number, number]; fpOffset?: [number, number, number] },
    label: string,
    refreshEvent: string,
  ) {
    const step = 0.05;
    const rotStep = 0.1;
    const hasFpOffset = !!cfg.fpOffset;
    const handler = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "q") cfg.position[0] += step;
      else if (k === "a") cfg.position[0] -= step;
      else if (k === "w") cfg.position[1] += step;
      else if (k === "s") cfg.position[1] -= step;
      else if (k === "e") cfg.position[2] += step;
      else if (k === "d") cfg.position[2] -= step;
      else if (k === "r") cfg.rotation[0] += rotStep;
      else if (k === "f") cfg.rotation[0] -= rotStep;
      else if (k === "t") cfg.rotation[1] += rotStep;
      else if (k === "g") cfg.rotation[1] -= rotStep;
      else if (k === "y") cfg.rotation[2] += rotStep;
      else if (k === "h") cfg.rotation[2] -= rotStep;
      else if (k === "u") { cfg.scale[0] += step; cfg.scale[1] += step; cfg.scale[2] += step; }
      else if (k === "j") { cfg.scale[0] -= step; cfg.scale[1] -= step; cfg.scale[2] -= step; }
      else if (hasFpOffset && k === "o") cfg.fpOffset![0] += step;
      else if (hasFpOffset && k === "l") cfg.fpOffset![0] -= step;
      else if (hasFpOffset && k === "p") cfg.fpOffset![1] += step;
      else if (hasFpOffset && k === ";") cfg.fpOffset![1] -= step;
      else if (hasFpOffset && k === "[") cfg.fpOffset![2] += step;
      else if (hasFpOffset && k === "'") cfg.fpOffset![2] -= step;
      else if (k === "enter") {
        console.log(`── ${label} final values ──`);
        console.log(`  scale: [${cfg.scale.map((v) => +v.toFixed(2))}]`);
        console.log(`  rotation: [${cfg.rotation.map((v) => +v.toFixed(2))}]`);
        console.log(`  position: [${cfg.position.map((v) => +v.toFixed(2))}]`);
        if (hasFpOffset) console.log(`  fpOffset: [${cfg.fpOffset!.map((v) => +v.toFixed(2))}]`);
        return;
      } else return;
      window.dispatchEvent(new CustomEvent(refreshEvent));
      const fpStr = hasFpOffset ? ` fpOff:[${cfg.fpOffset!.map((v) => +v.toFixed(2))}]` : "";
      console.log(
        `pos:[${cfg.position.map((v) => +v.toFixed(2))}] rot:[${cfg.rotation.map((v) => +v.toFixed(2))}] scale:[${cfg.scale.map((v) => +v.toFixed(2))}]${fpStr}`,
      );
    };
    window.addEventListener("keydown", handler);
    console.log(`${label} tweak ON. Q/A W/S E/D (pos), R/F T/G Y/H (rot), U/J (scale)${hasFpOffset ? ", O/L P/; [/' (fpOffset)" : ""}. Enter to print.`);
    return () => window.removeEventListener("keydown", handler);
  }

  (window as any).tweakKatana = () => _tweakCfg(KATANA_FP, "KATANA_FP", "weapon-switched-debug");
  (window as any).tweakKatana3P = () => _tweakCfg(KATANA_3P as any, "KATANA_3P", "weapon-switched-debug-3p");
}
