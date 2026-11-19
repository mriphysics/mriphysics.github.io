import { fft2d, shift2d } from "./fft.js?v=physical-1";
import { createTeachingPhantom, MASTER_FOV_MM, MASTER_SIZE, MASTER_VOXEL_MM } from "./phantom.js?v=physical-2";

const DISPLAY_SIZE = 256;
const DEFAULT_FOV_MM = 200;
const TR_MS = 10;
const MASTER_DK = 2 * Math.PI / MASTER_FOV_MM;
const MASTER_KMAX = Math.PI / MASTER_VOXEL_MM;
const KSPACE_FULL_VOXEL_MM = 1;
const KSPACE_FULL_KMAX = Math.PI / KSPACE_FULL_VOXEL_MM;

const els = Object.fromEntries([
  "kspaceMode", "imageMode", "kspaceControls", "imageControls", "controlsTitle",
  "resolution", "resolutionValue", "fov", "fovValue", "asymmetric", "both",
  "imageFovX", "imageFovY", "imageFovXValue", "imageFovYValue",
  "imageResolutionX", "imageResolutionY", "imageResolutionXValue", "imageResolutionYValue",
  "phaseDirection", "status", "fovMetric", "voxelLabel", "voxelMetric", "interpretation",
  "modeReadout", "matrixReadout", "voxelReadout", "deltaKReadout", "kmaxReadout",
  "phaseLinesLabel", "phaseLinesReadout", "scanTimeReadout", "kspaceCanvas", "imageCanvas",
  "resetButton", "howButton",
].map((id) => [id, document.querySelector(`#${id}`)]));

let controlMode = "kspace";
let updateTimer;
let masterKReal;
let masterKImag;
let cachedFilterKey = "";
let cachedSpatial;

function centredAxis(fov, count) {
  const dk = 2 * Math.PI / fov;
  return Array.from({ length: count }, (_, i) => (i - count / 2) * dk);
}

function evenCount(fov, voxel) {
  let count = Math.max(2, Math.ceil(fov / voxel));
  if (count % 2) count += 1;
  return Math.min(MASTER_SIZE, count);
}

function symmetricAxis(fov, kmax) {
  const dk = 2 * Math.PI / fov;
  let count = Math.max(2, Math.ceil(2 * kmax / dk));
  if (count % 2) count += 1;
  count = Math.min(MASTER_SIZE, count);
  return centredAxis(fov, count);
}

function asymmetricAxis(fov, positiveKmax) {
  const dk = 2 * Math.PI / fov;
  const first = Math.ceil(-KSPACE_FULL_KMAX / dk);
  const last = Math.floor(positiveKmax / dk);
  return Array.from({ length: Math.max(2, last - first + 1) }, (_, i) => (first + i) * dk);
}

function settings() {
  if (controlMode === "image") {
    const fovX = Number(els.imageFovX.value);
    const fovY = Number(els.imageFovY.value);
    const samplesX = evenCount(fovX, Number(els.imageResolutionX.value));
    const samplesY = evenCount(fovY, Number(els.imageResolutionY.value));
    const voxelX = fovX / samplesX;
    const voxelY = fovY / samplesY;
    return {
      mode: "image", fovX, fovY, samplesX, samplesY, voxelX, voxelY,
      xCoords: centredAxis(fovX, samplesX), yCoords: centredAxis(fovY, samplesY),
      xmin: -Math.PI / voxelX, xmax: Math.PI / voxelX,
      ymin: -Math.PI / voxelY, ymax: Math.PI / voxelY,
      phaseDirection: els.phaseDirection.value, asymmetric: false,
    };
  }

  const extent = Number(els.resolution.value);
  const fovX = Number(els.fov.value);
  const both = els.both.checked;
  const asymmetric = els.asymmetric.checked;
  const fovY = both ? fovX : DEFAULT_FOV_MM;
  const positiveKmax = extent * KSPACE_FULL_KMAX;
  const xCoords = asymmetric ? asymmetricAxis(fovX, positiveKmax) : symmetricAxis(fovX, positiveKmax);
  const yCoords = both
    ? (asymmetric ? asymmetricAxis(fovY, positiveKmax) : symmetricAxis(fovY, positiveKmax))
    : symmetricAxis(fovY, KSPACE_FULL_KMAX);
  const voxelX = asymmetric ? KSPACE_FULL_VOXEL_MM : fovX / xCoords.length;
  const voxelY = both ? (asymmetric ? KSPACE_FULL_VOXEL_MM : fovY / yCoords.length) : KSPACE_FULL_VOXEL_MM;
  return {
    mode: "kspace", fovX, fovY, samplesX: xCoords.length, samplesY: yCoords.length,
    voxelX, voxelY, xCoords, yCoords, extent, asymmetric, both,
    xmin: asymmetric ? -KSPACE_FULL_KMAX : -positiveKmax, xmax: positiveKmax,
    ymin: both ? (asymmetric ? -KSPACE_FULL_KMAX : -positiveKmax) : -KSPACE_FULL_KMAX,
    ymax: both ? positiveKmax : KSPACE_FULL_KMAX,
    phaseDirection: "x",
  };
}

