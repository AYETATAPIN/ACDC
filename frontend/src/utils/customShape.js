const SVG_NS = 'http://www.w3.org/2000/svg';
const DEFAULT_VIEW_BOX = '0 0 100 100';
const SAMPLE_STEPS = 280;

let hiddenHost = null;
const geometryCache = new Map();

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));

const parseNumberish = (value, fallback) => {
  const parsed = Number.parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parsePoints = (raw) => {
  const nums = String(raw || '')
    .trim()
    .split(/[\s,]+/)
    .map((token) => Number.parseFloat(token))
    .filter((num) => Number.isFinite(num));
  const points = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    points.push({ x: nums[i], y: nums[i + 1] });
  }
  return points;
};

const rectToPath = (node) => {
  const x = parseNumberish(node.getAttribute('x'), 0);
  const y = parseNumberish(node.getAttribute('y'), 0);
  const w = parseNumberish(node.getAttribute('width'), 0);
  const h = parseNumberish(node.getAttribute('height'), 0);
  if (!(w > 0) || !(h > 0)) return '';

  const rxAttr = node.getAttribute('rx');
  const ryAttr = node.getAttribute('ry');
  const rxRaw = parseNumberish(rxAttr, 0);
  const ryRaw = parseNumberish(ryAttr, 0);
  const rx = Math.max(0, Math.min(w / 2, rxRaw || ryRaw));
  const ry = Math.max(0, Math.min(h / 2, ryRaw || rxRaw));

  if (rx <= 0 && ry <= 0) {
    return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
  }

  return [
    `M ${x + rx} ${y}`,
    `H ${x + w - rx}`,
    `A ${rx} ${ry} 0 0 1 ${x + w} ${y + ry}`,
    `V ${y + h - ry}`,
    `A ${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}`,
    `H ${x + rx}`,
    `A ${rx} ${ry} 0 0 1 ${x} ${y + h - ry}`,
    `V ${y + ry}`,
    `A ${rx} ${ry} 0 0 1 ${x + rx} ${y}`,
    'Z',
  ].join(' ');
};

const circleToPath = (node) => {
  const cx = parseNumberish(node.getAttribute('cx'), 0);
  const cy = parseNumberish(node.getAttribute('cy'), 0);
  const r = parseNumberish(node.getAttribute('r'), 0);
  if (!(r > 0)) return '';
  return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
};

const ellipseToPath = (node) => {
  const cx = parseNumberish(node.getAttribute('cx'), 0);
  const cy = parseNumberish(node.getAttribute('cy'), 0);
  const rx = parseNumberish(node.getAttribute('rx'), 0);
  const ry = parseNumberish(node.getAttribute('ry'), 0);
  if (!(rx > 0) || !(ry > 0)) return '';
  return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
};

const lineToPath = (node) => {
  const x1 = parseNumberish(node.getAttribute('x1'), 0);
  const y1 = parseNumberish(node.getAttribute('y1'), 0);
  const x2 = parseNumberish(node.getAttribute('x2'), 0);
  const y2 = parseNumberish(node.getAttribute('y2'), 0);
  return `M ${x1} ${y1} L ${x2} ${y2}`;
};

const polyToPath = (node, close) => {
  const points = parsePoints(node.getAttribute('points'));
  if (!points.length) return '';
  const head = `M ${points[0].x} ${points[0].y}`;
  const tail = points.slice(1).map((point) => `L ${point.x} ${point.y}`).join(' ');
  return `${head}${tail ? ` ${tail}` : ''}${close ? ' Z' : ''}`;
};

export const parseViewBox = (value) => {
  const raw = typeof value === 'string' ? value.trim() : '';
  const parts = raw.split(/[\s,]+/).map((x) => Number.parseFloat(x)).filter((x) => Number.isFinite(x));
  if (parts.length === 4) {
    const width = Math.abs(parts[2]) > 0 ? Math.abs(parts[2]) : 100;
    const height = Math.abs(parts[3]) > 0 ? Math.abs(parts[3]) : 100;
    return { minX: parts[0], minY: parts[1], width, height, raw: `${parts[0]} ${parts[1]} ${width} ${height}` };
  }
  return { minX: 0, minY: 0, width: 100, height: 100, raw: DEFAULT_VIEW_BOX };
};

