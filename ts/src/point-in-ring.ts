import type RBush from 'rbush';
import type { BBox, LinearRing, Position, SegmentItem } from './types';

const RAY_LENGTH = 1_000_000_000;

// 点在环内。点在面内返回第一个 x 交点；点在外部或边界上返回 -1。
export function isPointInRingWithIndexes(
  point: Position,
  segmentSpatialIndex: RBush<SegmentItem>
): number {
  const rayBBox: BBox = {
    minX: point[0],
    minY: point[1],
    maxX: point[0] + RAY_LENGTH,
    maxY: point[1],
  };
  let xIntersect: number | null = null;
  const searchResults = segmentSpatialIndex.search(rayBBox);
  let intersects = 0;

  for (const segment of searchResults) {
    if (segmentContains(segment.start, segment.end, point)) {
      return -1;
    }
    if (segment.start[1] === segment.end[1]) {
      continue;
    }

    const x =
      ((point[1] - segment.start[1]) * (segment.end[0] - segment.start[0])) /
        (segment.end[1] - segment.start[1]) +
      segment.start[0];
    if (x <= point[0]) {
      continue;
    }
    if (xIntersect === null || xIntersect > x) {
      xIntersect = x;
    }

    if (x === segment.start[0] && point[1] === segment.start[1]) {
      if (point[1] > segment.end[1]) {
        intersects++;
      }
    } else if (x === segment.end[0] && point[1] === segment.end[1]) {
      if (point[1] > segment.start[1]) {
        intersects++;
      }
    } else {
      intersects++;
    }
  }

  return intersects % 2 === 1 ? xIntersect ?? -1 : -1;
}

export function isPointInRingWithoutIndexes(point: Position, ring: LinearRing): number {
  let intersects = 0;
  let xIntersect: number | null = null;

  for (let i = 1; i < ring.length; i++) {
    const start = ring[i - 1];
    const end = ring[i];

    if (point[1] < Math.min(start[1], end[1])) {
      continue;
    }
    if (point[1] > Math.max(start[1], end[1])) {
      continue;
    }
    if (segmentContains(start, end, point)) {
      return -1;
    }
    if (start[1] === end[1]) {
      continue;
    }

    const x =
      ((point[1] - start[1]) * (end[0] - start[0])) / (end[1] - start[1]) +
      start[0];
    if (xIntersect === null) {
      xIntersect = x;
    }
    if (x <= point[0]) {
      continue;
    }

    if (x === start[0] && point[1] === start[1]) {
      if (point[1] > end[1]) {
        intersects++;
      }
    } else if (x === end[0] && point[1] === end[1]) {
      if (point[1] > start[1]) {
        intersects++;
      }
    } else {
      intersects++;
    }
  }

  return intersects % 2 === 1 ? xIntersect ?? -1 : -1;
}

function segmentContains(a: Position, b: Position, c: Position): boolean {
  const index = a[0] === b[0] ? 1 : 0;
  const p = a[index];
  return collinear(a, b, c) && within(p, c[index], b[index]);
}

function collinear(a: Position, b: Position, c: Position): boolean {
  return (b[0] - a[0]) * (c[1] - a[1]) === (c[0] - a[0]) * (b[1] - a[1]);
}

function within(p: number, q: number, r: number): boolean {
  return (p <= q && q <= r) || (r <= q && q <= p);
}
