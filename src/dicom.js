import dicomParser from 'dicom-parser';

export const MAX_FILE_BYTES = 128 * 1024 * 1024;
export const MAX_PIXELS = 16 * 1024 * 1024;
const SYNTAXES = new Set(['1.2.840.10008.1.2', '1.2.840.10008.1.2.1', '1.2.840.10008.1.2.2']);

function requireValid(condition, message) {
  if (!condition) throw new Error(message);
}

/** Decode native integer samples, including shifted stored bits and signed values. */
export function decodePixels(bytes, options) {
  const { rows, columns, bitsAllocated, bitsStored, highBit, pixelRepresentation,
    littleEndian = true, slope = 1, intercept = 0, offset = 0, length = bytes?.byteLength - offset } = options;
  requireValid(bytes instanceof Uint8Array, 'Pixel data must be bytes.');
  requireValid(Number.isInteger(rows) && rows > 0 && Number.isInteger(columns) && columns > 0 &&
    rows * columns <= MAX_PIXELS, 'Invalid or oversized image dimensions.');
  requireValid(bitsAllocated === 8 || bitsAllocated === 16, 'Only native 8-bit or 16-bit integer pixels are supported.');
  requireValid(Number.isInteger(bitsStored) && bitsStored > 0 && bitsStored <= bitsAllocated &&
    Number.isInteger(highBit) && highBit >= bitsStored - 1 && highBit < bitsAllocated, 'Invalid stored-bit layout.');
  requireValid(pixelRepresentation === 0 || pixelRepresentation === 1, 'Invalid pixel representation.');
  requireValid(Number.isFinite(slope) && slope !== 0 && Number.isFinite(intercept), 'Invalid rescale slope/intercept.');
  const count = rows * columns;
  const required = count * (bitsAllocated / 8);
  requireValid(Number.isSafeInteger(offset) && offset >= 0 && Number.isSafeInteger(length) &&
    length >= required && length <= required + (required % 2) && offset + length <= bytes.byteLength,
  'Truncated pixel data or invalid pixel data bounds/length.');
  const view = new DataView(bytes.buffer, bytes.byteOffset + offset, required);
  const pixels = new Float32Array(count);
  const shift = highBit - bitsStored + 1;
  const range = 2 ** bitsStored;
  const mask = range - 1;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < count; i++) {
    const raw = bitsAllocated === 8 ? view.getUint8(i) : view.getUint16(i * 2, littleEndian);
    let value = (raw >>> shift) & mask;
    if (pixelRepresentation === 1 && value >= range / 2) value -= range;
    pixels[i] = value * slope + intercept;
    requireValid(Number.isFinite(pixels[i]), 'Rescaled pixel value exceeds supported range.');
    min = Math.min(min, pixels[i]);
    max = Math.max(max, pixels[i]);
  }
  return { pixels, min, max };
}

/** DICOM LINEAR windowing, with MONOCHROME1 applied after the VOI transform. */
export function windowPixels(pixels, width, center, invert = false) {
  requireValid(Number.isFinite(width) && width >= 1 && Number.isFinite(center), 'Window width must be at least 1 and level must be finite.');
  requireValid(pixels instanceof Float32Array && pixels.length <= MAX_PIXELS, 'Invalid pixel buffer.');
  const rgba = new Uint8ClampedArray(pixels.length * 4);
  const low = center - 0.5 - (width - 1) / 2;
  const high = center - 0.5 + (width - 1) / 2;
  for (let i = 0; i < pixels.length; i++) {
    const value = pixels[i];
    let gray = value <= low ? 0 : value > high ? 255 : ((value - (center - 0.5)) / (width - 1) + 0.5) * 255;
    if (invert) gray = 255 - gray;
    rgba.set([gray, gray, gray, 255], i * 4);
  }
  return rgba;
}

function numbers(dataset, tag, count) {
  const text = dataset.string(tag);
  if (!text) return null;
  const values = text.split('\\').map(v => v.trim() === '' ? NaN : Number(v));
  return values.length === count && values.every(Number.isFinite) ? values : null;
}

function scalar(dataset, tag, fallback) {
  const text = dataset.string(tag);
  if (text === undefined || text.trim() === '') return fallback;
  const value = Number(text.split('\\')[0]);
  requireValid(Number.isFinite(value), `Invalid numeric DICOM attribute ${tag}.`);
  return value;
}