export const parseCustomShapeData = (value) => {
  if (typeof value !== 'string' || !value.trim()) {
    const viewBoxData = parseViewBox(DEFAULT_VIEW_BOX);
    return { d: '', viewBox: viewBoxData.raw, viewBoxData };
  }

  const trimmed = value.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const d = String(parsed?.d ?? parsed?.path ?? '').trim();
      const viewBoxData = parseViewBox(parsed?.viewBox ?? DEFAULT_VIEW_BOX);
      return { d, viewBox: viewBoxData.raw, viewBoxData };
    } catch {
      // Keep backward compatibility with old plain-path strings.
    }
  }

  const viewBoxData = parseViewBox(DEFAULT_VIEW_BOX);
  return { d: trimmed, viewBox: viewBoxData.raw, viewBoxData };
};

export const serializeCustomShapeData = ({ d, viewBox }) =>
  JSON.stringify({
    v: 2,
    d: String(d || '').trim(),
    viewBox: parseViewBox(viewBox).raw,
  });

const ensureHiddenHost = () => {
  if (typeof document === 'undefined') return null;
  if (hiddenHost && document.body.contains(hiddenHost)) return hiddenHost;

  const host = document.createElement('div');
  host.setAttribute('data-custom-shape-host', 'true');
  host.style.position = 'fixed';
  host.style.left = '-10000px';
  host.style.top = '-10000px';
  host.style.width = '1px';
  host.style.height = '1px';
  host.style.overflow = 'hidden';
  host.style.visibility = 'hidden';
  host.style.pointerEvents = 'none';
  document.body.appendChild(host);
  hiddenHost = host;
  return host;
};

const ensureGeometry = (value) => {
  const parsed = parseCustomShapeData(value);
  if (!parsed.d) return null;
  const key = `${parsed.viewBox}::${parsed.d}`;
  if (geometryCache.has(key)) return geometryCache.get(key);

  const host = ensureHiddenHost();
  if (!host) return null;

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', parsed.viewBox);
  svg.setAttribute('width', '100');
  svg.setAttribute('height', '100');
  svg.style.position = 'absolute';
  svg.style.left = '-10000px';
  svg.style.top = '-10000px';

  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', parsed.d);
  path.setAttribute('fill', '#000');
  path.setAttribute('stroke', 'none');
  svg.appendChild(path);
  host.appendChild(svg);

  let totalLength = 0;
  try {
    totalLength = path.getTotalLength();
  } catch {
    totalLength = 0;
  }

  const geometry = { parsed, path, totalLength, samples: null };
  geometryCache.set(key, geometry);
  return geometry;
};

const getSamples = (geometry) => {
  if (!geometry) return [];
  if (Array.isArray(geometry.samples)) return geometry.samples;
  if (!(geometry.totalLength > 0)) {
    geometry.samples = [];
    return geometry.samples;
  }

  const samples = [];
  for (let step = 0; step <= SAMPLE_STEPS; step += 1) {
    const length = (geometry.totalLength * step) / SAMPLE_STEPS;
    try {
      const point = geometry.path.getPointAtLength(length);
      samples.push({ x: point.x, y: point.y });
    } catch {
      // Ignore a single broken sample and continue.
    }
  }

  geometry.samples = samples;
  return samples;
};

const localToNormalized = (x, y, viewBoxData) => ({
  xRatio: clamp01((x - viewBoxData.minX) / (viewBoxData.width || 1)),
  yRatio: clamp01((y - viewBoxData.minY) / (viewBoxData.height || 1)),
});

const normalizedToLocal = (xRatio, yRatio, viewBoxData) => ({
  x: viewBoxData.minX + clamp01(xRatio) * viewBoxData.width,
  y: viewBoxData.minY + clamp01(yRatio) * viewBoxData.height,
});

export const getCustomShapeBoundaryTowards = (shapeData, dirX, dirY) => {
  const geometry = ensureGeometry(shapeData);
  if (!geometry) return { xRatio: 0.5, yRatio: 0.5 };
  const samples = getSamples(geometry);
  const { viewBoxData } = geometry.parsed;
  if (!samples.length) return { xRatio: 0.5, yRatio: 0.5 };

  const center = {
    x: viewBoxData.minX + viewBoxData.width / 2,
    y: viewBoxData.minY + viewBoxData.height / 2,
  };

  const len = Math.hypot(dirX, dirY) || 1;
  const ux = dirX / len;
  const uy = dirY / len;

  let best = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const sample of samples) {
    const vx = sample.x - center.x;
    const vy = sample.y - center.y;
    const projection = vx * ux + vy * uy;
    if (projection <= 0) continue;
    const perpendicular = Math.abs(vx * uy - vy * ux);
    const score = projection - perpendicular * 2;
    if (score > bestScore) {
      bestScore = score;
      best = sample;
    }
  }

  if (!best) {
    best = samples[0];
  }
  return localToNormalized(best.x, best.y, viewBoxData);
};

