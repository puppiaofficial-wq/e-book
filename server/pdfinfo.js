/**
 * Measures how much real resolution a PDF page actually carries.
 *
 * A catalog exported as flattened artwork holds one big raster image per page,
 * and rendering it above that image's own resolution only invents pixels: the
 * result is softer than rendering at the source size, and it lets the viewer
 * magnify far past the point where anything is left to see. Knowing the true
 * ceiling lets both stop at the right place.
 */

/** Pixel dimensions of every image XObject reachable from a page. */
function imageObjects(pdfPage) {
  const found = [];
  const seen = new Set();

  const walk = (node, depth) => {
    if (!node || depth > 4) return;
    let resources;
    try {
      resources = node.getInheritable ? node.getInheritable('Resources') : node.get('Resources');
    } catch {
      return;
    }
    if (!resources || !resources.isDictionary()) return;

    let xobjects;
    try {
      xobjects = resources.get('XObject');
    } catch {
      return;
    }
    if (!xobjects || !xobjects.isDictionary()) return;

    xobjects.forEach((value) => {
      try {
        const reference = value.toString();
        if (seen.has(reference)) return;
        seen.add(reference);
        const object = value.resolve ? value.resolve() : value;
        const subtype = object.get('Subtype');
        const name = subtype && subtype.isName() ? subtype.asName() : '';
        if (name === 'Image') {
          found.push({ w: object.get('Width').asNumber(), h: object.get('Height').asNumber() });
        } else if (name === 'Form') {
          walk(object, depth + 1);
        }
      } catch {
        /* a malformed entry should not sink the whole measurement */
      }
    });
  };

  try {
    walk(pdfPage.getObject(), 0);
  } catch {
    return [];
  }
  return found;
}

/** Where each image sits on the page, in points. */
function imageBoxes(pdfPage) {
  try {
    const json = JSON.parse(pdfPage.toStructuredText('preserve-images').asJSON());
    return (json.blocks || [])
      .filter((block) => block.type === 'image' && block.bbox?.w > 0)
      .map((block) => block.bbox);
  } catch {
    return [];
  }
}

/**
 * The width in pixels the page would have if its dominant image filled it.
 * Returns null when the page has no raster content to be limited by.
 */
export function sourceWidthOf(pdfPage, pageWidthPt) {
  const objects = imageObjects(pdfPage);
  if (!objects.length) return null;

  const boxes = imageBoxes(pdfPage);
  if (boxes.length === objects.length && boxes.length > 0) {
    // Same count on both sides: pair them by size and trust the biggest one,
    // which is the image a reader actually zooms into.
    const byArea = [...boxes].sort((a, b) => b.w * b.h - a.w * a.h);
    const byPixels = [...objects].sort((a, b) => b.w * b.h - a.w * a.h);
    const box = byArea[0];
    const pixels = byPixels[0];
    if (box.w > pageWidthPt * 0.2) {
      return Math.round(pixels.w * (pageWidthPt / box.w));
    }
  }
  return Math.max(...objects.map((image) => image.w));
}
