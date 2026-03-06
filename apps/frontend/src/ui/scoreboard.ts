import type { Stats } from "../types";

export const allStats: Record<string, Stats> = {};

let myIdRef = "";
export function setMyIdRef(id: string) { myIdRef = id; }

const scoreBody = document.getElementById("scoreboard-body")!;

export function renderScoreboard() {
  const rows = Object.entries(allStats).sort((a, b) => b[1].kills - a[1].kills);
  scoreBody.innerHTML = "";
  for (const [id, s] of rows) {
    const kd =
      s.deaths > 0 ? (s.kills / s.deaths).toFixed(2) : s.kills.toString();
    const tr = document.createElement("tr");
    if (id === myIdRef) tr.classList.add("my-row");
    tr.innerHTML = `<td><span class="player-dot" style="background:${s.color}"></span>${s.name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${kd}</td>`;
    scoreBody.appendChild(tr);
  }
}
