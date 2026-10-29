// Visible top edges of windows: the platforms he can walk on while roaming.
// rects: [{ id, l, t, r, b }] topmost first. A window higher in z-order hides the part of an edge it lies across.
function topEdges(rects, minWidth = 60) {
  const edges = [];
  rects.forEach((w, i) => {
    let segs = [[w.l, w.r]];
    for (const a of rects.slice(0, i)) {
      if (a.t > w.t || a.b <= w.t) continue; // doesn't cross this edge's line
      segs = segs.flatMap(([x1, x2]) => [[x1, Math.min(x2, a.l)], [Math.max(x1, a.r), x2]]);
    }
    for (const [x1, x2] of segs) if (x2 - x1 >= minWidth) edges.push({ id: w.id, x1, x2, top: w.t });
  });
  return edges;
}

module.exports = { topEdges };

if (require.main === module) { // node roam/edges.js
  const assert = require('assert');
  // A lies on top of B and covers B's edge from 100 to 300
  assert.deepStrictEqual(topEdges([{ id: 'A', l: 100, t: 50, r: 300, b: 400 }, { id: 'B', l: 0, t: 200, r: 500, b: 600 }]), [
    { id: 'A', x1: 100, x2: 300, top: 50 }, { id: 'B', x1: 0, x2: 100, top: 200 }, { id: 'B', x1: 300, x2: 500, top: 200 },
  ]);
  // a window that starts below another's edge doesn't hide it; a covered edge disappears
  assert.equal(topEdges([{ id: 'A', l: 0, t: 300, r: 500, b: 400 }, { id: 'B', l: 0, t: 200, r: 500, b: 600 }]).length, 2);
  assert.equal(topEdges([{ id: 'A', l: 0, t: 0, r: 900, b: 900 }, { id: 'B', l: 100, t: 200, r: 500, b: 600 }]).length, 1);
  console.log('edges ok');
}
