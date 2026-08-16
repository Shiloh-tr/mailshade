export function structuralSimilarity(left, right) {
  if (left.length !== right.length || left.length === 0) throw new Error("SSIM inputs must have the same non-zero length.");
  const meanLeft = left.reduce((sum, value) => sum + value, 0) / left.length;
  const meanRight = right.reduce((sum, value) => sum + value, 0) / right.length;
  let varianceLeft = 0;
  let varianceRight = 0;
  let covariance = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftDelta = left[index] - meanLeft;
    const rightDelta = right[index] - meanRight;
    varianceLeft += leftDelta ** 2;
    varianceRight += rightDelta ** 2;
    covariance += leftDelta * rightDelta;
  }
  const divisor = Math.max(1, left.length - 1);
  varianceLeft /= divisor;
  varianceRight /= divisor;
  covariance /= divisor;
  const c1 = (0.01 * 255) ** 2;
  const c2 = (0.03 * 255) ** 2;
  return ((2 * meanLeft * meanRight + c1) * (2 * covariance + c2))
    / ((meanLeft ** 2 + meanRight ** 2 + c1) * (varianceLeft + varianceRight + c2));
}

export function windowedSsim(left, right, width, height, windowSize = 8) {
  if (left.length !== width * height || right.length !== width * height) {
    throw new Error("Image dimensions do not match the luminance buffers.");
  }
  const scores = [];
  for (let y = 0; y < height; y += windowSize) {
    for (let x = 0; x < width; x += windowSize) {
      const expected = [];
      const actual = [];
      for (let offsetY = y; offsetY < Math.min(height, y + windowSize); offsetY += 1) {
        for (let offsetX = x; offsetX < Math.min(width, x + windowSize); offsetX += 1) {
          const index = offsetY * width + offsetX;
          expected.push(left[index]);
          actual.push(right[index]);
        }
      }
      scores.push(structuralSimilarity(expected, actual));
    }
  }
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

export function geometryDelta(expected, actual) {
  const deltas = {
    x: Math.abs(expected.x - actual.x),
    y: Math.abs(expected.y - actual.y),
    width: Math.abs(expected.width - actual.width),
    height: Math.abs(expected.height - actual.height),
  };
  return { ...deltas, max: Math.max(...Object.values(deltas)) };
}
