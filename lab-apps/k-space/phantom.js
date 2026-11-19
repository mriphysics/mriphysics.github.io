export const MASTER_SIZE = 512;
export const MASTER_FOV_MM = 400;
export const MASTER_VOXEL_MM = MASTER_FOV_MM / MASTER_SIZE;

// Modified Shepp-Logan ellipses: intensity, semi-axes, centre and rotation.
const ELLIPSES = [
  [1, .69, .92, 0, 0, 0],
  [-.8, .6624, .874, 0, -.0184, 0],
  [-.2, .11, .31, .22, 0, -18],
  [-.2, .16, .41, -.22, 0, 18],
  [.1, .21, .25, 0, .35, 0],
  [.1, .046, .046, 0, .1, 0],
  [.1, .046, .046, 0, -.1, 0],
  [.1, .046, .023, -.08, -.605, 0],
  [.1, .023, .023, 0, -.606, 0],
  [.1, .023, .046, .06, -.605, 0],
];

export function createTeachingPhantom(size = MASTER_SIZE, fovMm = MASTER_FOV_MM) {
  const image = new Float64Array(size * size);
  const scaleMm = 100;

  for (let y = 0; y < size; y += 1) {
    const yMm = (y - size / 2) * fovMm / size;
    for (let x = 0; x < size; x += 1) {
      const xMm = (x - size / 2) * fovMm / size;
      // Evaluate the object at the opposite coordinate to rotate it by 180°.
      const objectX = -xMm;
      const objectY = -yMm;
      let value = 0;
      for (const [amplitude, a, b, cx, cy, degrees] of ELLIPSES) {
        const angle = degrees * Math.PI / 180;
        const dx = objectX / scaleMm - cx;
        const dy = objectY / scaleMm - cy;
        const xr = dx * Math.cos(angle) + dy * Math.sin(angle);
        const yr = -dx * Math.sin(angle) + dy * Math.cos(angle);
        if ((xr * xr) / (a * a) + (yr * yr) / (b * b) <= 1) value += amplitude;
      }

      // Bright discs provide known feature sizes while remaining part of the anatomy.
      const diameters = [2, 3, 4, 6, 8];
      const discX = [-45, -23, 0, 24, 49];
      for (let i = 0; i < diameters.length; i += 1) {
        const radius = diameters[i] / 2;
        if ((objectX - discX[i]) ** 2 + (objectY - 48) ** 2 <= radius ** 2) value = 1.18;
      }

      image[y * size + x] = Math.max(0, value);
    }
  }
  return image;
}
