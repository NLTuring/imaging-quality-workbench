export const MAX_FILE_BYTES = 20 * 1024 * 1024;
function dimensions(width: number, height: number, mime: string) {
  if (width < 1 || height < 1 || width > 8192 || height > 8192 || width * height > 16777216) throw new Error('影像尺寸应小于 8192 × 8192，且总像素不超过 1600 万。');
  return { width, height, mime };
}
export function readImageHeader(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length >= 33 && signature.every((value, index) => bytes[index] === value)) {
    if (view.getUint32(8) !== 13 || view.getUint32(12) !== 0x49484452) throw new Error('PNG 图像头无效。');
    return dimensions(view.getUint32(16), view.getUint32(20), 'image/png');
  }
  if (bytes[0] === 255 && bytes[1] === 216) {
    let offset = 2;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset++] !== 255) throw new Error('JPEG 图像结构无效。');
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      if (offset + 2 > bytes.length) break;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) throw new Error('JPEG 图像片段无效。');
      if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)) {
        if (length < 8) throw new Error('JPEG 尺寸数据无效。');
        return dimensions(view.getUint16(offset + 5), view.getUint16(offset + 3), 'image/jpeg');
      }
      offset += length;
    }
    throw new Error('JPEG 中未找到有效的图像尺寸。');
  }
  throw new Error('仅支持有效的 PNG 或 JPEG 图像；DICOM 请先脱敏并导出图片。');
}
