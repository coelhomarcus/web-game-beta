import * as THREE from "three";

const textureCache: Record<string, THREE.Texture> = {};
const dataUrlCache: Record<string, string> = {};
const loader = new THREE.TextureLoader();

/**
 * Store a face photo (base64 data-URL) for a player id.
 * Use "__local__" for the local player.
 */
export function storeFaceDataUrl(id: string, dataUrl: string): THREE.Texture {
  if (textureCache[id]) {
    textureCache[id].dispose();
  }
  dataUrlCache[id] = dataUrl;
  const tex = loader.load(dataUrl);
  tex.colorSpace = THREE.SRGBColorSpace;
  // Un-mirror the texture so it looks correct after the face plane's rotation.y = Math.PI
  tex.repeat.set(-1, 1);
  tex.offset.set(1, 0);
  tex.wrapS = THREE.RepeatWrapping;
  textureCache[id] = tex;
  return tex;
}

export function getFaceTexture(id: string): THREE.Texture | null {
  return textureCache[id] ?? null;
}

export function getFaceDataUrl(id: string): string | null {
  return dataUrlCache[id] ?? null;
}

export function disposeFaceTexture(id: string): void {
  textureCache[id]?.dispose();
  delete textureCache[id];
  delete dataUrlCache[id];
}

/**
 * Extract the most visually dominant (saturated, non-grey) colour from a
 * face image given as a data-URL.  Returns a CSS hex string like "#a3c2f0".
 *
 * Algorithm:
 *  1. Draw the image into a small 24×24 canvas (fast, cheap).
 *  2. Skip near-transparent, near-black, and near-white pixels.
 *  3. Quantise each remaining pixel to a 5-bit RGB bucket (32³ ≈ 32 k slots).
 *  4. Return the bucket colour with the highest count.
 */
export function extractDominantColor(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const SIZE = 24;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = SIZE;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, SIZE, SIZE);
      const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

      const counts: Record<number, number> = {};
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i],
          g = data[i + 1],
          b = data[i + 2],
          a = data[i + 3];
        if (a < 128) continue; // transparent
        const brightness = (r + g + b) / 3;
        if (brightness < 25 || brightness > 230) continue; // too dark / too light

        // 5-bit quantisation (>> 3 maps 0-255 to 0-31)
        const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
        counts[key] = (counts[key] ?? 0) + 1;
      }

      let bestKey = -1,
        bestCount = 0;
      for (const [k, c] of Object.entries(counts)) {
        if (c > bestCount) {
          bestCount = c;
          bestKey = Number(k);
        }
      }

      if (bestKey === -1) {
        resolve("#c68642");
        return;
      } // fallback skin tone

      const r = ((bestKey >> 10) & 0x1f) << 3;
      const g = ((bestKey >> 5) & 0x1f) << 3;
      const b = (bestKey & 0x1f) << 3;
      resolve(
        "#" +
          r.toString(16).padStart(2, "0") +
          g.toString(16).padStart(2, "0") +
          b.toString(16).padStart(2, "0"),
      );
    };
    img.onerror = () => resolve("#c68642");
    img.src = dataUrl;
  });
}
