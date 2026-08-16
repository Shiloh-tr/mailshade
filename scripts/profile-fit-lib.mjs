function clamp(value, min = 0, max = 255) {
  return Math.min(max, Math.max(min, value));
}

function linearChannel(channel) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function luminance([red, green, blue]) {
  return 0.2126 * linearChannel(red) + 0.7152 * linearChannel(green) + 0.0722 * linearChannel(blue);
}

export function rgbToHex(rgb) {
  return `#${rgb.map((channel) => Math.round(clamp(channel)).toString(16).padStart(2, "0")).join("")}`;
}

export function hexToRgb(hex) {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`Expected a six-digit hex color, received '${hex}'.`);
  return [0, 2, 4].map((offset) => Number.parseInt(match[1].slice(offset, offset + 2), 16));
}

function rgbToHsl([red, green, blue]) {
  red /= 255; green /= 255; blue /= 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  if (max === min) return [0, 0, lightness];
  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue = max === red ? (green - blue) / delta + (green < blue ? 6 : 0)
    : max === green ? (blue - red) / delta + 2 : (red - green) / delta + 4;
  hue /= 6;
  return [hue, saturation, lightness];
}

function hslToRgb([hue, saturation, lightness]) {
  if (saturation === 0) return [lightness, lightness, lightness].map((value) => Math.round(value * 255));
  const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  const channel = (offset) => {
    let value = hue + offset;
    if (value < 0) value += 1;
    if (value > 1) value -= 1;
    if (value < 1 / 6) return p + (q - p) * 6 * value;
    if (value < 1 / 2) return q;
    if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
    return p;
  };
  return [channel(1 / 3), channel(0), channel(-1 / 3)].map((value) => Math.round(value * 255));
}

export function baselineInvert(rgb, surfaceContext) {
  const [hue, saturation, lightness] = rgbToHsl(rgb);
  if (surfaceContext === "dark") {
    const inverse = 1 - lightness;
    return hslToRgb([hue, saturation * 0.75, 0.08 + 0.15 * inverse + 0.22 * inverse ** 2]);
  }
  if (surfaceContext === "light") return hslToRgb([hue, saturation * 0.6, 0.58 + 0.37 * (1 - lightness)]);
  return hslToRgb([hue, saturation * 0.7, 0.13 + 0.87 * (1 - lightness)]);
}

export function predictAnchored(rgb, anchors, surfaceContext) {
  if (!anchors?.length) return baselineInvert(rgb, surfaceContext);
  const parsed = anchors.map((anchor) => ({ source: hexToRgb(anchor.source), target: hexToRgb(anchor.target) }));
  const exact = parsed.find((anchor) => anchor.source.every((channel, index) => Math.abs(channel - rgb[index]) <= 2));
  if (exact) return exact.target;
  const baseline = baselineInvert(rgb, surfaceContext);
  const nearest = parsed
    .map((anchor) => ({ ...anchor, distance: Math.sqrt(anchor.source.reduce((sum, channel, index) => sum + (channel - rgb[index]) ** 2, 0)) }))
    .sort((left, right) => left.distance - right.distance)
    .slice(0, Math.min(4, parsed.length));
  const interpolated = [0, 1, 2].map((channel) => {
    const baselineWeight = 1 / ((surfaceContext ? 6 : 96) ** 2);
    let total = baseline[channel] * baselineWeight;
    let weights = baselineWeight;
    for (const anchor of nearest) {
      const weight = 1 / Math.max(4, anchor.distance ** 2);
      total += anchor.target[channel] * weight;
      weights += weight;
    }
    return total / weights;
  });
  return interpolated.map((channel) => Math.round(clamp(channel)));
}

export function predictSurface(rgb, surface) {
  const lightness = luminance(rgb);
  if (lightness <= surface.preserveBelowLuminance) return [...rgb];
  const amount = lightness > surface.lightThreshold ? surface.lightMix : surface.midMix;
  const target = hexToRgb(surface.target);
  return rgb.map((channel, index) => Math.round(channel + (target[index] - channel) * amount));
}

export function predictText(rgb, text) {
  const lightness = luminance(rgb);
  if (lightness >= text.preserveAboveLuminance) return [...rgb];
  const amount = lightness < text.darkThreshold ? text.darkMix : text.midMix;
  const target = hexToRgb(text.target);
  return rgb.map((channel, index) => Math.round(channel + (target[index] - channel) * amount));
}

