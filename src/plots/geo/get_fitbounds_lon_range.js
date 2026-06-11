'use strict';

/**
 * Pick a compact longitude range for `fitbounds` when the data straddles the
 * antimeridian (±180°).
 *
 * Longitude is cyclic, so the naive [min, max] range used by the autorange
 * machinery can include a large empty span when points sit on both sides of
 * ±180° (e.g. lon = [131.8855, -179] spans ~311° the long way round, when the
 * compact view spans ~49° across the antimeridian). This finds the largest gap
 * between consecutive longitudes and, when that gap is wider than the gap across
 * the antimeridian, returns the complementary range so the map shows the dense
 * cluster of points rather than the empty ocean between them.
 *
 * The returned upper bound may exceed 180°; downstream `makeRangeBox` already
 * handles longitudes that cross the antimeridian without ambiguity.
 *
 * @param {Array} lons : longitude values (may contain non-finite entries)
 * @return {Array|null} [lonStart, lonEnd] when an antimeridian-crossing range is
 *   more compact, otherwise null (caller keeps the autorange result).
 */
module.exports = function getFitboundsLonRange(lons) {
    var sorted = [];
    for(var k = 0; k < lons.length; k++) {
        if(isFinite(lons[k])) sorted.push(lons[k]);
    }
    if(sorted.length < 2) return null;

    sorted.sort(function(a, b) { return a - b; });

    var n = sorted.length;
    var naiveSpan = sorted[n - 1] - sorted[0];
    // Data already wraps the whole globe; there is nothing to compact.
    if(naiveSpan >= 360) return null;

    // Widest gap between consecutive longitudes.
    var maxGap = -Infinity;
    var gapStart = -1;
    for(var i = 0; i < n - 1; i++) {
        var gap = sorted[i + 1] - sorted[i];
        if(gap > maxGap) {
            maxGap = gap;
            gapStart = i;
        }
    }

    // Only worth wrapping when an interior gap is wider than the gap that the
    // naive [min, max] range already leaves open across the antimeridian.
    var antimeridianGap = 360 - naiveSpan;
    if(maxGap <= antimeridianGap) return null;

    return [sorted[gapStart + 1], sorted[gapStart] + 360];
};
