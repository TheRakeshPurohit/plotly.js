var Plotly = require('../../../lib/index');
var Plots = require('../../../src/plots/plots');
var Lib = require('../../../src/lib');
var Drawing = require('../../../src/components/drawing');
var DBLCLICKDELAY = require('../../../src/plot_api/plot_config').dfltConfig.doubleClickDelay;

var d3Select = require('../../strict-d3').select;
var d3SelectAll = require('../../strict-d3').selectAll;
var createGraphDiv = require('../assets/create_graph_div');
var createShadowGraphDiv = require('../assets/create_shadow_graph_div');
var destroyGraphDiv = require('../assets/destroy_graph_div');

var mouseEvent = require('../assets/mouse_event');
var drag = require('../assets/drag');
var getRectCenter = require('../assets/get_rect_center');

// cartesian click events events use the hover data
// from the mousemove events and then simulate
// a click event on mouseup
var click = require('../assets/click');
var doubleClickRaw = require('../assets/double_click');

function move(fromX, fromY, toX, toY, delay) {
    return new Promise(function(resolve) {
        mouseEvent('mousemove', fromX, fromY);

        setTimeout(function() {
            mouseEvent('mousemove', toX, toY);
            resolve();
        }, delay || DBLCLICKDELAY / 4);
    });
}

