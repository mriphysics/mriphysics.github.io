export function fft1d(real, imag, inverse = false) {
  const n = real.length;
  if (n !== imag.length || n < 1 || (n & (n - 1)) !== 0) {
    throw new Error("FFT length must be a power of two");
  }

  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }

  for (let size = 2; size <= n; size <<= 1) {
    const angle = (inverse ? 2 : -2) * Math.PI / size;
    const wStepR = Math.cos(angle);
    const wStepI = Math.sin(angle);
    for (let start = 0; start < n; start += size) {
      let wr = 1;
      let wi = 0;
      const half = size >> 1;
      for (let offset = 0; offset < half; offset += 1) {
        const even = start + offset;
        const odd = even + half;
        const tr = wr * real[odd] - wi * imag[odd];
        const ti = wr * imag[odd] + wi * real[odd];
        const er = real[even];
        const ei = imag[even];
        real[even] = er + tr;
        imag[even] = ei + ti;
        real[odd] = er - tr;
        imag[odd] = ei - ti;
        const nextWr = wr * wStepR - wi * wStepI;
        wi = wr * wStepI + wi * wStepR;
        wr = nextWr;
      }
    }
  }

  if (inverse) {
    for (let i = 0; i < n; i += 1) {
      real[i] /= n;
      imag[i] /= n;
    }
  }
}

export function fft2d(real, imag, size, inverse = false) {
  const lineR = new Float64Array(size);
  const lineI = new Float64Array(size);

  for (let y = 0; y < size; y += 1) {
    const base = y * size;
    for (let x = 0; x < size; x += 1) {
      lineR[x] = real[base + x];
      lineI[x] = imag[base + x];
    }
    fft1d(lineR, lineI, inverse);
    for (let x = 0; x < size; x += 1) {
      real[base + x] = lineR[x];
      imag[base + x] = lineI[x];
    }
  }

  for (let x = 0; x < size; x += 1) {
    for (let y = 0; y < size; y += 1) {
      const index = y * size + x;
      lineR[y] = real[index];
      lineI[y] = imag[index];
    }
    fft1d(lineR, lineI, inverse);
    for (let y = 0; y < size; y += 1) {
      const index = y * size + x;
      real[index] = lineR[y];
      imag[index] = lineI[y];
    }
  }
}

export function shift2d(real, imag, size) {
  const half = size >> 1;
  for (let y = 0; y < half; y += 1) {
    for (let x = 0; x < half; x += 1) {
      swapComplex(real, imag, y * size + x, (y + half) * size + x + half);
      swapComplex(real, imag, y * size + x + half, (y + half) * size + x);
    }
  }
}

function swapComplex(real, imag, a, b) {
  [real[a], real[b]] = [real[b], real[a]];
  [imag[a], imag[b]] = [imag[b], imag[a]];
}

export function makeSamplingMask(size, resolution, fovFactor, asymmetric, bothDimensions) {
  const mask = new Uint8Array(size * size);
  const half = size / 2;
  const keepX = new Uint8Array(size);
  const keepY = new Uint8Array(size);
  let samplesX = 0;
  let samplesY = 0;
  for (let x = 0; x < size; x += 1) {
    const kx = x - half;
    const inResolution = asymmetric ? kx < half * resolution : Math.abs(kx) < half * resolution;
    if (inResolution && x % fovFactor === 0) {
      keepX[x] = 1;
      samplesX += 1;
    }
  }
  for (let y = 0; y < size; y += 1) {
    const ky = y - half;
    const inResolution = asymmetric ? ky < half * resolution : Math.abs(ky) < half * resolution;
    if (!bothDimensions || (inResolution && y % fovFactor === 0)) {
      keepY[y] = 1;
      samplesY += 1;
    }
    for (let x = 0; x < size; x += 1) {
      if (keepX[x] && keepY[y]) mask[y * size + x] = 1;
    }
  }
  return { mask, sampled: samplesX * samplesY, samplesX, samplesY };
}

function prescriptionAxis(size, requestedSamples, factor) {
  const candidates = [];
  for (let index = 0; index < size; index += factor) candidates.push(index);
  candidates.sort((a, b) => Math.abs(a - size / 2) - Math.abs(b - size / 2) || a - b);
  const selected = new Uint8Array(size);
  const count = Math.min(requestedSamples, candidates.length);
  for (let i = 0; i < count; i += 1) selected[candidates[i]] = 1;
  return { selected, count };
}

export function makePrescriptionMask(size, matrixX, matrixY, fovFactorX, fovFactorY) {
  const xAxis = prescriptionAxis(size, matrixX, fovFactorX);
  const yAxis = prescriptionAxis(size, matrixY, fovFactorY);
  const mask = new Uint8Array(size * size);
  for (let y = 0; y < size; y += 1) {
    if (!yAxis.selected[y]) continue;
    for (let x = 0; x < size; x += 1) {
      if (xAxis.selected[x]) mask[y * size + x] = 1;
    }
  }
  return {
    mask,
    sampled: xAxis.count * yAxis.count,
    samplesX: xAxis.count,
    samplesY: yAxis.count,
  };
}

export function reconstruct(source, size, settings) {
  const real = Float64Array.from(source);
  const imag = new Float64Array(real.length);
  fft2d(real, imag, size);
  shift2d(real, imag, size);

  const sampling = settings.prescription
    ? makePrescriptionMask(size, settings.matrixX, settings.matrixY, settings.fovFactorX, settings.fovFactorY)
    : makeSamplingMask(size, settings.resolution, settings.fovFactor, settings.asymmetric, settings.bothDimensions);
  const { mask, sampled, samplesX, samplesY } = sampling;
  for (let i = 0; i < real.length; i += 1) {
    if (!mask[i]) {
      real[i] = 0;
      imag[i] = 0;
    }
  }

  const kReal = real.slice();
  const kImag = imag.slice();
  shift2d(real, imag, size);
  fft2d(real, imag, size, true);
  const magnitude = new Float32Array(real.length);
  for (let i = 0; i < real.length; i += 1) magnitude[i] = Math.hypot(real[i], imag[i]);
  return { magnitude, kReal, kImag, mask, sampled, samplesX, samplesY };
}