export const getCustomShapeNearestBoundary = (shapeData, xRatio, yRatio) => {
  const geometry = ensureGeometry(shapeData);
  if (!geometry) return { xRatio: clamp01(xRatio), yRatio: clamp01(yRatio) };
  const samples = getSamples(geometry);
  const { viewBoxData } = geometry.parsed;
  if (!samples.length) return { xRatio: clamp01(xRatio), yRatio: clamp01(yRatio) };

  const localPoint = normalizedToLocal(xRatio, yRatio, viewBoxData);
  let best = samples[0];
  let bestDistSq = Number.POSITIVE_INFINITY;
  for (const sample of samples) {
    const dx = sample.x - localPoint.x;
    const dy = sample.y - localPoint.y;
    const distSq = dx * dx + dy * dy;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      best = sample;
    }
  }
  return localToNormalized(best.x, best.y, viewBoxData);
};

export const isPointInsideCustomShape = (shapeData, xRatio, yRatio) => {
  const geometry = ensureGeometry(shapeData);
  if (!geometry) return false;
  if (xRatio < 0 || xRatio > 1 || yRatio < 0 || yRatio > 1) return false;

  const { viewBoxData } = geometry.parsed;
  const local = normalizedToLocal(xRatio, yRatio, viewBoxData);

  if (typeof geometry.path.isPointInFill === 'function') {
    try {
      return Boolean(geometry.path.isPointInFill(new DOMPoint(local.x, local.y)));
    } catch {
      return true;
    }
  }

  return true;
};

export const extractCustomShapeFromSvgText = (svgText) => {
  const source = String(svgText || '').trim();
  if (!source) {
    throw new Error('SVG file is empty');
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(source, 'image/svg+xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('Invalid SVG file');
  }

  const svgEl = doc.querySelector('svg');
  if (!svgEl) {
    throw new Error('SVG root node is missing');
  }

  const paths = Array.from(svgEl.querySelectorAll('path'))
    .map((path) => String(path.getAttribute('d') || '').trim())
    .filter(Boolean);

  const shapePaths = [];
  for (const rect of Array.from(svgEl.querySelectorAll('rect'))) {
    const d = rectToPath(rect);
    if (d) shapePaths.push(d);
  }
  for (const circle of Array.from(svgEl.querySelectorAll('circle'))) {
    const d = circleToPath(circle);
    if (d) shapePaths.push(d);
  }
  for (const ellipse of Array.from(svgEl.querySelectorAll('ellipse'))) {
    const d = ellipseToPath(ellipse);
    if (d) shapePaths.push(d);
  }
  for (const line of Array.from(svgEl.querySelectorAll('line'))) {
    const d = lineToPath(line);
    if (d) shapePaths.push(d);
  }
  for (const polyline of Array.from(svgEl.querySelectorAll('polyline'))) {
    const d = polyToPath(polyline, false);
    if (d) shapePaths.push(d);
  }
  for (const polygon of Array.from(svgEl.querySelectorAll('polygon'))) {
    const d = polyToPath(polygon, true);
    if (d) shapePaths.push(d);
  }

  const allPaths = [...paths, ...shapePaths];

  if (!allPaths.length) {
    throw new Error('SVG must contain drawable geometry (path/rect/circle/ellipse/polygon/polyline/line)');
  }

  const d = allPaths.join(' ');
  let viewBox = svgEl.getAttribute('viewBox');
  if (!viewBox) {
    const width = parseNumberish(svgEl.getAttribute('width'), 100);
    const height = parseNumberish(svgEl.getAttribute('height'), 100);
    viewBox = `0 0 ${width > 0 ? width : 100} ${height > 0 ? height : 100}`;
  }

  const parsed = parseViewBox(viewBox);
  return {
    d,
    viewBox: parsed.raw,
    width: parsed.width,
    height: parsed.height,
    payload: serializeCustomShapeData({ d, viewBox: parsed.raw }),
  };
};