describe('Test click interactions:', function() {
    var mock = require('../../image/mocks/14.json');

    var mockCopy, gd;

    var pointPos = [344, 216];
    var blankPos = [63, 356];
    var marginPos = [100, 50];

    var autoRangeX = [-3.011967491973726, 2.1561305597186564];
    var autoRangeY = [-0.9910086301469277, 1.389382716298284];

    beforeEach(function() {
        gd = createGraphDiv();
        mockCopy = Lib.extendDeep({}, mock);
    });

    afterEach(destroyGraphDiv);

    function doubleClick(x, y) {
        return doubleClickRaw(x, y).then(function() {
            return Plots.previousPromises(gd);
        });
    }

    describe('click events', function() {
        var futureData, clickPassthroughs, contextPassthroughs;

        beforeEach(function(done) {
            Plotly.newPlot(gd, mockCopy.data, mockCopy.layout)
            .then(function() {
                futureData = null;
                clickPassthroughs = 0;
                contextPassthroughs = 0;

                gd.on('plotly_click', function(data) {
                    futureData = data;
                });

                gd.addEventListener('click', function() {
                    clickPassthroughs++;
                });
                gd.addEventListener('contextmenu', function() {
                    contextPassthroughs++;
                });
            })
            .then(done);
        });

        // Later we want to emit plotly events for clicking in the graph but not on data
        // showing the axis values you clicked on. But at the moment these events
        // pass through to event handlers attached to gd.
        it('should not be triggered when not on data points', function() {
            click(blankPos[0], blankPos[1]);
            expect(futureData).toBe(null);
            // this is a weird one - in the real case the original click never
            // happens, it gets canceled by preventDefault in mouseup, but we
            // add our own synthetic click.
            // But assets/click doesn't know not to generate a click event, so
            // here we get both. I don't see a good way to avoid this, but also
            // there's something nice about this showing that we do indeed
            // generate the synthetic click event.
            // TODO: do we actually want this synthetic event, now that dragElement
            // has `clickFn` to explicitly manage clicks too? Perhaps leave it in
            // for now, in case either 1) users want to catch all clicks on gd, or
            // 2) we have a component still using on('click') instead of `clickFn`
            expect(clickPassthroughs).toBe(2);
            expect(contextPassthroughs).toBe(0);
        });

        // Margin clicks will probably always pass through to gd, right?
        // Any reason we should handle these?
        it('should not be triggered when in the margin', function() {
            click(marginPos[0], marginPos[1]);
            expect(futureData).toBe(null);
            expect(clickPassthroughs).toBe(1);
            expect(contextPassthroughs).toBe(0);
        });

        function checkPointData() {
            expect(futureData.points.length).toEqual(1);
            expect(clickPassthroughs).toBe(2);
            expect(contextPassthroughs).toBe(0);

            var pt = futureData.points[0];
            expect(Object.keys(pt).sort()).toEqual([
                'data', 'fullData', 'curveNumber', 'pointNumber', 'pointIndex',
                'bbox',
                'x', 'y', 'xaxis', 'yaxis'
            ].sort());
            expect(pt.curveNumber).toEqual(0);
            expect(pt.pointNumber).toEqual(11);
            expect(pt.x).toEqual(0.125);
            expect(pt.y).toEqual(2.125);

            var evt = futureData.event;
            expect(evt.clientX).toEqual(pointPos[0]);
            expect(evt.clientY).toEqual(pointPos[1]);
        }

        it('should contain the correct fields', function() {
            click(pointPos[0], pointPos[1]);
            checkPointData();
        });

        it('should work with a sloppy click (shift < minDrag before mouseup)', function() {
            click(pointPos[0], pointPos[1], {slop: [4, 4]});
            checkPointData();
        });

        it('works with fixedrange axes', function(done) {
            Plotly.relayout(gd, {'xaxis.fixedrange': true, 'yaxis.fixedrange': true})
            .then(function() {
                click(pointPos[0], pointPos[1]);
                expect(futureData.points.length).toEqual(1);
                expect(clickPassthroughs).toBe(2);
                expect(contextPassthroughs).toBe(0);

                var pt = futureData.points[0];
                expect(Object.keys(pt).sort()).toEqual([
                    'data', 'fullData', 'curveNumber', 'pointNumber', 'pointIndex',
                    'bbox',
                    'x', 'y', 'xaxis', 'yaxis'
                ].sort());
                expect(pt.curveNumber).toEqual(0);
                expect(pt.pointNumber).toEqual(11);
                expect(pt.x).toEqual(0.125);
                expect(pt.y).toEqual(2.125);

                var evt = futureData.event;
                expect(evt.clientX).toEqual(pointPos[0]);
                expect(evt.clientY).toEqual(pointPos[1]);
            })
            .then(done, done.fail);
        });

        var modClickOpts = {
            altKey: true,
            ctrlKey: true, // this makes it effectively into a right-click
            metaKey: true,
            shiftKey: true,
            button: 0,
            cancelContext: true
        };
        var rightClickOpts = {
            altKey: false,
            ctrlKey: false,
            metaKey: false,
            shiftKey: false,
            button: 2,
            cancelContext: true
        };

        [modClickOpts, rightClickOpts].forEach(function(clickOpts, i) {
            it('should not be triggered when not on data points', function() {
                click(blankPos[0], blankPos[1], clickOpts);
                expect(futureData).toBe(null, i);
                expect(clickPassthroughs).toBe(0, i);
                expect(contextPassthroughs).toBe(0, i);
            });

            it('should not be triggered when in the margin', function() {
                click(marginPos[0], marginPos[1], clickOpts);
                expect(futureData).toBe(null, i);
                expect(clickPassthroughs).toBe(0, i);
                expect(contextPassthroughs).toBe(0, i);
            });

            it('should not be triggered if you dont cancel contextmenu', function() {
                click(pointPos[0], pointPos[1], Lib.extendFlat({}, clickOpts, {cancelContext: false}));
                expect(futureData).toBe(null, i);
                expect(clickPassthroughs).toBe(0, i);
                expect(contextPassthroughs).toBe(1, i);
            });

            // Testing the specific behavior that some users depend on
            // See https://github.com/plotly/plotly.js/issues/2101
            // If and only if you cancel contextmenu, by doing something like:
            //
            //   gd.addEventListener('contextmenu', function(e) { e.preventDefault(); })
            //
            // then we pass right-click on data points through to plotly_click events.
            // Devs using this need to be aware then to check eventData.event
            // and figure out if it had a button or ctrlKey etc.
            it('should contain the correct fields', function() {
                click(pointPos[0], pointPos[1], clickOpts);
                expect(futureData.points.length).toBe(1, i);
                expect(clickPassthroughs).toBe(0, i);
                expect(contextPassthroughs).toBe(0, i);

                var pt = futureData.points[0];
                expect(Object.keys(pt).sort()).toEqual([
                    'data', 'fullData', 'curveNumber', 'pointNumber', 'pointIndex',
                    'bbox',
                    'x', 'y', 'xaxis', 'yaxis'
                ].sort());
                expect(pt.curveNumber).toEqual(0);
                expect(pt.pointNumber).toEqual(11);
                expect(pt.x).toEqual(0.125);
                expect(pt.y).toEqual(2.125);

                var evt = futureData.event;
                expect(evt.clientX).toEqual(pointPos[0]);
                expect(evt.clientY).toEqual(pointPos[1]);
                Object.getOwnPropertyNames(clickOpts).forEach(function(opt) {
                    if(opt !== 'cancelContext') {
                        expect(evt[opt]).toBe(clickOpts[opt], opt + ': ' + i);
                    }
                });
            });
        });
    });

    describe('click event with hoverinfo set to skip - plotly_click', function() {
        var futureData;

        beforeEach(function(done) {
            var modifiedMockCopy = Lib.extendDeep({}, mockCopy);
            modifiedMockCopy.data[0].hoverinfo = 'skip';
            Plotly.newPlot(gd, modifiedMockCopy.data, modifiedMockCopy.layout)
            .then(function() {
                futureData = null;

                gd.on('plotly_click', function(data) {
                    futureData = data;
                });
            })
            .then(done);
        });

        it('should not register the click', function() {
            click(pointPos[0], pointPos[1]);
            expect(futureData).toBe(null);
        });
    });

    describe('click events with hoverinfo set to skip - plotly_hover', function() {
        var futureData;

        beforeEach(function(done) {
            var modifiedMockCopy = Lib.extendDeep({}, mockCopy);
            modifiedMockCopy.data[0].hoverinfo = 'skip';
            Plotly.newPlot(gd, modifiedMockCopy.data, modifiedMockCopy.layout)
            .then(function() {
                futureData = null;

                gd.on('plotly_hover', function(data) {
                    futureData = data;
                });
            })
            .then(done);
        });

        it('should not register the hover', function() {
            click(pointPos[0], pointPos[1]);
            expect(futureData).toBe(null);
        });
    });

    describe('click event with hoverinfo set to none - plotly_click', function() {
        var futureData;

        beforeEach(function(done) {
            var modifiedMockCopy = Lib.extendDeep({}, mockCopy);
            modifiedMockCopy.data[0].hoverinfo = 'none';
            Plotly.newPlot(gd, modifiedMockCopy.data, modifiedMockCopy.layout)
            .then(function() {
                futureData = null;

                gd.on('plotly_click', function(data) {
                    futureData = data;
                });
            })
            .then(done);
        });

        it('should contain the correct fields despite hoverinfo: "none"', function() {
            click(pointPos[0], pointPos[1]);
            expect(futureData.points.length).toEqual(1);

            var pt = futureData.points[0];
            expect(Object.keys(pt).sort()).toEqual([
                'data', 'fullData', 'curveNumber', 'pointNumber', 'pointIndex',
                'bbox',
                'x', 'y', 'xaxis', 'yaxis'
            ].sort());
            expect(pt.curveNumber).toEqual(0);
            expect(pt.pointNumber).toEqual(11);
            expect(pt.x).toEqual(0.125);
            expect(pt.y).toEqual(2.125);
        });
    });

    describe('click events with hoverinfo set to none - plotly_hover', function() {
        var futureData;

        beforeEach(function(done) {
            var modifiedMockCopy = Lib.extendDeep({}, mockCopy);
            modifiedMockCopy.data[0].hoverinfo = 'none';
            Plotly.newPlot(gd, modifiedMockCopy.data, modifiedMockCopy.layout)
            .then(function() {
                futureData = null;

                gd.on('plotly_hover', function(data) {
                    futureData = data;
                });
            })
            .then(done);
        });

        it('should contain the correct fields despite hoverinfo: "none"', function() {
            click(pointPos[0], pointPos[1]);
            expect(futureData.points.length).toEqual(1);

            var pt = futureData.points[0];
            expect(Object.keys(pt).sort()).toEqual([
                'data', 'fullData', 'curveNumber', 'pointNumber', 'pointIndex',
                'bbox',
                'x', 'y', 'xaxis', 'yaxis'
            ].sort());
            expect(pt.curveNumber).toEqual(0);
            expect(pt.pointNumber).toEqual(11);
            expect(pt.x).toEqual(0.125);
            expect(pt.y).toEqual(2.125);

            var evt = futureData.event;
            expect(evt.clientX).toEqual(pointPos[0]);
            expect(evt.clientY).toEqual(pointPos[1]);
        });
    });

    describe('plotly_unhover event with hoverinfo set to none', function() {
        var futureData;

        beforeEach(function(done) {
            var modifiedMockCopy = Lib.extendDeep({}, mockCopy);
            modifiedMockCopy.data[0].hoverinfo = 'none';
            Plotly.newPlot(gd, modifiedMockCopy.data, modifiedMockCopy.layout)
            .then(function() {
                futureData = null;

                gd.on('plotly_unhover', function(data) {
                    futureData = data;
                });
            })
            .then(done);
        });

        it('should contain the correct fields despite hoverinfo: "none"', function(done) {
            move(pointPos[0], pointPos[1], blankPos[0], blankPos[1]).then(function() {
                expect(futureData.points.length).toEqual(1);

                var pt = futureData.points[0];
                expect(Object.keys(pt).sort()).toEqual([
                    'data', 'fullData', 'curveNumber', 'pointNumber', 'pointIndex',
                    'bbox',
                    'x', 'y', 'xaxis', 'yaxis'
                ].sort());
                expect(pt.curveNumber).toEqual(0);
                expect(pt.pointNumber).toEqual(11);
                expect(pt.x).toEqual(0.125);
                expect(pt.y).toEqual(2.125);

                var evt = futureData.event;
                expect(evt.clientX).toEqual(blankPos[0]);
                expect(evt.clientY).toEqual(blankPos[1]);
            })
            .then(done, done.fail);
        });
    });

    describe('double click events', function() {
        var futureData;

        beforeEach(function(done) {
            Plotly.newPlot(gd, mockCopy.data, mockCopy.layout)
            .then(function() {
                futureData = null;

                gd.on('plotly_doubleclick', function(data) {
                    futureData = data;
                });
            })
            .then(done);
        });

        it('should return null', function(done) {
            doubleClick(pointPos[0], pointPos[1])
            .then(function() {
                expect(futureData).toBe(null);
            })
            .then(done, done.fail);
        });
    });

    describe('drag interactions', function() {
        beforeEach(function(done) {
            Plotly.newPlot(gd, mockCopy.data, mockCopy.layout).then(function() {
                // Do not let the notifier hide the drag elements
                var tooltip = document.querySelector('.notifier-note');
                if(tooltip) tooltip.style.display = 'None';

                done();
            });
        });

        it('on nw dragbox should update the axis ranges', function(done) {
            var node = document.querySelector('rect.nwdrag');
            var pos = getRectCenter(node);

            expect(node).toBeClassed(['drag', 'nwdrag', 'cursor-nw-resize']);

            expect(gd.layout.xaxis.range).toBeCloseToArray(autoRangeX);
            expect(gd.layout.yaxis.range).toBeCloseToArray(autoRangeY);

            drag({pos0: pos, dpos: [10, 50]})
            .then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray([-3.08579746, 2.156130559]);
                expect(gd.layout.yaxis.range).toBeCloseToArray([-0.99100863, 1.86546098]);
            })
            .then(function() {
                return drag({pos0: pos, dpos: [-10, -50]});
            })
            .then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray(autoRangeX);
                expect(gd.layout.yaxis.range).toBeCloseToArray([-0.99100863, 1.10938115]);
            })
            .then(done, done.fail);
        });

        it('on ne dragbox should update the axis ranges', function(done) {
            var node = document.querySelector('rect.nedrag');
            var pos = getRectCenter(node);

            expect(node).toBeClassed(['drag', 'nedrag', 'cursor-ne-resize']);

            expect(gd.layout.xaxis.range).toBeCloseToArray(autoRangeX);
            expect(gd.layout.yaxis.range).toBeCloseToArray(autoRangeY);

            drag({pos0: pos, dpos: [50, 50]})
            .then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray([-3.01196749, 1.72466470]);
                expect(gd.layout.yaxis.range).toBeCloseToArray([-0.99100863, 1.86546098]);
            })
            .then(function() {
                return drag({pos0: pos, dpos: [-50, -50]});
            })
            .then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray([-3.01196749, 2.08350047]);
                expect(gd.layout.yaxis.range).toBeCloseToArray([-0.99100863, 1.10938115]);
            })
            .then(done, done.fail);
        });

        it('on sw dragbox should update the axis ranges', function(done) {
            var node = document.querySelector('rect.swdrag');
            var pos = getRectCenter(node);

            expect(node).toBeClassed(['drag', 'swdrag', 'cursor-sw-resize']);

            expect(gd.layout.xaxis.range).toBeCloseToArray(autoRangeX);
            expect(gd.layout.yaxis.range).toBeCloseToArray(autoRangeY);

            drag({pos0: pos, dpos: [10, 50]})
            .then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray([-3.08579746, 2.15613055]);
                expect(gd.layout.yaxis.range).toBeCloseToArray([-0.36094210, 1.38938271]);
            })
            .then(function() {
                return drag({pos0: pos, dpos: [-10, -50]});
            }).then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray([-3.00958227, 2.15613055]);
                expect(gd.layout.yaxis.range).toBeCloseToArray([-0.71100706, 1.38938271]);
            })
            .then(done, done.fail);
        });

        it('on se dragbox should update the axis ranges', function(done) {
            var node = document.querySelector('rect.sedrag');
            var pos = getRectCenter(node);

            expect(node).toBeClassed(['drag', 'sedrag', 'cursor-se-resize']);

            expect(gd.layout.xaxis.range).toBeCloseToArray(autoRangeX);
            expect(gd.layout.yaxis.range).toBeCloseToArray(autoRangeY);

            drag({pos0: pos, dpos: [50, 50]})
            .then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray([-3.01196749, 1.72466470]);
                expect(gd.layout.yaxis.range).toBeCloseToArray([-0.36094210, 1.38938271]);
            })
            .then(function() {
                return drag({pos0: pos, dpos: [-50, -50]});
            })
            .then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray([-3.01196749, 2.08350047]);
                expect(gd.layout.yaxis.range).toBeCloseToArray([-0.71100706, 1.38938271]);
            })
            .then(done, done.fail);
        });

        it('on ew dragbox should update the xaxis range', function(done) {
            var node = document.querySelector('rect.ewdrag');
            var pos = getRectCenter(node);

            expect(node).toBeClassed(['drag', 'ewdrag', 'cursor-ew-resize']);

            expect(gd.layout.xaxis.range).toBeCloseToArray(autoRangeX);
            expect(gd.layout.yaxis.range).toBeCloseToArray(autoRangeY);

            drag({pos0: pos, dpos: [50, 50]})
            .then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray([-3.375918058, 1.792179992]);
                expect(gd.layout.yaxis.range).toBeCloseToArray(autoRangeY);
            })
            .then(function() {
                return drag({pos0: pos, dpos: [-50, -50]});
            }).then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray([-3.01196749, 2.15613055]);
                expect(gd.layout.yaxis.range).toBeCloseToArray(autoRangeY);
            })
            .then(done, done.fail);
        });

        it('on w dragbox should update the xaxis range', function(done) {
            var node = document.querySelector('rect.wdrag');
            var pos = getRectCenter(node);

            expect(node).toBeClassed(['drag', 'wdrag', 'cursor-w-resize']);

            expect(gd.layout.xaxis.range).toBeCloseToArray(autoRangeX);
            expect(gd.layout.yaxis.range).toBeCloseToArray(autoRangeY);

            drag({pos0: pos, dpos: [50, 50]})
            .then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray([-3.40349007, 2.15613055]);
                expect(gd.layout.yaxis.range).toBeCloseToArray(autoRangeY);
            })
            .then(function() {
                return drag({pos0: pos, dpos: [-50, -50]});
            }).then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray([-2.93933740, 2.15613055]);
                expect(gd.layout.yaxis.range).toBeCloseToArray(autoRangeY);
            })
            .then(done, done.fail);
        });

        it('on e dragbox should update the xaxis range', function(done) {
            var node = document.querySelector('rect.edrag');
            var pos = getRectCenter(node);

            expect(node).toBeClassed(['drag', 'edrag', 'cursor-e-resize']);

            expect(gd.layout.xaxis.range).toBeCloseToArray(autoRangeX);
            expect(gd.layout.yaxis.range).toBeCloseToArray(autoRangeY);

            drag({pos0: pos, dpos: [50, 50]}).then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray([-3.01196749, 1.7246647]);
                expect(gd.layout.yaxis.range).toBeCloseToArray(autoRangeY);
            })
            .then(function() {
                return drag({pos0: pos, dpos: [-50, 50]});
            }).then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray([-3.01196749, 2.0835004]);
                expect(gd.layout.yaxis.range).toBeCloseToArray(autoRangeY);
            })
            .then(done, done.fail);
        });

        it('on ns dragbox should update the yaxis range', function(done) {
            var node = document.querySelector('rect.nsdrag');
            var pos = getRectCenter(node);

            expect(node).toBeClassed(['drag', 'nsdrag', 'cursor-ns-resize']);

            expect(gd.layout.xaxis.range).toBeCloseToArray(autoRangeX);
            expect(gd.layout.yaxis.range).toBeCloseToArray(autoRangeY);

            drag({pos0: pos, dpos: [10, 50]})
            .then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray(autoRangeX);
                expect(gd.layout.yaxis.range).toBeCloseToArray([-0.59427673, 1.78611460]);
            })
            .then(function() {
                return drag({pos0: pos, dpos: [-10, -50]});
            })
            .then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray(autoRangeX);
                expect(gd.layout.yaxis.range).toBeCloseToArray(autoRangeY);
            })
            .then(done, done.fail);
        });

        it('on s dragbox should update the yaxis range', function(done) {
            var node = document.querySelector('rect.sdrag');
            var pos = getRectCenter(node);

            expect(node).toBeClassed(['drag', 'sdrag', 'cursor-s-resize']);

            expect(gd.layout.xaxis.range).toBeCloseToArray(autoRangeX);
            expect(gd.layout.yaxis.range).toBeCloseToArray(autoRangeY);

            drag({pos0: pos, dpos: [10, 50]})
            .then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray(autoRangeX);
                expect(gd.layout.yaxis.range).toBeCloseToArray([-0.3609421011, 1.3893827]);
            })
            .then(function() {
                return drag({pos0: pos, dpos: [-10, -50]});
            })
            .then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray(autoRangeX);
                expect(gd.layout.yaxis.range).toBeCloseToArray([-0.7110070646, 1.3893827]);
            })
            .then(done, done.fail);
        });

        it('on n dragbox should update the yaxis range', function(done) {
            var node = document.querySelector('rect.ndrag');
            var pos = getRectCenter(node);

            expect(node).toBeClassed(['drag', 'ndrag', 'cursor-n-resize']);

            expect(gd.layout.xaxis.range).toBeCloseToArray(autoRangeX);
            expect(gd.layout.yaxis.range).toBeCloseToArray(autoRangeY);

            drag({pos0: pos, dpos: [10, 50]})
            .then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray(autoRangeX);
                expect(gd.layout.yaxis.range).toBeCloseToArray([-0.991008630, 1.86546098]);
            })
            .then(function() {
                return drag({pos0: pos, dpos: [-10, -50]});
            })
            .then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray(autoRangeX);
                expect(gd.layout.yaxis.range).toBeCloseToArray([-0.991008630, 1.10938115]);
            })
            .then(done, done.fail);
        });
    });

    describe('double click interactions', function() {
        var setRangeX = [-3, 1];
        var setRangeY = [-0.5, 1];

        var zoomRangeX = [-2, 0];
        var zoomRangeY = [0, 0.5];

        var update = {
            'xaxis.range[0]': zoomRangeX[0],
            'xaxis.range[1]': zoomRangeX[1],
            'yaxis.range[0]': zoomRangeY[0],
            'yaxis.range[1]': zoomRangeY[1]
        };

        function setRanges(mockCopy) {
            mockCopy.layout.xaxis.autorange = false;
            mockCopy.layout.xaxis.range = setRangeX.slice();

            mockCopy.layout.yaxis.autorange = false;
            mockCopy.layout.yaxis.range = setRangeY.slice();

            return mockCopy;
        }

        it('when set to \'reset+autorange\' (the default) should work when \'autorange\' is on', function(done) {
            Plotly.newPlot(gd, mockCopy.data, mockCopy.layout)
            .then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray(autoRangeX);
                expect(gd.layout.yaxis.range).toBeCloseToArray(autoRangeY);

                return Plotly.relayout(gd, update);
            }).then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray(zoomRangeX);
                expect(gd.layout.yaxis.range).toBeCloseToArray(zoomRangeY);

                return doubleClick(blankPos[0], blankPos[1]);
            }).then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray(autoRangeX);
                expect(gd.layout.yaxis.range).toBeCloseToArray(autoRangeY);
            })
            .then(done, done.fail);
        });

        it('when set to \'reset+autorange\' (the default) should reset to set range on double click', function(done) {
            mockCopy = setRanges(mockCopy);

            Plotly.newPlot(gd, mockCopy.data, mockCopy.layout).then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray(setRangeX);
                expect(gd.layout.yaxis.range).toBeCloseToArray(setRangeY);

                return Plotly.relayout(gd, update);
            }).then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray(zoomRangeX);
                expect(gd.layout.yaxis.range).toBeCloseToArray(zoomRangeY);

                return doubleClick(blankPos[0], blankPos[1]);
            }).then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray(setRangeX);
                expect(gd.layout.yaxis.range).toBeCloseToArray(setRangeY);
            })
            .then(done, done.fail);
        });

        it('when set to \'reset+autorange\' (the default) should autosize on 1st double click and reset on 2nd', function(done) {
            mockCopy = setRanges(mockCopy);

            Plotly.newPlot(gd, mockCopy.data, mockCopy.layout).then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray(setRangeX);
                expect(gd.layout.yaxis.range).toBeCloseToArray(setRangeY);

                return doubleClick(blankPos[0], blankPos[1]);
            }).then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray(autoRangeX);
                expect(gd.layout.yaxis.range).toBeCloseToArray(autoRangeY);

                return doubleClick(blankPos[0], blankPos[1]);
            }).then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray(setRangeX);
                expect(gd.layout.yaxis.range).toBeCloseToArray(setRangeY);
            })
            .then(done, done.fail);
        });

        it('when set to \'reset+autorange\' (the default) should autosize on 1st double click and zoom when immediately dragged', function(done) {
            mockCopy = setRanges(mockCopy);

            Plotly.newPlot(gd, mockCopy.data, mockCopy.layout).then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray(setRangeX);
                expect(gd.layout.yaxis.range).toBeCloseToArray(setRangeY);

                return doubleClick(blankPos[0], blankPos[1]);
            })
            .then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray(autoRangeX);
                expect(gd.layout.yaxis.range).toBeCloseToArray(autoRangeY);

                return drag({pos0: [100, 100], posN: [200, 200], timeDelay: DBLCLICKDELAY / 2});
            })
            .then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray([-2.6480169249531356, -1.920115790911955]);
                expect(gd.layout.yaxis.range).toBeCloseToArray([0.4372261777201992, 1.2306899598686027]);
            })
            .then(done, done.fail);
        });

        it('when set to \'reset+autorange\' (the default) should follow updated auto ranges', function(done) {
            var updateData = {
                x: [[1e-4, 0, 1e3]],
                y: [[30, 0, 30]]
            };

            var newAutoRangeX = [-4.482371794871794, 3.4823717948717943];
            var newAutoRangeY = [-0.8892256657741471, 1.6689872212461876];

            Plotly.newPlot(gd, mockCopy.data, mockCopy.layout).then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray(autoRangeX);
                expect(gd.layout.yaxis.range).toBeCloseToArray(autoRangeY);

                return Plotly.relayout(gd, update);
            }).then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray(zoomRangeX);
                expect(gd.layout.yaxis.range).toBeCloseToArray(zoomRangeY);

                return Plotly.restyle(gd, updateData);
            }).then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray(zoomRangeX);
                expect(gd.layout.yaxis.range).toBeCloseToArray(zoomRangeY);

                return doubleClick(blankPos[0], blankPos[1]);
            }).then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray(newAutoRangeX);
                expect(gd.layout.yaxis.range).toBeCloseToArray(newAutoRangeY);

                return doubleClick(blankPos[0], blankPos[1]);
            }).then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray(newAutoRangeX);
                expect(gd.layout.yaxis.range).toBeCloseToArray(newAutoRangeY);
            })
            .then(done, done.fail);
        });

        it('when set to \'reset\' should work when \'autorange\' is on', function(done) {
            Plotly.newPlot(gd, mockCopy.data, mockCopy.layout, { doubleClick: 'reset' }).then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray(autoRangeX);
                expect(gd.layout.yaxis.range).toBeCloseToArray(autoRangeY);

                return Plotly.relayout(gd, update);
            }).then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray(zoomRangeX);
                expect(gd.layout.yaxis.range).toBeCloseToArray(zoomRangeY);

                return doubleClick(blankPos[0], blankPos[1]);
            }).then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray(autoRangeX);
                expect(gd.layout.yaxis.range).toBeCloseToArray(autoRangeY);
            })
            .then(done, done.fail);
        });

        it('when set to \'reset\' should reset to set range on double click', function(done) {
            mockCopy = setRanges(mockCopy);

            Plotly.newPlot(gd, mockCopy.data, mockCopy.layout, { doubleClick: 'reset' }).then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray(setRangeX);
                expect(gd.layout.yaxis.range).toBeCloseToArray(setRangeY);

                return Plotly.relayout(gd, update);
            }).then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray(zoomRangeX);
                expect(gd.layout.yaxis.range).toBeCloseToArray(zoomRangeY);

                return doubleClick(blankPos[0], blankPos[1]);
            }).then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray(setRangeX);
                expect(gd.layout.yaxis.range).toBeCloseToArray(setRangeY);
            })
            .then(done, done.fail);
        });

        it('when set to \'reset\' should reset on all double clicks', function(done) {
            mockCopy = setRanges(mockCopy);

            Plotly.newPlot(gd, mockCopy.data, mockCopy.layout, { doubleClick: 'reset' }).then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray(setRangeX);
                expect(gd.layout.yaxis.range).toBeCloseToArray(setRangeY);

                return doubleClick(blankPos[0], blankPos[1]);
            }).then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray(setRangeX);
                expect(gd.layout.yaxis.range).toBeCloseToArray(setRangeY);
            })
            .then(done, done.fail);
        });

        it('when set to \'autosize\' should work when \'autorange\' is on', function(done) {
            Plotly.newPlot(gd, mockCopy.data, mockCopy.layout, { doubleClick: 'autosize' }).then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray(autoRangeX);
                expect(gd.layout.yaxis.range).toBeCloseToArray(autoRangeY);

                return Plotly.relayout(gd, update);
            }).then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray(zoomRangeX);
                expect(gd.layout.yaxis.range).toBeCloseToArray(zoomRangeY);

                return doubleClick(blankPos[0], blankPos[1]);
            }).then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray(autoRangeX);
                expect(gd.layout.yaxis.range).toBeCloseToArray(autoRangeY);
            })
            .then(done, done.fail);
        });

        it('when set to \'autosize\' should set to autorange on double click', function(done) {
            mockCopy = setRanges(mockCopy);

            Plotly.newPlot(gd, mockCopy.data, mockCopy.layout, { doubleClick: 'autosize' }).then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray(setRangeX);
                expect(gd.layout.yaxis.range).toBeCloseToArray(setRangeY);

                return Plotly.relayout(gd, update);
            }).then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray(zoomRangeX);
                expect(gd.layout.yaxis.range).toBeCloseToArray(zoomRangeY);

                return doubleClick(blankPos[0], blankPos[1]);
            }).then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray(autoRangeX);
                expect(gd.layout.yaxis.range).toBeCloseToArray(autoRangeY);
            })
            .then(done, done.fail);
        });

        it('when set to \'autosize\' should reset on all double clicks', function(done) {
            mockCopy = setRanges(mockCopy);

            Plotly.newPlot(gd, mockCopy.data, mockCopy.layout, { doubleClick: 'autosize' }).then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray(setRangeX);
                expect(gd.layout.yaxis.range).toBeCloseToArray(setRangeY);

                return doubleClick(blankPos[0], blankPos[1]);
            }).then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray(autoRangeX);
                expect(gd.layout.yaxis.range).toBeCloseToArray(autoRangeY);
            })
            .then(done, done.fail);
        });

        it('should not try to autorange fixedrange:true axes when rangeInitial is not set', function(done) {
            var fig = {
                data: [{
                    x: [1, 2, 3, 4],
                    y: [1, 2, 3, 4]
                }, {
                    x: [1, 2, 3, 4],
                    y: [0.2, 999, 0.3, 0.4],
                    yaxis: 'y2'
                }],
                layout: {
                    xaxis: {
                        title: {text: 'xaxis'},
                        range: [0, 4]
                    },
                    yaxis: {
                        titel: 'yaxis',
                        range: [-1, 5]
                    },
                    yaxis2: {
                        title: { text: 'yaxis2' },
                        overlaying: 'y',
                        side: 'right',
                        showgrid: false,
                        zeroline: false,
                        range: [-1, 1],
                        fixedrange: true
                    },
                    width: 500,
                    height: 500
                }
            };

            function _assert(msg, exp) {
                var fullLayout = gd._fullLayout;
                var xa = fullLayout.xaxis;
                var ya = fullLayout.yaxis;
                var ya2 = fullLayout.yaxis2;

                expect(xa._rangeInitial0).toBe(undefined);
                expect(xa._rangeInitial1).toBe(undefined);

                expect(ya._rangeInitial0).toBe(undefined);
                expect(ya._rangeInitial1).toBe(undefined);

                expect(ya2._rangeInitial0).toBe(undefined);
                expect(ya2._rangeInitial1).toBe(undefined);

                expect(xa.range).toBeCloseToArray(exp.xRng, 1, msg);
                expect(ya.range).toBeCloseToArray(exp.yRng, 1, msg);
                expect(ya2.range).toBeCloseToArray(exp.y2Rng, 1, msg);
            }

            Plotly.newPlot(gd, [], {})
            .then(function() {
                expect(gd._fullLayout.xaxis._rangeInitial0).toBe(undefined);
                expect(gd._fullLayout.xaxis._rangeInitial1).toBe(undefined);

                expect(gd._fullLayout.yaxis._rangeInitial0).toBe(undefined);
                expect(gd._fullLayout.yaxis._rangeInitial1).toBe(undefined);

                expect(gd._fullLayout.yaxis2).toBe(undefined);
            })
            .then(function() { return Plotly.react(gd, fig); })
            .then(function() {
                _assert('after react into fig', {
                    xRng: [0, 4],
                    yRng: [-1, 5],
                    y2Rng: [-1, 1]
                });
            })
            .then(function() { return drag({pos0: [200, 200], posN: [250, 250]}); })
            .then(function() {
                _assert('after zoom', {
                    xRng: [1.509, 2.138],
                    yRng: [2.187, 3.125],
                    y2Rng: [-1, 1]
                });
            })
            .then(function() { return doubleClick(250, 250); })
            .then(function() {
                _assert('after double click autorange', {
                    xRng: [0.788, 4.211],
                    yRng: [0.788, 4.211],
                    y2Rng: [-1, 1]
                });
            })
            .then(function() { return doubleClick(250, 250); })
            .then(function() {
                // more info in: https://github.com/plotly/plotly.js/issues/2718
                _assert('after 2nd double click autorange (does not reset as rangeInitial is not set)', {
                    xRng: [0.788, 4.211],
                    yRng: [0.788, 4.211],
                    y2Rng: [-1, 1]
                });
            })
            .then(done, done.fail);
        });

        it('when set to \'reset+autorange\' (the default) should autosize on 1st and 2nd double clicks (case of partial ranges)', function(done) {
            mockCopy = setRanges(mockCopy);

            Plotly.newPlot(gd, [{
                y: [1, 2, 3, 4]}
            ], {
                xaxis: {range: [1, null]},
                yaxis: {range: [null, 3]},
                width: 600,
                height: 600
            }).then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray([1, 3.2]);
                expect(gd.layout.yaxis.range).toBeCloseToArray([0.8, 3]);

                return doubleClick(300, 300);
            })
            .then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray([-0.2, 3.2]);
                expect(gd.layout.yaxis.range).toBeCloseToArray([0.8, 4.2]);

                return doubleClick(300, 300);
            })
            .then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray([1, 3.2]);
                expect(gd.layout.yaxis.range).toBeCloseToArray([0.8, 3]);
            })
            .then(done, done.fail);
        });

        it('when set to \'reset+autorange\' (the default) should autosize on 1st and 2nd double clicks (insiderange and inside tick lables)', function(done) {
            mockCopy = setRanges(mockCopy);

            Plotly.newPlot(gd, [{
                y: [0, 1, 2, 3]}
            ], {
                xaxis: {insiderange: [1, 2]},
                yaxis: {ticks: 'inside', ticklabelposition: 'inside', side: 'right'},
                plot_bgcolor: 'lightgray',
                width: 600,
                height: 600
            }).then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray([1, 2.068], 1);

                return doubleClick(300, 300);
            })
            .then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray([-0.2019, 3.249], 1);

                return doubleClick(300, 300);
            })
            .then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray([1, 2.068], 1);
            })
            .then(done, done.fail);
        });
    });

    describe('zoom interactions', function() {
        beforeEach(function(done) {
            Plotly.newPlot(gd, mockCopy.data, mockCopy.layout).then(done);
        });

        it('on main dragbox should update the axis ranges', function(done) {
            expect(gd.layout.xaxis.range).toBeCloseToArray(autoRangeX);
            expect(gd.layout.yaxis.range).toBeCloseToArray(autoRangeY);

            drag({pos0: [93, 93], posN: [393, 293]}).then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray([-2.69897000, -0.515266602]);
                expect(gd.layout.yaxis.range).toBeCloseToArray([-0.30069513, 1.2862324246]);

                return drag({pos0: [93, 93], posN: [393, 293]});
            }).then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray([-2.56671754, -1.644025966]);
                expect(gd.layout.yaxis.range).toBeCloseToArray([0.159513853, 1.2174655634]);
            })
            .then(done, done.fail);
        });
    });

    describe('scroll zoom interactions', function() {
        beforeEach(function(done) {
            Plotly.newPlot(gd, mockCopy.data, mockCopy.layout, { scrollZoom: true }).then(done);
        });

        it('zooms in on scroll up', function() {
            var plot = gd._fullLayout._plots.xy.plot;

            mouseEvent('mousemove', 393, 243);
            mouseEvent('scroll', 393, 243, { deltaX: 0, deltaY: -20 });

            var transform = plot.attr('transform');

            var mockEl = {
                attr: function() {
                    return transform;
                }
            };

            var translate = Drawing.getTranslate(mockEl);
            var scale = Drawing.getScale(mockEl);

            expect([translate.x, translate.y]).toBeCloseToArray([13.93, 62.86]);
            expect([scale.x, scale.y]).toBeCloseToArray([1.105, 1.105]);
        });
    });

    describe('pan interactions', function() {
        beforeEach(function(done) {
            mockCopy.layout.dragmode = 'pan';

            Plotly.newPlot(gd, mockCopy.data, mockCopy.layout).then(done);
        });

        it('on main dragbox should update the axis ranges', function(done) {
            expect(gd.layout.xaxis.range).toBeCloseToArray(autoRangeX);
            expect(gd.layout.yaxis.range).toBeCloseToArray(autoRangeY);

            drag({pos0: [93, 93], posN: [393, 293]}).then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray([-5.19567089, -0.02757284]);
                expect(gd.layout.yaxis.range).toBeCloseToArray([0.595918934, 2.976310280]);

                return drag({pos0: [93, 93], posN: [393, 293]});
            }).then(function() {
                expect(gd.layout.xaxis.range).toBeCloseToArray([-7.37937429, -2.21127624]);
                expect(gd.layout.yaxis.range).toBeCloseToArray([2.182846498, 4.563237844]);
            })
            .then(done, done.fail);
        });


        it('should move the plot when panning', function(done) {
            var start = 100;
            var end = 300;
            var plot = gd._fullLayout._plots.xy.plot;

            var fns = drag.makeFns({pos0: [start, start], posN: [end, end]});

            fns.start().then(function() {
                expect(plot.attr('transform')).toBe('translate(250,280)scale(1,1)');
            })
            .then(fns.end)
            .then(done, done.fail);
        });
    });
});

