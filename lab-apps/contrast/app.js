import { WIDTH, HEIGHT, TISSUES, spoiledGreSignal, spinEchoSignal, flairSignal, makeNoise, scaleToGray, noiseSigmaForAverages, acquisitionTimeSeconds } from "./contrast.js?v=contrast-6";

const els = Object.fromEntries([
  "greMode", "seMode", "flairMode", "greControls", "seControls", "flairControls",
  "greFA", "greFAValue", "greTR", "greTE", "seTR", "seTE", "flairTI", "flairTR", "flairTE",
  "sequenceDescription", "formulaReadout", "tipText", "imageCanvas", "imageTitle", "status",
  "sequenceReadout", "parameterReadout", "rangeReadout", "acquisitionReadout", "scaleMax", "scaleMin", "interpretation",
  "nex", "nexValue",
  "autoContrast", "fixedContrast", "fixedRange", "contrastLower", "contrastUpper", "resetButton", "howButton",
].map((id) => [id, document.querySelector(`#${id}`)]));

const MODELS = {
  gre: {
    title: "Spoiled gradient echo",
    short: "Spoiled GRE",
    description: "Spoiled gradient echo contrast depends on flip angle, TR, T1 and T2* decay during TE.",
    formula: "S = e<sup>−TE/T2*</sup> sin α · (1 − e<sup>−TR/T1</sup>) / (1 − cos α · e<sup>−TR/T1</sup>)",
    tip: "<strong>Try this:</strong> vary the flip angle at short TR and find the angle that maximises signal.",
    interpretation: "At short TR, flip angle and T1 recovery strongly shape contrast. Increasing TE adds T2* weighting and reduces overall signal.",
  },
  se: {
    title: "Spin echo",
    short: "Spin echo",
    description: "Spin echo contrast is controlled by longitudinal recovery during TR and transverse T2 decay during TE.",
    formula: "S = e<sup>−TE/T2</sup> · (1 − e<sup>−TR/T1</sup>)",
    tip: "<strong>Try this:</strong> compare short-TR/short-TE T1 weighting with long-TR/long-TE T2 weighting.",
    interpretation: "Short TR emphasises T1 differences. Long TE emphasises T2 differences, while long TR reduces T1 weighting.",
  },
  flair: {
    title: "FLAIR",
    short: "FLAIR",
    description: "FLAIR adds an inversion pulse before a spin echo. TI controls which tissue is selectively nulled.",
    formula: "S = e<sup>−TE/T2</sup> · (1 − 2e<sup>−TI/T1</sup> + e<sup>−TR/T1</sup>)",
    tip: "<strong>Try this:</strong> adjust TI until the bright CSF signal is suppressed.",
    interpretation: "The inversion time controls the zero crossing of longitudinal magnetisation. Magnitude display makes negative and positive signals appear bright unless they are near the null point.",
  },
};

let tissueMap;
let noise = makeNoise(WIDTH * HEIGHT);
let mode = "gre";
let contrastMode = "auto";
let lastSignalRange = { minimum: 0, maximum: 1 };
let updateTimer;

async function loadPhantom() {
  const response = await fetch("assets/brain_tissues.u8?v=256-square");
  if (!response.ok) throw new Error(`Could not load tissue phantom (${response.status})`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length !== WIDTH * HEIGHT) throw new Error("Tissue phantom has an unexpected size");
  tissueMap = bytes;
}

function positiveNumber(input, minimum) {
  const value = Number(input.value);
  return Number.isFinite(value) ? Math.max(minimum, value) : minimum;
}

function parameters() {
  const nex = Math.round(positiveNumber(els.nex, 1));
  if (mode === "gre") return { fa: positiveNumber(els.greFA, 0), tr: positiveNumber(els.greTR, 1), te: positiveNumber(els.greTE, .1), nex };
  if (mode === "se") return { tr: positiveNumber(els.seTR, 1), te: positiveNumber(els.seTE, .1), nex };
  return { ti: positiveNumber(els.flairTI, 0), tr: positiveNumber(els.flairTR, 1), te: positiveNumber(els.flairTE, .1), nex };
}

function tissueSignals(config) {
  if (mode === "gre") return TISSUES.map((tissue) => spoiledGreSignal(tissue, config.fa, config.tr, config.te));
  if (mode === "se") return TISSUES.map((tissue) => spinEchoSignal(tissue, config.tr, config.te));
  return TISSUES.map((tissue) => flairSignal(tissue, config.ti, config.tr, config.te));
}

function simulate() {
  if (!tissueMap) return;
  const config = parameters();
  const lookup = tissueSignals(config);
  const values = new Float32Array(tissueMap.length);
  let minimum = Infinity, maximum = -Infinity;
  for (let i = 0; i < values.length; i += 1) {
    const raw = lookup[tissueMap[i]] + noise[i] / Math.sqrt(config.nex);
    const value = mode === "flair" ? Math.abs(raw) : raw;
    values[i] = value;
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
  }
  lastSignalRange = { minimum, maximum };
  const display = displayRange(minimum, maximum);
  drawImage(values, display.minimum, display.maximum);
  updateReadouts(config, minimum, maximum, display.minimum, display.maximum);
  els.status.textContent = "Live";
}