export function predictBorder(rgb, border) {
  const lightness = luminance(rgb);
  const darkBand = lightness <= border.darkThreshold;
  const amount = darkBand ? border.darkMix : lightness > border.lightThreshold ? border.lightMix : border.midMix;
  const target = hexToRgb(darkBand ? border.darkTarget : border.lightTarget);
  return rgb.map((channel, index) => Math.round(channel + (target[index] - channel) * amount));
}

function midpoint(left, right) {
  return (left + right) / 2;
}

function thresholds(values) {
  const unique = [...new Set(values)].sort((a, b) => a - b);
  return [-0.000001, ...unique.slice(0, -1).map((value, index) => midpoint(value, unique[index + 1])), 1.000001];
}

function solveTarget(samples, preserveThreshold, lightThreshold, midMix, lightMix) {
  const transformed = samples.filter((sample) => sample.luminance > preserveThreshold);
  if (!transformed.length) return null;
  const target = [0, 1, 2].map((channel) => {
    let total = 0;
    for (const sample of transformed) {
      const amount = sample.luminance > lightThreshold ? lightMix : midMix;
      total += (sample.dark[channel] - (1 - amount) * sample.light[channel]) / amount;
    }
    return clamp(total / transformed.length);
  });
  let squaredError = 0;
  for (const sample of samples) {
    const predicted = sample.luminance <= preserveThreshold
      ? sample.light
      : sample.light.map((channel, index) => {
          const amount = sample.luminance > lightThreshold ? lightMix : midMix;
          return channel + (target[index] - channel) * amount;
        });
    for (let channel = 0; channel < 3; channel += 1) squaredError += (predicted[channel] - sample.dark[channel]) ** 2;
  }
  return { target, squaredError };
}

/** Fit the exact two-band surface model used by the simulator. */
export function fitSurfaceProfile(observations, options = {}) {
  const samples = observations.map((observation) => ({
    id: observation.id,
    light: observation.light,
    dark: observation.dark,
    luminance: luminance(observation.light),
  }));
  if (samples.length < 5) throw new Error("At least five surface observations are required to fit a profile.");

  const sourceThresholds = thresholds(samples.map((sample) => sample.luminance));
  const step = options.mixStep ?? 0.02;
  const minimumMix = options.minimumMix ?? 0.04;
  let best = null;

  for (const preserveBelowLuminance of sourceThresholds) {
    const remaining = samples.filter((sample) => sample.luminance > preserveBelowLuminance);
    if (remaining.length < 3) continue;
    for (const lightThreshold of thresholds(remaining.map((sample) => sample.luminance))) {
      const mid = remaining.filter((sample) => sample.luminance <= lightThreshold);
      const light = remaining.filter((sample) => sample.luminance > lightThreshold);
      if (!mid.length || !light.length) continue;
      for (let midMix = minimumMix; midMix <= 1.00001; midMix += step) {
        for (let lightMix = minimumMix; lightMix <= 1.00001; lightMix += step) {
          const solved = solveTarget(samples, preserveBelowLuminance, lightThreshold, midMix, lightMix);
          if (!solved || (best && solved.squaredError >= best.squaredError)) continue;
          best = {
            preserveBelowLuminance,
            lightThreshold,
            midMix: Math.min(1, midMix),
            lightMix: Math.min(1, lightMix),
            target: solved.target,
            squaredError: solved.squaredError,
          };
        }
      }
    }
  }

  if (!best) throw new Error("The observations do not contain enough luminance range to fit both surface bands.");
  return {
    preserveBelowLuminance: Number(Math.max(0, best.preserveBelowLuminance).toFixed(6)),
    target: rgbToHex(best.target),
    lightMix: Number(best.lightMix.toFixed(4)),
    midMix: Number(best.midMix.toFixed(4)),
    lightThreshold: Number(Math.min(1, best.lightThreshold).toFixed(6)),
    rmseRgb: Number(Math.sqrt(best.squaredError / (samples.length * 3)).toFixed(4)),
    observationCount: samples.length,
  };
}

