package com.freegis.pointwithinpolygon;

import java.util.List;

import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.Envelope;
import org.locationtech.jts.index.strtree.STRtree;

final class PointInRing {
    private PointInRing() {
    }

    /**
     * Horizontal-ray ring test.
     *
     * <p>Returns the first intersection x coordinate if the point is inside the
     * ring, and {@code -1} if it is outside or on the ring boundary. This keeps
     * the same boundary behavior as the JavaScript version.</p>
     */
    @SuppressWarnings("unchecked")
    static double isPointInRingWithIndex(Coordinate point, STRtree segmentSpatialIndex) {
        Envelope rayEnvelope = new Envelope(
                point.x,
                point.x + PointWithinPolygon.rayLength(),
                point.y,
                point.y);
        List<PointWithinPolygon.Segment> segments = segmentSpatialIndex.query(rayEnvelope);
        Double xIntersect = null;
        int intersects = 0;
        for (PointWithinPolygon.Segment segment : segments) {
            if (segmentContains(segment.start, segment.end, point)) {
                return -1d;
            }
            if (segment.start.y == segment.end.y) {
                continue;
            }
            double x = (point.y - segment.start.y) * (segment.end.x - segment.start.x)
                    / (segment.end.y - segment.start.y) + segment.start.x;
            if (x <= point.x) {
                continue;
            }
            if (xIntersect == null || xIntersect > x) {
                xIntersect = x;
            }
            if (x == segment.start.x && point.y == segment.start.y) {
                if (point.y > segment.end.y) {
                    intersects++;
                }
            } else if (x == segment.end.x && point.y == segment.end.y) {
                if (point.y > segment.start.y) {
                    intersects++;
                }
            } else {
                intersects++;
            }
        }
        if (intersects % 2 == 1) {
            return xIntersect == null ? -1d : xIntersect;
        }
        return -1d;
    }

    private static boolean segmentContains(Coordinate a, Coordinate b, Coordinate c) {
        int index = a.x == b.x ? 1 : 0;
        double p = ordinate(a, index);
        return collinear(a, b, c) && within(p, ordinate(c, index), ordinate(b, index));
    }

    private static boolean collinear(Coordinate a, Coordinate b, Coordinate c) {
        return (b.x - a.x) * (c.y - a.y) == (c.x - a.x) * (b.y - a.y);
    }

    private static boolean within(double p, double q, double r) {
        return p <= q && q <= r || r <= q && q <= p;
    }

    private static double ordinate(Coordinate coordinate, int index) {
        return index == 0 ? coordinate.x : coordinate.y;
    }
}
