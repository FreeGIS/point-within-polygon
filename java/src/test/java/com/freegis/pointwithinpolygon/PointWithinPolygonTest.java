package com.freegis.pointwithinpolygon;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertIterableEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

import org.junit.jupiter.api.Test;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.LinearRing;
import org.locationtech.jts.geom.MultiPolygon;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.Polygon;

class PointWithinPolygonTest {
    private final GeometryFactory geometryFactory = new GeometryFactory();

    @Test
    void filtersPointsInsidePolygonAndExcludesHole() {
        Polygon polygon = polygon(
                ring(c(0, 0), c(4, 0), c(4, 4), c(0, 4), c(0, 0)),
                ring(c(1, 1), c(3, 1), c(3, 3), c(1, 3), c(1, 1)));
        PointWithinPolygon index = PointWithinPolygon.index(polygon);

        assertTrue(index.contains(point(0.5, 0.5)));
        assertFalse(index.contains(point(2, 2)));
        assertFalse(index.contains(point(5, 5)));
        assertFalse(index.contains(point(0, 1)));
    }

    @Test
    void keepsMultiPolygonRingsGroupedByPolygon() {
        Polygon first = polygon(ring(c(0, 0), c(2, 0), c(2, 2), c(0, 2), c(0, 0)));
        Polygon second = polygon(ring(c(0, 0), c(4, 0), c(4, 4), c(3, 4), c(3, 1),
                c(1, 1), c(1, 4), c(0, 4), c(0, 0)));
        MultiPolygon multiPolygon = geometryFactory.createMultiPolygon(new Polygon[] {first, second});

        List<NamedPoint> namedPoints = Arrays.asList(
                new NamedPoint("inside first only", point(1, 1)),
                new NamedPoint("inside second", point(3.5, 0.5)),
                new NamedPoint("outside both", point(2.5, 2)),
                new NamedPoint("boundary", point(0, 1)));
        PointWithinPolygon index = PointWithinPolygon.index(multiPolygon);
        List<String> names = namedPoints.stream()
                .filter(namedPoint -> index.contains(namedPoint.point))
                .map(namedPoint -> namedPoint.name)
                .collect(Collectors.toList());

        assertIterableEquals(Arrays.asList("inside first only", "inside second"), names);
    }

    @Test
    void rejectsUnsupportedGeometry() {
        assertThrows(IllegalArgumentException.class, () -> PointWithinPolygon.index(point(0, 0)));
    }

    private Point point(double x, double y) {
        return geometryFactory.createPoint(c(x, y));
    }

    private Polygon polygon(LinearRing shell, LinearRing... holes) {
        return geometryFactory.createPolygon(shell, holes);
    }

    private LinearRing ring(Coordinate... coordinates) {
        return geometryFactory.createLinearRing(coordinates);
    }

    private Coordinate c(double x, double y) {
        return new Coordinate(x, y);
    }

    private static final class NamedPoint {
        private final String name;
        private final Point point;

        private NamedPoint(String name, Point point) {
            this.name = name;
            this.point = point;
        }
    }
}