function solveSharedTarget(samples, amountFor, preserved = () => false) {
  const transformed = samples.filter((sample) => !preserved(sample));
  if (!transformed.length) return null;
  const target = [0, 1, 2].map((channel) => clamp(transformed.reduce((total, sample) => {
    const amount = amountFor(sample);
    return total + (sample.dark[channel] - (1 - amount) * sample.light[channel]) / amount;
  }, 0) / transformed.length));
  let squaredError = 0;
  for (const sample of samples) {
    const predicted = preserved(sample) ? sample.light : sample.light.map((channel, index) => {
      const amount = amountFor(sample);
      return channel + (target[index] - channel) * amount;
    });
    for (let channel = 0; channel < 3; channel += 1) squaredError += (predicted[channel] - sample.dark[channel]) ** 2;
  }
  return { target, squaredError };
}

export function fitTextProfile(observations, options = {}) {
  const samples = observations.map((observation) => ({ ...observation, luminance: luminance(observation.light) }));
  if (samples.length < 5) throw new Error("At least five text observations are required to fit a profile.");
  const step = options.mixStep ?? 0.02;
  const minimumMix = options.minimumMix ?? 0.04;
  let best = null;
  for (const preserveAboveLuminance of thresholds(samples.map((sample) => sample.luminance))) {
    const remaining = samples.filter((sample) => sample.luminance < preserveAboveLuminance);
    if (remaining.length < 3) continue;
    for (const darkThreshold of thresholds(remaining.map((sample) => sample.luminance))) {
      const dark = remaining.filter((sample) => sample.luminance < darkThreshold);
      const mid = remaining.filter((sample) => sample.luminance >= darkThreshold);
      if (!dark.length || !mid.length) continue;
      for (let darkMix = minimumMix; darkMix <= 1.00001; darkMix += step) {
        for (let midMix = minimumMix; midMix <= 1.00001; midMix += step) {
          const solved = solveSharedTarget(
            samples,
            (sample) => sample.luminance < darkThreshold ? darkMix : midMix,
            (sample) => sample.luminance >= preserveAboveLuminance,
          );
          if (!solved || (best && solved.squaredError >= best.squaredError)) continue;
          best = { preserveAboveLuminance, darkThreshold, darkMix, midMix, ...solved };
        }
      }
    }
  }
  if (!best) throw new Error("The observations do not contain enough luminance range to fit both text bands.");
  return {
    preserveAboveLuminance: Number(Math.min(1, best.preserveAboveLuminance).toFixed(6)),
    target: rgbToHex(best.target),
    darkMix: Number(Math.min(1, best.darkMix).toFixed(4)),
    midMix: Number(Math.min(1, best.midMix).toFixed(4)),
    darkThreshold: Number(Math.max(0, best.darkThreshold).toFixed(6)),
    rmseRgb: Number(Math.sqrt(best.squaredError / (samples.length * 3)).toFixed(4)),
    observationCount: samples.length,
  };
}

function fitSingleBand(samples, step, minimumMix) {
  let best = null;
  for (let amount = minimumMix; amount <= 1.00001; amount += step) {
    const solved = solveSharedTarget(samples, () => amount);
    if (solved && (!best || solved.squaredError < best.squaredError)) best = { amount, ...solved };
  }
  return best;
}

function fitTwoBands(samples, step, minimumMix) {
  let best = null;
  for (const threshold of thresholds(samples.map((sample) => sample.luminance))) {
    const mid = samples.filter((sample) => sample.luminance <= threshold);
    const light = samples.filter((sample) => sample.luminance > threshold);
    if (!mid.length || !light.length) continue;
    for (let midMix = minimumMix; midMix <= 1.00001; midMix += step) {
      for (let lightMix = minimumMix; lightMix <= 1.00001; lightMix += step) {
        const solved = solveSharedTarget(samples, (sample) => sample.luminance > threshold ? lightMix : midMix);
        if (solved && (!best || solved.squaredError < best.squaredError)) best = { threshold, midMix, lightMix, ...solved };
      }
    }
  }
  return best;
}

