const { getFitboundsLonRange } = require('../../../src/lib/geo_location_utils');

describe('Test geo_location_utils.getFitboundsLonRange', () => {
    it('returns the compact crossing range when point data straddles the antimeridian', () => {
        expect(getFitboundsLonRange([131.8855, -179])).toEqual([131.8855, 181]);
        expect(getFitboundsLonRange([170, 175, -170])).toEqual([170, 190]);
    });

    it('keeps the naive range (null) when the data does not straddle the antimeridian', () => {
        expect(getFitboundsLonRange([131.8855, 179])).toBe(null);
        expect(getFitboundsLonRange([-10, 0, 20])).toBe(null);
    });

    it('keeps the naive range (null) when the data spans the whole globe', () => {
        const lons = [];
        for (let lon = 0; lon <= 360; lon += 2.5) lons.push(lon);
        expect(getFitboundsLonRange(lons)).toBe(null);
    });

    it('returns null when fewer than two finite longitudes are available', () => {
        expect(getFitboundsLonRange([10])).toBe(null);
        expect(getFitboundsLonRange([NaN, 5])).toBe(null);
        expect(getFitboundsLonRange([])).toBe(null);
    });
});