function updateControlDisplays() {
  els.resolutionValue.value = `${Math.round(Number(els.resolution.value) * 100)}%`;
  els.fovValue.value = `${Number(els.fov.value).toFixed(0)} mm`;
  els.imageFovXValue.value = `${Number(els.imageFovX.value).toFixed(0)} mm`;
  els.imageFovYValue.value = `${Number(els.imageFovY.value).toFixed(0)} mm`;
  els.imageResolutionXValue.value = `${Number(els.imageResolutionX.value).toFixed(1)} mm`;
  els.imageResolutionYValue.value = `${Number(els.imageResolutionY.value).toFixed(1)} mm`;
}

function scheduleUpdate() {
  updateControlDisplays();
  els.status.textContent = "Updating";
  clearTimeout(updateTimer);
  updateTimer = setTimeout(runExperiment, 90);
}

function setMode(mode) {
  controlMode = mode;
  const imageMode = mode === "image";
  els.kspaceControls.hidden = imageMode;
  els.imageControls.hidden = !imageMode;
  els.kspaceMode.classList.toggle("active", !imageMode);
  els.imageMode.classList.toggle("active", imageMode);
  els.kspaceMode.setAttribute("aria-pressed", String(!imageMode));
  els.imageMode.setAttribute("aria-pressed", String(imageMode));
  els.controlsTitle.textContent = imageMode ? "Image prescription" : "K-space controls";
  scheduleUpdate();
}

function filteredSpatial(config) {
  const key = [config.xmin, config.xmax, config.ymin, config.ymax].map((v) => v.toFixed(5)).join("/");
  if (key === cachedFilterKey) return cachedSpatial;
  const real = masterKReal.slice();
  const imag = masterKImag.slice();
  const half = MASTER_SIZE / 2;
  for (let y = 0; y < MASTER_SIZE; y += 1) {
    const ky = (y - half) * MASTER_DK;
    for (let x = 0; x < MASTER_SIZE; x += 1) {
      const kx = (x - half) * MASTER_DK;
      if (kx < config.xmin || kx >= config.xmax || ky < config.ymin || ky >= config.ymax) {
        const index = y * MASTER_SIZE + x;
        real[index] = 0;
        imag[index] = 0;
      }
    }
  }
  shift2d(real, imag, MASTER_SIZE);
  fft2d(real, imag, MASTER_SIZE, true);
  cachedFilterKey = key;
  cachedSpatial = { real, imag };
  return cachedSpatial;
}

function bilinear(real, imag, xMm, yMm) {
  const fx = xMm / MASTER_VOXEL_MM + MASTER_SIZE / 2;
  const fy = yMm / MASTER_VOXEL_MM + MASTER_SIZE / 2;
  if (fx < 0 || fy < 0 || fx >= MASTER_SIZE - 1 || fy >= MASTER_SIZE - 1) return [0, 0];
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = fx - x0, ty = fy - y0;
  const i00 = y0 * MASTER_SIZE + x0;
  const i10 = i00 + 1;
  const i01 = i00 + MASTER_SIZE;
  const i11 = i01 + 1;
  const a = (1 - tx) * (1 - ty), b = tx * (1 - ty), c = (1 - tx) * ty, d = tx * ty;
  return [
    a * real[i00] + b * real[i10] + c * real[i01] + d * real[i11],
    a * imag[i00] + b * imag[i10] + c * imag[i01] + d * imag[i11],
  ];
}

function foldedMagnitude(spatial, config, width, height) {
  const magnitude = new Float32Array(width * height);
  const halfMaster = MASTER_FOV_MM / 2;
  for (let py = 0; py < height; py += 1) {
    const y = ((py + .5) / height - .5) * config.fovY;
    const yFirst = Math.ceil((-halfMaster - y) / config.fovY);
    const yLast = Math.floor((halfMaster - MASTER_VOXEL_MM - y) / config.fovY);
    for (let px = 0; px < width; px += 1) {
      const x = ((px + .5) / width - .5) * config.fovX;
      const xFirst = Math.ceil((-halfMaster - x) / config.fovX);
      const xLast = Math.floor((halfMaster - MASTER_VOXEL_MM - x) / config.fovX);
      let sumR = 0, sumI = 0;
      for (let yi = yFirst; yi <= yLast; yi += 1) {
        for (let xi = xFirst; xi <= xLast; xi += 1) {
          const [r, i] = bilinear(spatial.real, spatial.imag, x + xi * config.fovX, y + yi * config.fovY);
          sumR += r; sumI += i;
        }
      }
      magnitude[py * width + px] = Math.hypot(sumR, sumI);
    }
  }
  return magnitude;
}

