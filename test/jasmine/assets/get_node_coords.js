/*
 * get the pixel coordinates of a node on screen
 * optionally specify an edge ('n', 'se', 'w' etc)
 * to return an edge or corner (otherwise the middle is used)
 */
module.exports = function(node, edge) {
    edge = edge || '';
    console.log('getNodeCoords()');
    console.log('    node.outerHTML', node.outerHTML);
    console.log('    document contains node?', document.body.contains(node));
    var bbox = node.getBoundingClientRect();
    var getbbox = node.getBBox();
    console.log('    bounding client rect', {x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height});
    console.log('    bounding box', {x: getbbox.x, y: getbbox.y, width: getbbox.width, height: getbbox.height});
    var x, y;

    if(edge.indexOf('n') !== -1) y = bbox.top;
    else if(edge.indexOf('s') !== -1) y = bbox.bottom;
    else y = (bbox.bottom + bbox.top) / 2;

    if(edge.indexOf('w') !== -1) x = bbox.left;
    else if(edge.indexOf('e') !== -1) x = bbox.right;
    else x = (bbox.left + bbox.right) / 2;

    console.log('    returning coords:', {x: x, y: y});

    return {x: x, y: y};
};