function drawImage(values, minimum, maximum) {
  const context = els.imageCanvas.getContext("2d", { alpha: false });
  const image = context.createImageData(WIDTH, HEIGHT);
  for (let i = 0; i < values.length; i += 1) {
    const gray = scaleToGray(values[i], minimum, maximum);
    const p = i * 4;
    image.data[p] = gray; image.data[p + 1] = gray; image.data[p + 2] = gray; image.data[p + 3] = 255;
  }
  context.putImageData(image, 0, 0);
}

function updateReadouts(config, minimum, maximum, displayMinimum, displayMaximum) {
  const model = MODELS[mode];
  els.imageTitle.textContent = model.title;
  els.sequenceReadout.textContent = model.short;
  els.parameterReadout.textContent = mode === "gre"
    ? `FA ${format(config.fa)}° · TR ${format(config.tr)} ms · TE ${format(config.te)} ms · NEX ${config.nex}`
    : mode === "se"
      ? `TR ${format(config.tr)} ms · TE ${format(config.te)} ms · NEX ${config.nex}`
      : `TI ${format(config.ti)} ms · TR ${format(config.tr)} ms · TE ${format(config.te)} ms · NEX ${config.nex}`;
  els.rangeReadout.textContent = `${minimum.toFixed(3)} to ${maximum.toFixed(3)}`;
  els.acquisitionReadout.textContent = formatDuration(acquisitionTimeSeconds(config.tr, HEIGHT, config.nex));
  els.scaleMax.textContent = displayMaximum.toFixed(3);
  els.scaleMin.textContent = displayMinimum.toFixed(3);
  els.interpretation.textContent = `${model.interpretation} With NEX ${config.nex}, the noise standard deviation is σ = ${noiseSigmaForAverages(config.nex).toFixed(4)}.`;
}

function displayRange(minimum, maximum) {
  if (contrastMode === "auto") return { minimum, maximum };
  let lower = Number(els.contrastLower.value);
  let upper = Number(els.contrastUpper.value);
  if (!Number.isFinite(lower)) lower = minimum;
  if (!Number.isFinite(upper)) upper = maximum;
  if (upper <= lower) upper = lower + Math.max(0.001, Math.abs(lower) * 0.001);
  return { minimum: lower, maximum: upper };
}

function setContrastMode(nextMode) {
  if (nextMode === "fixed" && contrastMode === "auto") {
    els.contrastLower.value = lastSignalRange.minimum.toFixed(3);
    els.contrastUpper.value = lastSignalRange.maximum.toFixed(3);
  }
  contrastMode = nextMode;
  const automatic = contrastMode === "auto";
  els.autoContrast.classList.toggle("active", automatic);
  els.fixedContrast.classList.toggle("active", !automatic);
  els.autoContrast.setAttribute("aria-pressed", String(automatic));
  els.fixedContrast.setAttribute("aria-pressed", String(!automatic));
  els.fixedRange.hidden = automatic;
  scheduleUpdate();
}

function setMode(nextMode) {
  mode = nextMode;
  const model = MODELS[mode];
  for (const name of ["gre", "se", "flair"]) {
    const active = name === mode;
    els[`${name}Mode`].classList.toggle("active", active);
    els[`${name}Mode`].setAttribute("aria-pressed", String(active));
    els[`${name}Controls`].hidden = !active;
  }
  els.sequenceDescription.textContent = model.description;
  els.formulaReadout.innerHTML = model.formula;
  els.formulaReadout.setAttribute("aria-label", `${model.title} signal equation`);
  els.tipText.innerHTML = model.tip;
  scheduleUpdate();
}

function scheduleUpdate() {
  els.greFAValue.value = `${format(Number(els.greFA.value))}°`;
  els.nexValue.value = `${Math.round(Number(els.nex.value))}`;
  els.status.textContent = "Updating";
  clearTimeout(updateTimer);
  updateTimer = setTimeout(simulate, 30);
}

function reset() {
  els.greFA.value = "17"; els.greTR.value = "10"; els.greTE.value = "1";
  els.seTR.value = "1000"; els.seTE.value = "10";
  els.flairTI.value = "458"; els.flairTR.value = "1000"; els.flairTE.value = "180";
  els.nex.value = "1";
  noise = makeNoise(WIDTH * HEIGHT);
  setContrastMode("auto");
  setMode("gre");
}

function format(value) { return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1); }

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds < 10 ? seconds.toFixed(2) : seconds.toFixed(1)} s`;
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return `${minutes} min ${String(remainder).padStart(2, "0")} s`;
}

for (const input of [els.greFA, els.greTR, els.greTE, els.seTR, els.seTE, els.flairTI, els.flairTR, els.flairTE, els.nex]) input.addEventListener("input", scheduleUpdate);
for (const input of [els.contrastLower, els.contrastUpper]) input.addEventListener("input", scheduleUpdate);
els.greMode.addEventListener("click", () => setMode("gre"));
els.seMode.addEventListener("click", () => setMode("se"));
els.flairMode.addEventListener("click", () => setMode("flair"));
els.autoContrast.addEventListener("click", () => setContrastMode("auto"));
els.fixedContrast.addEventListener("click", () => setContrastMode("fixed"));
els.resetButton.addEventListener("click", reset);
els.howButton.addEventListener("click", () => document.querySelector("#explain").scrollIntoView({ behavior: "smooth" }));

loadPhantom().then(() => setMode("gre")).catch((error) => {
  els.status.textContent = "Data error";
  els.interpretation.textContent = error.message;
  console.error(error);
});
