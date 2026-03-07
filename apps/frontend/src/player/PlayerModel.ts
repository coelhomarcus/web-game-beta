// --- PlayerModel barrel -------------------------------------------------------
// All public APIs re-exported from their respective sub-modules.
// Existing imports anywhere in the codebase continue to work unchanged.

export { otherPlayers, playerOriginalMaterial, playerCurrentNames } from "./playerState";

export { FAL_FP, AWP_FP, FAL_3P, AWP_3P } from "./weaponConfig";

export { makeWeapon, makeAwpModel, makeFirstPersonArms } from "./weaponModels";

export {
  addOtherPlayer,
  removeOtherPlayer,
  applyFaceTexture,
  applyPlayerColor,
  swapOtherPlayerWeapon,
  createLocalCorpse,
  getLocalCorpseGroup,
  cleanupLocalCorpse,
} from "./playerBody";

export {
  isRagdollActive,
  triggerRagdoll,
  cleanupRagdoll,
  updateRagdolls,
  isFlinging,
  triggerShoutFling,
  updateFlings,
} from "./ragdollSystem";

export { updatePlayerAnimations } from "./walkAnimation";

export {
  flashPlayerHit,
  isPlayerInvincible,
  startInvincibleBlink,
  stopInvincibleBlink,
  showDamageNumber,
  updateFloatingDamageNumbers,
} from "./playerEffects";
