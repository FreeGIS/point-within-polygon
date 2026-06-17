package com.freegis.pointwithinpolygon;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.Envelope;
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.geom.LineString;
import org.locationtech.jts.geom.MultiPolygon;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.Polygon;
import org.locationtech.jts.index.strtree.STRtree;

/**
 * Batch point-in-Polygon/MultiPolygon query.
 *
 * <p>The algorithm mirrors the TypeScript implementation:
 * ring envelopes and segment envelopes are indexed with an R-tree, then the
 * final inclusion test is still the custom horizontal-ray test.</p>
 */
public final class PointWithinPolygon {
    private static final double RAY_LENGTH = 1_000_000_000d;

    private final boolean multiPolygon;
    private final STRtree ringsTree = new STRtree();
    private final Map<String, RingIndex> rings = new HashMap<>();

    private PointWithinPolygon(Geometry polygonGeometry) {
        if (polygonGeometry instanceof Polygon) {
            multiPolygon = false;
            buildPolygonIndex((Polygon) polygonGeometry, null);
        } else if (polygonGeometry instanceof MultiPolygon) {
            multiPolygon = true;
            MultiPolygon multi = (MultiPolygon) polygonGeometry;
            for (int i = 0; i < multi.getNumGeometries(); i++) {
                buildPolygonIndex((Polygon) multi.getGeometryN(i), i);
            }
        } else {
            throw new IllegalArgumentException("面类型必须是Polygon或MultiPolygon类型！");
        }
        ringsTree.build();
    }

    public static PointWithinPolygon index(Geometry polygonGeometry) {
        return new PointWithinPolygon(polygonGeometry);
    }

    public static List<Point> filter(List<Point> points, Geometry polygonGeometry) {
        return index(polygonGeometry).filter(points);
    }

    public List<Point> filter(List<Point> points) {
        List<Point> result = new ArrayList<>();
        for (Point point : points) {
            if (contains(point)) {
                result.add(point);
            }
        }
        return result;
    }

    public boolean contains(Point point) {
        if (multiPolygon) {
            return isPointInMultiPolygon(point);
        }
        return isPointInPolygon(point);
    }

    private boolean isPointInPolygon(Point point) {
        List<RingRef> candidateRingRefs = queryRings(point);
        if (candidateRingRefs.isEmpty()) {
            return false;
        }
        List<RingIndex> candidateRings = new ArrayList<>();
        for (RingRef ringRef : candidateRingRefs) {
            candidateRings.add(rings.get(ringRef.ringId));
        }
        return evaluateCandidateRings(point.getCoordinate(), candidateRings);
    }

    private boolean isPointInMultiPolygon(Point point) {
        List<RingRef> candidateRingRefs = queryRings(point);
        if (candidateRingRefs.isEmpty()) {
            return false;
        }
        Map<Integer, List<RingIndex>> polygonRings = new HashMap<>();
        for (RingRef ringRef : candidateRingRefs) {
            RingIndex ring = rings.get(ringRef.ringId);
            List<RingIndex> group = polygonRings.get(ring.polygonId);
            if (group == null) {
                group = new ArrayList<>();
                polygonRings.put(ring.polygonId, group);
            }
            group.add(ring);
        }
        for (List<RingIndex> candidateRings : polygonRings.values()) {
            if (evaluateCandidateRings(point.getCoordinate(), candidateRings)) {
                return true;
            }
        }
        return false;
    }

    @SuppressWarnings("unchecked")
    private List<RingRef> queryRings(Point point) {
        Coordinate coordinate = point.getCoordinate();
        return ringsTree.query(new Envelope(coordinate.x, coordinate.x, coordinate.y, coordinate.y));
    }