function kspaceSample(kx, ky) {
  const fx = kx / MASTER_DK + MASTER_SIZE / 2;
  const fy = ky / MASTER_DK + MASTER_SIZE / 2;
  if (fx < 0 || fy < 0 || fx >= MASTER_SIZE - 1 || fy >= MASTER_SIZE - 1) return 0;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = fx - x0, ty = fy - y0;
  const i00 = y0 * MASTER_SIZE + x0, i10 = i00 + 1, i01 = i00 + MASTER_SIZE, i11 = i01 + 1;
  const a = (1 - tx) * (1 - ty), b = tx * (1 - ty), c = (1 - tx) * ty, d = tx * ty;
  const r = a * masterKReal[i00] + b * masterKReal[i10] + c * masterKReal[i01] + d * masterKReal[i11];
  const i = a * masterKImag[i00] + b * masterKImag[i10] + c * masterKImag[i01] + d * masterKImag[i11];
  return Math.log1p(Math.hypot(r, i));
}

function canvasPixels(canvas, width = DISPLAY_SIZE, height = DISPLAY_SIZE) {
  const context = canvas.getContext("2d", { alpha: false });
  const image = context.createImageData(width, height);
  return { context, image, data: image.data };
}

function drawKspace(config) {
  const values = new Float32Array(DISPLAY_SIZE * DISPLAY_SIZE);
  let max = 0;
  for (const ky of config.yCoords) {
    const py = Math.round((ky / (2 * MASTER_KMAX) + .5) * (DISPLAY_SIZE - 1));
    if (py < 0 || py >= DISPLAY_SIZE) continue;
    for (const kx of config.xCoords) {
      const px = Math.round((kx / (2 * MASTER_KMAX) + .5) * (DISPLAY_SIZE - 1));
      if (px < 0 || px >= DISPLAY_SIZE) continue;
      const value = kspaceSample(kx, ky);
      const index = py * DISPLAY_SIZE + px;
      values[index] = Math.max(values[index], value);
      max = Math.max(max, value);
    }
  }
  const { context, image, data } = canvasPixels(els.kspaceCanvas);
  for (let i = 0; i < values.length; i += 1) {
    const value = max ? Math.pow(values[i] / max, .52) : 0;
    const p = i * 4;
    data[p] = Math.round(4 + value * 225);
    data[p + 1] = Math.round(13 + value * 220);
    data[p + 2] = Math.round(20 + value * 211);
    data[p + 3] = 255;
  }
  context.putImageData(image, 0, 0);
}

function drawMagnitude(magnitude, width, height) {
  const sorted = Float32Array.from(magnitude).sort();
  const ceiling = sorted[Math.floor(sorted.length * .997)] || 1;
  els.imageCanvas.width = width;
  els.imageCanvas.height = height;
  els.imageCanvas.style.setProperty("--image-display-width", `${100 * width / DISPLAY_SIZE}%`);
  const { context, image, data } = canvasPixels(els.imageCanvas, width, height);
  for (let i = 0; i < magnitude.length; i += 1) {
    const value = Math.min(1, magnitude[i] / ceiling);
    const gray = Math.round(Math.pow(value, .88) * 255);
    const p = i * 4;
    data[p] = gray; data[p + 1] = gray; data[p + 2] = gray; data[p + 3] = 255;
  }
  context.putImageData(image, 0, 0);
}