describe('Click events in Shadow DOM', function() {
    afterEach(destroyGraphDiv);

    function fig() {
        var x = [];
        var y = [];
        for (var i = 0; i <= 20; i++) {
            for (var j = 0; j <= 20; j++) {
                x.push(i);
                y.push(j);
            }
        }
        return {
            data: [{x: x, y: y, mode: 'markers'}],
            layout: {
                width: 400,
                height: 400,
                margin: {l: 100, r: 100, t: 100, b: 100},
                xaxis: {range: [0, 20]},
                yaxis: {range: [0, 20]},
            }
        };
    }

    it('should select the same point in regular and shadow DOM', function(done) {
        var clickData;
        var clickX = 120;
        var clickY = 150;
        var expectedX = 2;  // counts up 1 every 10px from 0 at 100px
        var expectedY = 15;  // counts down 1 every 10px from 20 at 100px

        function check(gd) {
            gd.on('plotly_click', function(event) { clickData = event; });
            click(clickX, clickY);
            expect(clickData.points.length).toBe(1);
            var pt = clickData.points[0];
            expect(pt.x).toBe(expectedX);
            expect(pt.y).toBe(expectedY);
            clickData = null;
        }

        Plotly.newPlot(createGraphDiv(), fig())
        .then(check)
        .then(destroyGraphDiv)
        .then(function() { return Plotly.newPlot(createShadowGraphDiv(), fig()) })
        .then(check)
        .then(done, done.fail);
    });
});


describe('dragbox', function() {
    afterEach(destroyGraphDiv);

    it('should scale subplot and inverse scale scatter points', function(done) {
        var mock = Lib.extendDeep({}, require('../../image/mocks/bar_line.json'));

        function assertScale(node, x, y) {
            var scale = Drawing.getScale(node);
            expect(scale.x).toBeCloseTo(x, 1);
            expect(scale.y).toBeCloseTo(y, 1);
        }

        Plotly.newPlot(createGraphDiv(), mock).then(function() {
            var node = d3Select('rect.nedrag').node();
            var pos = getRectCenter(node);
            var fns = drag.makeFns({pos0: pos, dpos: [50, 0]});

            assertScale(d3Select('.overplot').select('.xy').node(), 1, 1);

            d3SelectAll('.point').each(function() {
                assertScale(this, 1, 1);
            });

            fns.start().then(function() {
                assertScale(d3Select('.overplot').select('.xy').node(), 1.14, 1);

                d3Select('.scatterlayer').selectAll('.point').each(function() {
                    assertScale(this, 0.87, 1);
                });
                d3Select('.barlayer').selectAll('.point').each(function() {
                    assertScale(this, 1, 1);
                });
            })
            .then(fns.end)
            .then(done, done.fail);
        });
    });
});