    private boolean evaluateCandidateRings(Coordinate point, List<RingIndex> candidateRings) {
        boolean shellMatched = false;
        for (RingIndex ring : candidateRings) {
            RingContainment containment = classifyRingContainment(point, ring);
            if (containment == RingContainment.INSIDE_HOLE || containment == RingContainment.OUTSIDE_SHELL) {
                return false;
            }
            if (containment == RingContainment.INSIDE_SHELL) {
                shellMatched = true;
            }
        }
        return shellMatched;
    }

    private RingContainment classifyRingContainment(Coordinate point, RingIndex ring) {
        boolean containsPoint = PointInRing.isPointInRingWithIndex(point, ring.segmentIndex) != -1d;
        if (ring.role == RingRole.SHELL) {
            return containsPoint ? RingContainment.INSIDE_SHELL : RingContainment.OUTSIDE_SHELL;
        }
        return containsPoint ? RingContainment.INSIDE_HOLE : RingContainment.OUTSIDE_HOLE;
    }

    private void buildPolygonIndex(Polygon polygon, Integer polygonId) {
        addRing(polygon.getExteriorRing(), ringId(polygonId, 0), polygonId, resolveRingRole(0));
        for (int i = 0; i < polygon.getNumInteriorRing(); i++) {
            int ringIndex = i + 1;
            addRing(polygon.getInteriorRingN(i), ringId(polygonId, ringIndex), polygonId, resolveRingRole(ringIndex));
        }
    }

    private void addRing(LineString ring, String ringId, Integer polygonId, RingRole role) {
        RingIndex ringIndex = getRingIndex(ring, ringId, polygonId, role);
        ringsTree.insert(ringIndex.envelope, new RingRef(ringId));
        rings.put(ringId, ringIndex);
    }

    private RingIndex getRingIndex(LineString ring, String ringId, Integer polygonId, RingRole role) {
        Coordinate[] coordinates = ring.getCoordinates();
        STRtree segmentIndex = new STRtree();
        Envelope ringEnvelope = new Envelope(coordinates[0], coordinates[coordinates.length - 1]);
        for (int i = 1; i < coordinates.length; i++) {
            Segment segment = new Segment(coordinates[i - 1], coordinates[i]);
            segmentIndex.insert(segment.envelope, segment);
            ringEnvelope.expandToInclude(coordinates[i]);
        }
        segmentIndex.build();
        int normalizedPolygonId = polygonId == null ? 0 : polygonId;
        return new RingIndex(ringId, normalizedPolygonId, role, ringEnvelope, segmentIndex);
    }

    private static String ringId(Integer polygonId, int ringIndex) {
        if (polygonId == null) {
            return String.valueOf(ringIndex);
        }
        return polygonId + "-" + ringIndex;
    }

    private static RingRole resolveRingRole(int ringIndex) {
        return ringIndex == 0 ? RingRole.SHELL : RingRole.HOLE;
    }

    private enum RingRole {
        SHELL,
        HOLE
    }

    private enum RingContainment {
        OUTSIDE_SHELL,
        INSIDE_SHELL,
        INSIDE_HOLE,
        OUTSIDE_HOLE
    }

    private static final class RingRef {
        private final String ringId;

        private RingRef(String ringId) {
            this.ringId = ringId;
        }
    }

    private static final class RingIndex {
        private final String ringId;
        private final int polygonId;
        private final RingRole role;
        private final Envelope envelope;
        private final STRtree segmentIndex;

        private RingIndex(String ringId, int polygonId, RingRole role, Envelope envelope, STRtree segmentIndex) {
            this.ringId = ringId;
            this.polygonId = polygonId;
            this.role = role;
            this.envelope = envelope;
            this.segmentIndex = segmentIndex;
        }
    }

    static final class Segment {
        final Coordinate start;
        final Coordinate end;
        final Envelope envelope;

        private Segment(Coordinate start, Coordinate end) {
            this.start = start;
            this.end = end;
            this.envelope = new Envelope(start, end);
        }
    }

    static double rayLength() {
        return RAY_LENGTH;
    }
}
