export const WIDTH = 256;
export const HEIGHT = 256;
export const NOISE_SIGMA = 0.004;

export const TISSUES = [
  { name: "Background", t1: 0, t2: 0, t2star: 0 },
  { name: "Tissue class 1", t1: 400, t2: 30, t2star: 18 },
  { name: "Tissue class 2", t1: 600, t2: 40, t2star: 24 },
  { name: "Tissue class 3", t1: 800, t2: 10, t2star: 6 },
  { name: "Tissue class 4", t1: 800, t2: 50, t2star: 30 },
  { name: "Tissue class 5", t1: 1000, t2: 20, t2star: 12 },
  { name: "Tissue class 6", t1: 1000, t2: 50, t2star: 30 },
  { name: "White matter", t1: 1000, t2: 80, t2star: 48 },
  { name: "Tissue class 8", t1: 1200, t2: 100, t2star: 60 },
  { name: "Deep gray matter", t1: 1500, t2: 120, t2star: 40 },
  { name: "Cortical gray matter", t1: 1500, t2: 120, t2star: 72 },
  { name: "Cerebrospinal fluid", t1: 3000, t2: 1500, t2star: 900 },
];

export function spoiledGreSignal(tissue, flipAngleDeg, tr, te) {
  if (tissue.t1 <= 0 || tissue.t2star <= 0) return 0;
  const alpha = flipAngleDeg * Math.PI / 180;
  const e1 = Math.exp(-tr / tissue.t1);
  return Math.exp(-te / tissue.t2star) * Math.sin(alpha) * (1 - e1) / (1 - Math.cos(alpha) * e1);
}

export function spinEchoSignal(tissue, tr, te) {
  if (tissue.t1 <= 0 || tissue.t2 <= 0) return 0;
  return Math.exp(-te / tissue.t2) * (1 - Math.exp(-tr / tissue.t1));
}

export function flairSignal(tissue, ti, tr, te) {
  if (tissue.t1 <= 0 || tissue.t2 <= 0) return 0;
  return Math.exp(-te / tissue.t2) * (1 - 2 * Math.exp(-ti / tissue.t1) + Math.exp(-tr / tissue.t1));
}

export function scaleToGray(value, lower, upper) {
  const span = Math.max(Number.EPSILON, upper - lower);
  const normalized = Math.max(0, Math.min(1, (value - lower) / span));
  return Math.round(255 * normalized);
}

export function noiseSigmaForAverages(nex) {
  return NOISE_SIGMA / Math.sqrt(Math.max(1, nex));
}

export function acquisitionTimeSeconds(tr, lines = HEIGHT, nex = 1) {
  return Math.max(0, tr) * Math.max(0, lines) * Math.max(1, nex) / 1000;
}

export function makeNoise(length, seed = 0x4b434c) {
  let state = seed >>> 0;
  const random = () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
  const noise = new Float32Array(length);
  for (let i = 0; i < length; i += 2) {
    const radius = Math.sqrt(-2 * Math.log(Math.max(Number.EPSILON, random())));
    const angle = 2 * Math.PI * random();
    noise[i] = NOISE_SIGMA * radius * Math.cos(angle);
    if (i + 1 < length) noise[i + 1] = NOISE_SIGMA * radius * Math.sin(angle);
  }
  return noise;
}