export function fitBorderProfile(observations, options = {}) {
  const samples = observations.map((observation) => ({ ...observation, luminance: luminance(observation.light) }));
  if (samples.length < 6) throw new Error("At least six border observations are required to fit a profile.");
  const step = options.mixStep ?? 0.02;
  const minimumMix = options.minimumMix ?? 0.04;
  let best = null;
  for (const darkThreshold of thresholds(samples.map((sample) => sample.luminance))) {
    const dark = samples.filter((sample) => sample.luminance <= darkThreshold);
    const remaining = samples.filter((sample) => sample.luminance > darkThreshold);
    if (!dark.length || remaining.length < 2) continue;
    const darkFit = fitSingleBand(dark, step, minimumMix);
    const lightFit = fitTwoBands(remaining, step, minimumMix);
    if (!darkFit || !lightFit) continue;
    const squaredError = darkFit.squaredError + lightFit.squaredError;
    if (!best || squaredError < best.squaredError) best = { darkThreshold, darkFit, lightFit, squaredError };
  }
  if (!best) throw new Error("The observations do not contain enough luminance range to fit all border bands.");
  return {
    darkThreshold: Number(Math.max(0, best.darkThreshold).toFixed(6)),
    darkTarget: rgbToHex(best.darkFit.target),
    darkMix: Number(Math.min(1, best.darkFit.amount).toFixed(4)),
    lightTarget: rgbToHex(best.lightFit.target),
    lightMix: Number(Math.min(1, best.lightFit.lightMix).toFixed(4)),
    midMix: Number(Math.min(1, best.lightFit.midMix).toFixed(4)),
    lightThreshold: Number(Math.min(1, best.lightFit.threshold).toFixed(6)),
    rmseRgb: Number(Math.sqrt(best.squaredError / (samples.length * 3)).toFixed(4)),
    observationCount: samples.length,
  };
}

function pivotRgb(value) {
  value /= 255;
  return value > 0.04045 ? ((value + 0.055) / 1.055) ** 2.4 : value / 12.92;
}