function updateReadouts(config) {
  const phaseLines = config.phaseDirection === "y" ? config.samplesY : config.samplesX;
  const dkX = 2 * Math.PI / config.fovX, dkY = 2 * Math.PI / config.fovY;
  els.fovMetric.textContent = `${formatMm(config.fovX)} × ${formatMm(config.fovY)} mm`;
  els.voxelLabel.textContent = config.asymmetric ? "Nominal voxel" : config.mode === "image" ? "Achieved voxel" : "Effective voxel";
  els.voxelMetric.textContent = `${config.voxelX.toFixed(2)} × ${config.voxelY.toFixed(2)} mm`;
  els.modeReadout.textContent = config.mode === "image" ? "Image prescribed" : "K-space driven";
  els.matrixReadout.textContent = `${config.samplesX} × ${config.samplesY}`;
  els.voxelReadout.textContent = `${config.voxelX.toFixed(2)} × ${config.voxelY.toFixed(2)} mm`;
  els.deltaKReadout.textContent = `${dkX.toFixed(3)} / ${dkY.toFixed(3)} rad/mm`;
  els.kmaxReadout.textContent = config.asymmetric
    ? `${signedSpan(config.xmin, config.xmax)} / ${signedSpan(config.ymin, config.ymax)} rad/mm`
    : `${Math.max(Math.abs(config.xmin), config.xmax).toFixed(2)} / ${Math.max(Math.abs(config.ymin), config.ymax).toFixed(2)} rad/mm`;
  els.phaseLinesLabel.textContent = `Phase lines (${config.phaseDirection})`;
  els.phaseLinesReadout.textContent = String(phaseLines);
  els.scanTimeReadout.textContent = formatTime(phaseLines * TR_MS);

  const notes = [];
  if (config.mode === "image") {
    notes.push(`The prescription requires a ${config.samplesX} × ${config.samplesY} Cartesian grid; the displayed voxel size is the achievable value after rounding to whole samples.`);
    if (config.fovX > 220 || config.fovY > 220) notes.push("The larger FOV mainly adds background around this fixed-size object. If the phase FOV grows, the additional phase-encode lines lengthen the projected scan.");
    if (config.fovX < 190 || config.fovY < 190) notes.push("Anatomy outside the encoded FOV folds back into the image as wrap-around aliasing.");
    if (config.voxelX >= 3 || config.voxelY >= 3) notes.push("Compare the 2–8 mm discs: the smallest targets disappear first as spatial resolution becomes coarser.");
  } else {
    if (config.extent < .99 && !config.asymmetric) notes.push("Symmetric reduction of k-space extent increases effective voxel size and blurs the smallest resolution targets.");
    if (config.extent < .99 && config.asymmetric) notes.push("One high-frequency side is retained, so the nominal voxel size is unchanged; zero-filling the missing side instead changes the point-spread function and can introduce phase-sensitive ringing.");
    if (config.fovX < 190 || config.fovY < 190) notes.push("The wider k-space spacing reduces encoded FOV and produces wrap-around.");
    if (config.fovX > 220) notes.push("Finer k-space spacing increases encoded FOV. The anatomy itself changes little, while the larger x phase-encode matrix increases scan time.");
  }
  if (!notes.length) notes.push("The full teaching extent gives 1 mm resolution; the 200 mm FOV closely frames the phantom.");
  els.interpretation.textContent = notes.join(" ");
}

function runExperiment() {
  if (!masterKReal) return;
  const config = settings();
  const spatial = filteredSpatial(config);
  const longestFov = Math.max(config.fovX, config.fovY);
  const imageWidth = Math.max(1, Math.round(DISPLAY_SIZE * config.fovX / longestFov));
  const imageHeight = Math.max(1, Math.round(DISPLAY_SIZE * config.fovY / longestFov));
  drawKspace(config);
  drawMagnitude(foldedMagnitude(spatial, config, imageWidth, imageHeight), imageWidth, imageHeight);
  updateReadouts(config);
  els.status.textContent = "Live";
}

function initialise() {
  els.status.textContent = "Preparing";
  const phantom = createTeachingPhantom();
  masterKReal = phantom.slice();
  masterKImag = new Float64Array(phantom.length);
  fft2d(masterKReal, masterKImag, MASTER_SIZE);
  shift2d(masterKReal, masterKImag, MASTER_SIZE);
  scheduleUpdate();
}

function reset() {
  els.resolution.value = "1"; els.fov.value = "200";
  els.asymmetric.checked = false; els.both.checked = false;
  els.imageFovX.value = "200"; els.imageFovY.value = "200";
  els.imageResolutionX.value = "1.6"; els.imageResolutionY.value = "1.6";
  els.phaseDirection.value = "y";
  scheduleUpdate();
}

function formatMm(value) { return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1); }
function formatTime(ms) { return ms < 1000 ? `${ms.toFixed(0)} ms` : `${(ms / 1000).toFixed(2)} s`; }
function signedSpan(min, max) { return `${min.toFixed(2)}…+${max.toFixed(2)}`; }

for (const element of [
  els.resolution, els.fov, els.asymmetric, els.both, els.imageFovX, els.imageFovY,
  els.imageResolutionX, els.imageResolutionY, els.phaseDirection,
]) element.addEventListener("input", scheduleUpdate);
els.kspaceMode.addEventListener("click", () => setMode("kspace"));
els.imageMode.addEventListener("click", () => setMode("image"));
els.resetButton.addEventListener("click", reset);
els.howButton.addEventListener("click", () => document.querySelector("#explain").scrollIntoView({ behavior: "smooth" }));

updateControlDisplays();
setTimeout(initialise, 0);
