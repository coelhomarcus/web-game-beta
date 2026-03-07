export const DEFAULT_PLAYER_NAME = "Anonimo";
export const PLAYER_NAME_MAX_LEN = 16;

export function sanitizePlayerName(name: string): string {
  const clean = (name ?? "").trim().slice(0, PLAYER_NAME_MAX_LEN);
  return clean || DEFAULT_PLAYER_NAME;
}