function rgbToLab([red, green, blue]) {
  red = pivotRgb(red);
  green = pivotRgb(green);
  blue = pivotRgb(blue);
  const x = (red * 0.4124 + green * 0.3576 + blue * 0.1805) / 0.95047;
  const y = (red * 0.2126 + green * 0.7152 + blue * 0.0722);
  const z = (red * 0.0193 + green * 0.1192 + blue * 0.9505) / 1.08883;
  const pivot = (value) => value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116;
  const fx = pivot(x);
  const fy = pivot(y);
  const fz = pivot(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function deltaE76(left, right) {
  const a = rgbToLab(left);
  const b = rgbToLab(right);
  return Math.sqrt(a.reduce((sum, value, index) => sum + (value - b[index]) ** 2, 0));
}

function degreesToRadians(value) {
  return value * Math.PI / 180;
}

function radiansToDegrees(value) {
  return value * 180 / Math.PI;
}

function hueDegrees(a, b) {
  if (a === 0 && b === 0) return 0;
  const value = radiansToDegrees(Math.atan2(b, a));
  return value >= 0 ? value : value + 360;
}

/** CIEDE2000 perceptual color difference, using sRGB/D65 inputs. */
export function deltaE00(left, right) {
  const [l1, a1, b1] = rgbToLab(left);
  const [l2, a2, b2] = rgbToLab(right);
  const c1 = Math.hypot(a1, b1);
  const c2 = Math.hypot(a2, b2);
  const cMean = (c1 + c2) / 2;
  const cMean7 = cMean ** 7;
  const g = 0.5 * (1 - Math.sqrt(cMean7 / (cMean7 + 25 ** 7)));
  const a1Prime = (1 + g) * a1;
  const a2Prime = (1 + g) * a2;
  const c1Prime = Math.hypot(a1Prime, b1);
  const c2Prime = Math.hypot(a2Prime, b2);
  const h1Prime = hueDegrees(a1Prime, b1);
  const h2Prime = hueDegrees(a2Prime, b2);
  const deltaLPrime = l2 - l1;
  const deltaCPrime = c2Prime - c1Prime;
  const hueDelta = h2Prime - h1Prime;
  const deltaHPrimeDegrees = c1Prime * c2Prime === 0
    ? 0
    : Math.abs(hueDelta) <= 180 ? hueDelta : hueDelta > 180 ? hueDelta - 360 : hueDelta + 360;
  const deltaHPrime = 2 * Math.sqrt(c1Prime * c2Prime) * Math.sin(degreesToRadians(deltaHPrimeDegrees / 2));
  const lMeanPrime = (l1 + l2) / 2;
  const cMeanPrime = (c1Prime + c2Prime) / 2;
  const hMeanPrime = c1Prime * c2Prime === 0
    ? h1Prime + h2Prime
    : Math.abs(h1Prime - h2Prime) <= 180
      ? (h1Prime + h2Prime) / 2
      : h1Prime + h2Prime < 360 ? (h1Prime + h2Prime + 360) / 2 : (h1Prime + h2Prime - 360) / 2;
  const t = 1
    - 0.17 * Math.cos(degreesToRadians(hMeanPrime - 30))
    + 0.24 * Math.cos(degreesToRadians(2 * hMeanPrime))
    + 0.32 * Math.cos(degreesToRadians(3 * hMeanPrime + 6))
    - 0.20 * Math.cos(degreesToRadians(4 * hMeanPrime - 63));
  const deltaTheta = 30 * Math.exp(-(((hMeanPrime - 275) / 25) ** 2));
  const cMeanPrime7 = cMeanPrime ** 7;
  const rC = 2 * Math.sqrt(cMeanPrime7 / (cMeanPrime7 + 25 ** 7));
  const sL = 1 + (0.015 * (lMeanPrime - 50) ** 2) / Math.sqrt(20 + (lMeanPrime - 50) ** 2);
  const sC = 1 + 0.045 * cMeanPrime;
  const sH = 1 + 0.015 * cMeanPrime * t;
  const rT = -Math.sin(degreesToRadians(2 * deltaTheta)) * rC;
  const lTerm = deltaLPrime / sL;
  const cTerm = deltaCPrime / sC;
  const hTerm = deltaHPrime / sH;
  return Math.sqrt(lTerm ** 2 + cTerm ** 2 + hTerm ** 2 + rT * cTerm * hTerm);
}

function validationSummary(regions) {
  const percentile = (metric, ratio) => {
    const sorted = regions.map((region) => region[metric]).sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)] ?? 0;
  };
  return {
    observationCount: regions.length,
    medianDeltaE76: Number(percentile("deltaE76", 0.5).toFixed(4)),
    p95DeltaE76: Number(percentile("deltaE76", 0.95).toFixed(4)),
    medianDeltaE00: Number(percentile("deltaE00", 0.5).toFixed(4)),
    p95DeltaE00: Number(percentile("deltaE00", 0.95).toFixed(4)),
    regions,
  };
}

export function validateSurfaceProfile(observations, surface) {
  const regions = observations.map((observation) => {
    const predicted = predictSurface(observation.light, surface);
    return {
      id: observation.id,
      expected: observation.dark,
      predicted,
      deltaE76: Number(deltaE76(predicted, observation.dark).toFixed(4)),
      deltaE00: Number(deltaE00(predicted, observation.dark).toFixed(4)),
    };
  });
  return validationSummary(regions);
}

export function validateRoleProfile(observations, role, values) {
  const predictor = role === "surface" ? predictSurface : role === "text" ? predictText : predictBorder;
  const regions = observations.map((observation) => {
    const predicted = predictor(observation.light, values);
    return {
      id: observation.id,
      expected: observation.dark,
      predicted,
      deltaE76: Number(deltaE76(predicted, observation.dark).toFixed(4)),
      deltaE00: Number(deltaE00(predicted, observation.dark).toFixed(4)),
    };
  });
  return { role, ...validationSummary(regions) };
}

export function anchorsFromObservations(observations) {
  return observations.map((observation) => ({ source: rgbToHex(observation.light), target: rgbToHex(observation.dark), id: observation.id }));
}

export function validateAnchorProfile(observations, anchors, surfaceContext) {
  const regions = observations.map((observation) => {
    const predicted = predictAnchored(observation.light, anchors, surfaceContext);
    return {
      id: observation.id,
      expected: observation.dark,
      predicted,
      deltaE76: Number(deltaE76(predicted, observation.dark).toFixed(4)),
      deltaE00: Number(deltaE00(predicted, observation.dark).toFixed(4)),
    };
  });
  return validationSummary(regions);
}
