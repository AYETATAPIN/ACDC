export function distanceToSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) {
    const ex = p.x - a.x;
    const ey = p.y - a.y;
    return Math.sqrt(ex * ex + ey * ey);
  }
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  const ex = p.x - projX;
  const ey = p.y - projY;
  return Math.sqrt(ex * ex + ey * ey);
}

export function findBestSegmentIndex(points, point) {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const dist = distanceToSegment(point, points[i], points[i + 1]);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return bestIdx;
}

export function findNearestBendPointIndex(points, point, maxDistance) {
  if (!Array.isArray(points)) return -1;
  let bestIdx = -1;
  let bestDist = maxDistance;
  for (let i = 1; i < points.length - 1; i++) {
    const pt = points[i];
    if (!pt) continue;
    const dx = pt.x - point.x;
    const dy = pt.y - point.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return bestIdx;
}

export function toggleBendPointPoints(points, point, zoom = 1) {
  const safePoints = Array.isArray(points) ? points.slice() : [];
  if (safePoints.length < 2) {
    return { points: safePoints, removedIndex: -1, addedIndex: -1 };
  }
  const threshold = 10 / Math.max(zoom || 1, 0.01);
  const existingIndex = findNearestBendPointIndex(safePoints, point, threshold);
  if (existingIndex !== -1) {
    safePoints.splice(existingIndex, 1);
    return { points: safePoints, removedIndex: existingIndex, addedIndex: -1 };
  }
  const segIndex = findBestSegmentIndex(safePoints, point);
  const insertIndex = segIndex + 1;
  safePoints.splice(insertIndex, 0, point);
  return { points: safePoints, removedIndex: -1, addedIndex: insertIndex };
}
