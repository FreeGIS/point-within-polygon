import RBush from 'rbush';
import { isPointInRingWithIndexs, isPointInRingWithoutIndexs } from './point-in-ring';

function index(ptFeatures, pgFeature,withIndexes=1){
    if(withIndexes)
        return isPointInPolygonWithIndexs(ptFeatures, pgFeature);
    else 
        return isPointInPolygonWithOutIndexs(ptFeatures, pgFeature);
}

// 批量判断点在面内，带索引
function isPointInPolygonWithIndexs(ptFeatures, pgFeature) {
    // 判别pgFeature的类型
    const type = pgFeature.geometry.type;
    let filterFeatures;
    if (type === 'Polygon') {
        const { ringsTree, rings } = getPolygonIndex(pgFeature);
        filterFeatures = ptFeatures.filter(feature => {
            return _isPointinPolygonWithIndexs(feature, ringsTree, rings);
        });
    } else if (type === 'MultiPolygon') {
        const { ringsTree, rings } = getMultiPolygonIndex(pgFeature);
        filterFeatures = ptFeatures.filter(feature => {
            return _isPointinPolygonWithIndexs(feature, ringsTree, rings);
        });
    }
    else
        throw new Error('面类型必须是Polygon或MultiPolygn类型！');
    return filterFeatures;
}

// 批量判断在在面内，不带索引
function isPointInPolygonWithOutIndexs(ptFeatures, pgFeature) {
    // 判别pgFeature的类型
    const type = pgFeature.geometry.type;
    let filterFeatures;
    if (type === 'Polygon') {
        filterFeatures = ptFeatures.filter(feature => {
            return _isPointInPolygonWithOutIndexs(feature.geometry.coordinates, pgFeature.geometry.coordinates);
        });

    } else if (type === 'MultiPolygon') {
        filterFeatures = ptFeatures.filter(feature => {
            for (let polygon of pgFeature.geometry.coordinates) {
                if (_isPointInPolygonWithOutIndexs(feature.geometry.coordinates, polygon)) {
                    return true;
                }
            }
            return false;
        });
    }
    else
        throw new Error('面类型必须是Polygon或MultiPolygn类型！');
    return filterFeatures;
}


function _isPointInPolygonWithOutIndexs(pt, pg) {
    //如果点在内环，点不在面内
    for (let i = 1; i < pg.length; i++) {
        const ring = pg[ i ];
        if (isPointInRingWithoutIndexs(pt, ring) !== -1)
            return false;
    }
    // 点不在任何内环内，判断点在外环
    if (isPointInRingWithoutIndexs(pt, pg[ 0 ]) !== -1)
        return true;
    return false;
}


function _isPointinPolygonWithIndexs(ptFeature, ringsTree, rings) {
    // 判断点在哪些环内，正常情况 点在洞内 点在面内 点在面外三个情况
    const ringSearch = ringsTree.search({
        minX: ptFeature.geometry.coordinates[ 0 ],
        minY: ptFeature.geometry.coordinates[ 1 ],
        maxX: ptFeature.geometry.coordinates[ 0 ],
        maxY: ptFeature.geometry.coordinates[ 1 ]
    });
    if (ringSearch.length === 0)
        return false;
    // 过滤，根据射线法判断是否在某个环内。
    for (let item of ringSearch) {
        let id = item.ringid;
        let ring = rings[ id ];
        // 点在环内
        if (isPointInRingWithIndexs(ptFeature.geometry.coordinates, ring.segmentIndex) !== -1) {
            // 如果是内环，直接返回false
            if (ring.ringType === 'in') {
                return false;
            }
        } else {
            // 点不在环内，并且环是外环
            if (ring.ringType === 'out')
                return false;
        }
    }
    return true;
}




function getPolygonIndex(pgFeature) {
    let ringsTree = new RBush();
    let rings = {};
    for (let i = 0; i < pgFeature.geometry.coordinates.length; i++) {
        const ring = pgFeature.geometry.coordinates[ i ];
        const ringid = i;
        const { ringIndex, segmentIndex } = getRingIndex(ring);
        ringsTree.insert({ ...ringIndex, ringid });
        let ringType;
        if (i === 0)
            ringType = 'out';
        else
            ringType = 'in';
        rings[ ringid ] = {
            ringid,
            segmentIndex,
            ringType
        };
    }
    return { ringsTree, rings };
}


function getMultiPolygonIndex(pgFeature) {
    let ringsTree = new RBush();
    let rings = {};
    for (let i = 0; i < pgFeature.geometry.coordinates.length; i++) {
        let polygon = pgFeature.geometry.coordinates[ i ];
        for (let j = 0; j < polygon.length; j++) {
            const ring = polygon[ j ];
            const ringid = i + '-' + j;
            const { ringIndex, segmentIndex } = getRingIndex(ring);
            ringsTree.insert({ ...ringIndex, ringid });
            let ringType;
            if (j === 0)
                ringType = 'out';
            else
                ringType = 'in';
            rings[ ringid ] = {
                ringid,
                segmentIndex,
                ringType
            };
        }
    }
    return { ringsTree, rings };
}



function getRingIndex(ring) {
    let segmentIndex = new RBush();
    const n = ring.length;
    let ringIndex = {
        minX: Math.min(ring[ 0 ][ 0 ], ring[ n - 1 ][ 0 ]),
        minY: Math.min(ring[ 0 ][ 1 ], ring[ n - 1 ][ 1 ]),
        maxX: Math.max(ring[ 0 ][ 0 ], ring[ n - 1 ][ 0 ]),
        maxY: Math.max(ring[ 0 ][ 1 ], ring[ n - 1 ][ 1 ])
    };
    for (let i = 1; i < n; i++) {
        segmentIndex.insert({
            minX: Math.min(ring[ i - 1 ][ 0 ], ring[ i ][ 0 ]),
            minY: Math.min(ring[ i - 1 ][ 1 ], ring[ i ][ 1 ]),
            maxX: Math.max(ring[ i - 1 ][ 0 ], ring[ i ][ 0 ]),
            maxY: Math.max(ring[ i - 1 ][ 1 ], ring[ i ][ 1 ]),
            start: ring[ i - 1 ],
            end: ring[ i ]
        });
        ringIndex.minX = Math.min(ringIndex.minX, ring[ i ][ 0 ]);
        ringIndex.minY = Math.min(ringIndex.minY, ring[ i ][ 1 ]);
        ringIndex.maxX = Math.max(ringIndex.maxX, ring[ i ][ 0 ]);
        ringIndex.maxY = Math.max(ringIndex.maxY, ring[ i ][ 1 ]);
    }
    return { ringIndex, segmentIndex };
}

export default index;