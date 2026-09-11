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

/** Smallest share of the page width an image must cover to be measured. */
const MEANINGFUL = 0.15;

/**
 * How many pixels the page would need to show its sharpest sizeable image at
 * full detail. Null when there is no raster content, or when the artwork
 * cannot be measured confidently - capping on a bad guess would throw away
 * detail that is really there, so an unknown page is left uncapped.
 */
export function sourceWidthOf(pdfPage, pageWidthPt) {
  const objects = imageObjects(pdfPage);
  if (!objects.length) return null;

  const boxes = imageBoxes(pdfPage).filter((box) => box.w >= pageWidthPt * MEANINGFUL);
  if (!boxes.length) return null;

  // Match each placed rectangle to the image whose proportions fit it best.
  const pool = [...objects];
  let best = 0;
  for (const box of boxes.sort((a, b) => b.w * b.h - a.w * a.h)) {
    const wanted = box.w / box.h;
    let pick = -1;
    let closest = Infinity;
    pool.forEach((image, index) => {
      const distance = Math.abs(Math.log((image.w / image.h) / wanted));
      if (distance < closest) {
        closest = distance;
        pick = index;
      }
    });
    if (pick < 0 || closest > 0.12) continue; // proportions too far apart to trust
    const [image] = pool.splice(pick, 1);
    best = Math.max(best, image.w * (pageWidthPt / box.w));
  }
  return best ? Math.round(best) : null;
}