export function parseDicomFile(buffer, filename = 'DICOM') {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  requireValid(bytes.byteLength <= MAX_FILE_BYTES, 'File exceeds the 128 MiB safety limit.');
  requireValid(bytes.length >= 132 && bytes[128] === 68 && bytes[129] === 73 && bytes[130] === 67 && bytes[131] === 77,
    'A DICOM Part 10 file with a DICM header is required.');
  // Inspect file meta first: compressed/deflated payloads must never be inflated.
  let meta;
  try { meta = dicomParser.readPart10Header(bytes); }
  catch { throw new Error('Invalid DICOM file meta header.'); }
  const syntax = meta.string('x00020010')?.trim();
  requireValid(SYNTAXES.has(syntax), `Unsupported transfer syntax ${syntax || '(missing)'}: compression/deflation is not supported.`);
  let data;
  try { data = dicomParser.parseDicom(bytes); }
  catch { throw new Error('Malformed or truncated DICOM dataset.'); }
  const text = tag => data.string(tag)?.trim() || '';
  requireValid(text('x00080060') === 'CT', 'Only grayscale CT images are supported.');
  requireValid(scalar(data, 'x00280008', 1) === 1, 'Unsupported multiframe DICOM: only single-frame images are supported.');
  const photo = text('x00280004');
  requireValid(data.uint16('x00280002') === 1 && ['MONOCHROME1', 'MONOCHROME2'].includes(photo),
    'Unsupported color/photometric format: grayscale MONOCHROME1/2 is required.');
  requireValid(!data.elements.x00283000 && !data.elements.x00283010, 'Modality/VOI LUT sequences are not supported; linear rescale and windowing are required.');
  requireValid(!text('x00281056') || text('x00281056') === 'LINEAR', 'Only LINEAR VOI windowing is supported.');
  requireValid(!text('x20500020') || text('x20500020') === 'IDENTITY', 'Non-identity presentation LUTs are not supported.');
  const studyUID = text('x0020000d');
  const seriesUID = text('x0020000e');
  requireValid(studyUID && seriesUID, 'StudyInstanceUID and SeriesInstanceUID are required.');
  const pixel = data.elements.x7fe00010;
  requireValid(pixel && !pixel.encapsulatedPixelData && !pixel.hadUndefinedLength, 'Missing or encapsulated native PixelData.');
  const rows = data.uint16('x00280010');
  const columns = data.uint16('x00280011');
  const decoded = decodePixels(data.byteArray, {
    rows, columns, bitsAllocated: data.uint16('x00280100'), bitsStored: data.uint16('x00280101'),
    highBit: data.uint16('x00280102'), pixelRepresentation: data.uint16('x00280103'),
    littleEndian: syntax !== '1.2.840.10008.1.2.2', slope: scalar(data, 'x00281053', 1),
    intercept: scalar(data, 'x00281052', 0), offset: pixel.dataOffset, length: pixel.length,
  });
  const width = scalar(data, 'x00281051', NaN);
  const center = scalar(data, 'x00281050', NaN);
  const fallbackWidth = Math.max(1, decoded.max - decoded.min + 1);
  const spacing = numbers(data, 'x00280030', 2);
  return {
    ...decoded, rows, columns, filename, studyUID, seriesUID, sopUID: text('x00080018'),
    studyDescription: text('x00081030'), seriesDescription: text('x0008103e'),
    seriesNumber: text('x00200011'), instanceNumber: scalar(data, 'x00200013', NaN),
    position: numbers(data, 'x00200032', 3), orientation: numbers(data, 'x00200037', 6),
    spacing: spacing?.every(v => v > 0) ? spacing : [1, 1],
    invert: photo === 'MONOCHROME1',
    windowWidth: Number.isFinite(width) && width >= 1 && Number.isFinite(center) ? width : fallbackWidth,
    windowCenter: Number.isFinite(width) && width >= 1 && Number.isFinite(center) ? center : (decoded.max + decoded.min + 1) / 2,
  };
}

export function sortSlices(slices) {
  const sorted = [...slices];
  const orientation = sorted[0]?.orientation;
  let normal;
  if (orientation) {
    const [a, b, c, d, e, f] = orientation;
    normal = [b * f - c * e, c * d - a * f, a * e - b * d];
  }
  const spatial = normal && Math.hypot(...normal) > 0.99 && sorted.every(s =>
    s.position && s.orientation && s.orientation.every((v, i) => Math.abs(v - orientation[i]) < 0.001));
  const projection = s => s.position.reduce((sum, v, i) => sum + v * normal[i], 0);
  const instance = s => Number.isFinite(s.instanceNumber) ? s.instanceNumber : Infinity;
  sorted.sort((a, b) => (spatial ? projection(a) - projection(b) : 0) ||
    (instance(a) - instance(b)) || a.filename.localeCompare(b.filename, undefined, { numeric: true }));
  return sorted;
}

export function groupStudies(images) {
  const studies = new Map();
  for (const image of images) {
    if (!studies.has(image.studyUID)) studies.set(image.studyUID, { uid: image.studyUID, description: image.studyDescription, series: new Map() });
    const study = studies.get(image.studyUID);
    if (!study.series.has(image.seriesUID)) study.series.set(image.seriesUID, {
      uid: image.seriesUID, description: image.seriesDescription, number: image.seriesNumber, slices: [],
    });
    study.series.get(image.seriesUID).slices.push(image);
  }
  return [...studies.values()].map(study => ({ ...study,
    series: [...study.series.values()].map(series => ({ ...series, slices: sortSlices(series.slices) })),
  }));
}
