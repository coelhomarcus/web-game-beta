/**
 * Face crop modal — canvas-based image cropper.
 * Returns a 64×64 JPEG data-URL, or null if the user cancelled.
 */

const DISPLAY_SIZE = 280; // canvas px
const PAD = 40; // dimmed border around the crop square
const OUTPUT_SIZE = 64; // final image size

export function openFaceCropModal(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const blobUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(blobUrl);
      buildModal(img, resolve);
    };

    img.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      resolve(null);
    };

    img.src = blobUrl;
  });
}

// ─────────────────────────────────────────────────────────────────────────────

function buildModal(
  img: HTMLImageElement,
  resolve: (v: string | null) => void,
): void {
  const overlay = document.createElement("div");
  overlay.id = "face-crop-overlay";
  overlay.innerHTML = `
    <div id="face-crop-modal">
      <div class="face-crop-title">📷 Recortar Foto do Rosto</div>
      <div class="face-crop-hint">Arraste para reposicionar • Deslize para dar zoom</div>
      <canvas id="face-crop-canvas" width="${DISPLAY_SIZE}" height="${DISPLAY_SIZE}"></canvas>
      <div class="face-crop-zoom-row">
        <span class="face-crop-zoom-icon">🔍</span>
        <input type="range" id="face-crop-zoom" min="0.1" max="4" step="0.01" value="1" />
        <span class="face-crop-zoom-icon">🔎</span>
      </div>
      <div class="face-crop-buttons">
        <button id="face-crop-cancel">✕ Cancelar</button>
        <button id="face-crop-confirm">✓ Confirmar</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const canvas = document.getElementById(
    "face-crop-canvas",
  ) as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const zoomSlider = document.getElementById(
    "face-crop-zoom",
  ) as HTMLInputElement;
  const cancelBtn = document.getElementById("face-crop-cancel")!;
  const confirmBtn = document.getElementById("face-crop-confirm")!;

  // Initial scale: fill the crop area (PAD inset from each side)
  const cropPx = DISPLAY_SIZE - PAD * 2;
  const fitScale = Math.max(
    cropPx / img.naturalWidth,
    cropPx / img.naturalHeight,
  );
  let scale = fitScale;
  let offsetX = (DISPLAY_SIZE - img.naturalWidth * scale) / 2;
  let offsetY = (DISPLAY_SIZE - img.naturalHeight * scale) / 2;

  zoomSlider.min = String(Math.max(0.01, fitScale * 0.3));
  zoomSlider.max = String(fitScale * 5);
  zoomSlider.step = String(fitScale * 0.005);
  zoomSlider.value = String(scale);

  // ── Draw ──────────────────────────────────────────────────────────────────
  function draw() {
    ctx.clearRect(0, 0, DISPLAY_SIZE, DISPLAY_SIZE);

    // Background
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, DISPLAY_SIZE, DISPLAY_SIZE);

    // Image
    ctx.drawImage(
      img,
      offsetX,
      offsetY,
      img.naturalWidth * scale,
      img.naturalHeight * scale,
    );

    // Dim areas outside crop square
    ctx.fillStyle = "rgba(0,0,0,0.58)";
    ctx.fillRect(0, 0, DISPLAY_SIZE, PAD); // top
    ctx.fillRect(0, DISPLAY_SIZE - PAD, DISPLAY_SIZE, PAD); // bottom
    ctx.fillRect(0, PAD, PAD, cropPx); // left
    ctx.fillRect(DISPLAY_SIZE - PAD, PAD, PAD, cropPx); // right

    // Crop border (dashed white)
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(PAD + 1, PAD + 1, cropPx - 2, cropPx - 2);
    ctx.setLineDash([]);

    // Rule-of-thirds grid
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 1;
    const third = cropPx / 3;
    ctx.beginPath();
    for (let i = 1; i < 3; i++) {
      ctx.moveTo(PAD + third * i, PAD);
      ctx.lineTo(PAD + third * i, DISPLAY_SIZE - PAD);
      ctx.moveTo(PAD, PAD + third * i);
      ctx.lineTo(DISPLAY_SIZE - PAD, PAD + third * i);
    }
    ctx.stroke();
    ctx.restore();
  }

  // ── Drag ─────────────────────────────────────────────────────────────────
  let dragActive = false;
  let dragStartX = 0,
    dragStartY = 0,
    dragOffX = 0,
    dragOffY = 0;

  canvas.style.cursor = "grab";

  canvas.addEventListener("mousedown", (e) => {
    dragActive = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragOffX = offsetX;
    dragOffY = offsetY;
    canvas.style.cursor = "grabbing";
  });

  const onMouseMove = (e: MouseEvent) => {
    if (!dragActive) return;
    offsetX = dragOffX + (e.clientX - dragStartX);
    offsetY = dragOffY + (e.clientY - dragStartY);
    draw();
  };

  const onMouseUp = () => {
    dragActive = false;
    canvas.style.cursor = "grab";
  };

  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    dragActive = true;
    dragStartX = t.clientX;
    dragStartY = t.clientY;
    dragOffX = offsetX;
    dragOffY = offsetY;
  };

  const onTouchMove = (e: TouchEvent) => {
    if (!dragActive) return;
    const t = e.touches[0];
    offsetX = dragOffX + (t.clientX - dragStartX);
    offsetY = dragOffY + (t.clientY - dragStartY);
    draw();
  };

  const onTouchEnd = () => {
    dragActive = false;
  };

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  canvas.addEventListener("touchstart", onTouchStart);
  window.addEventListener("touchmove", onTouchMove);
  window.addEventListener("touchend", onTouchEnd);

  // ── Zoom ─────────────────────────────────────────────────────────────────
  zoomSlider.addEventListener("input", () => {
    const newScale = parseFloat(zoomSlider.value);
    // Zoom toward the crop-area centre
    const cx = DISPLAY_SIZE / 2;
    const cy = DISPLAY_SIZE / 2;
    offsetX = cx - (cx - offsetX) * (newScale / scale);
    offsetY = cy - (cy - offsetY) * (newScale / scale);
    scale = newScale;
    draw();
  });

  // ── Buttons ───────────────────────────────────────────────────────────────
  function cleanup() {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("touchend", onTouchEnd);
    overlay.remove();
  }

  cancelBtn.addEventListener("click", () => {
    cleanup();
    resolve(null);
  });

  confirmBtn.addEventListener("click", () => {
    // Map the crop square (in canvas px) back to image coordinates
    const srcX = (PAD - offsetX) / scale;
    const srcY = (PAD - offsetY) / scale;
    const srcW = cropPx / scale;
    const srcH = cropPx / scale;

    const out = document.createElement("canvas");
    out.width = OUTPUT_SIZE;
    out.height = OUTPUT_SIZE;
    const outCtx = out.getContext("2d")!;
    outCtx.drawImage(
      img,
      srcX,
      srcY,
      srcW,
      srcH,
      0,
      0,
      OUTPUT_SIZE,
      OUTPUT_SIZE,
    );

    const dataUrl = out.toDataURL("image/jpeg", 0.88);
    cleanup();
    resolve(dataUrl);
  });

  draw();
}
