/**
 * Vá lại trường Duration trong header .webm do MediaRecorder tạo ra.
 *
 * Chrome's MediaRecorder CÓ ghi 1 trường Duration vào Segment>Info>Duration khi dừng ghi, nhưng
 * giá trị đó gần như luôn SAI — đã verify bằng cách tự parse EBML trực tiếp trên 1 file evidence
 * thật (tải về từ Supabase, soi bằng ffprobe): giá trị ghi ra chỉ là "1" đơn vị TimecodeScale
 * (tức 1ms), dù nội dung video giải mã ra đủ 150 frame ~10s không thiếu gì. Vì giá trị này > 0
 * nên thư viện phổ biến "fix-webm-duration" coi là "đã có duration hợp lệ" và BỎ QUA không sửa
 * (điều kiện gốc của thư viện đó: chỉ fix khi value <= 0) — nên phải tự parse + ghi đè thủ công
 * ở đây, LUÔN ghi đè bất kể giá trị cũ là gì.
 *
 * Segment (element ngoài cùng, ghi trong lúc đang record trực tiếp) dùng kích thước "unknown"
 * theo chuẩn EBML (marker đặc biệt toàn bit 1, nghĩa là "đọc tới hết file") — nên KHÔNG thể định
 * vị Duration bằng cách quét-rồi-so-khớp-độ-dài ở từng cấp cha (đã thử, sai). Giải pháp đúng: xác
 * định offset TUYỆT ĐỐI của Duration ngay trong 1 lượt parse từ ngoài vào trong, rồi ghi đè trực
 * tiếp tại đúng offset đó trong buffer gốc — vì bề rộng byte mới luôn bằng bề rộng byte cũ (chỉ
 * đổi giá trị, không đổi kích thước) nên không cần viết lại độ dài của bất kỳ container cha nào.
 */

const ID_SEGMENT = 0x8538067;
const ID_INFO = 0x549a966;
const ID_DURATION = 0x489;
const ID_TIMECODE_SCALE = 0xad7b1;

interface ByteRange {
  dataStart: number;
  dataEnd: number;
}

function readVarUint(source: Uint8Array, offset: { pos: number }): number {
  const firstByte = source[offset.pos];
  const bytes = 8 - firstByte.toString(2).length;
  let value = firstByte - (1 << (7 - bytes));
  offset.pos += 1;
  for (let i = 0; i < bytes; i += 1) {
    value = value * 256 + source[offset.pos];
    offset.pos += 1;
  }
  return value;
}

/** Tìm offset tuyệt đối (trong `buffer` gốc) của con trực tiếp đầu tiên có id khớp, trong khoảng [containerStart, containerEnd). */
function findChildRange(
  buffer: Uint8Array,
  containerStart: number,
  containerEnd: number,
  childId: number,
): ByteRange | null {
  const offset = { pos: containerStart };
  while (offset.pos < containerEnd) {
    const id = readVarUint(buffer, offset);
    const len = readVarUint(buffer, offset);
    const dataStart = offset.pos;
    // len có thể là marker "unknown size" (số khổng lồ, không có thật) — luôn kẹp lại theo
    // containerEnd để không đọc tràn ra ngoài phạm vi container cha.
    const dataEnd = Math.min(dataStart + len, containerEnd);
    if (id === childId) return { dataStart, dataEnd };
    offset.pos = dataEnd;
  }
  return null;
}

function floatArrayType(byteLength: number) {
  return byteLength === 4 ? Float32Array : Float64Array;
}

function readPlainUint(bytes: Uint8Array): number {
  let value = 0;
  for (let i = 0; i < bytes.length; i += 1) value = value * 256 + bytes[i];
  return value;
}

function encodeFloat(value: number, byteLength: number): Uint8Array {
  const FloatType = floatArrayType(byteLength);
  const floatArray = new FloatType([value]);
  return new Uint8Array(floatArray.buffer).reverse();
}

/**
 * Vá duration của 1 blob .webm, LUÔN ghi đè (không kiểm tra giá trị cũ). Trả về blob gốc không
 * đổi nếu không tìm thấy cấu trúc Segment/Info/TimecodeScale/Duration mong đợi (file dạng khác,
 * không sao — evidence vẫn upload/hiển thị bình thường, chỉ là không vá được duration).
 */
export async function patchWebmDuration(blob: Blob, durationMs: number): Promise<Blob> {
  const buffer = new Uint8Array(await blob.arrayBuffer());

  const segmentRange = findChildRange(buffer, 0, buffer.length, ID_SEGMENT);
  if (!segmentRange) {
    console.warn('[patchWebmDuration] Segment section not found — buffer length:', buffer.length);
    return blob;
  }

  const infoRange = findChildRange(buffer, segmentRange.dataStart, segmentRange.dataEnd, ID_INFO);
  if (!infoRange) {
    console.warn('[patchWebmDuration] Info section not found inside Segment.');
    return blob;
  }

  const timeScaleRange = findChildRange(buffer, infoRange.dataStart, infoRange.dataEnd, ID_TIMECODE_SCALE);
  const durationRange = findChildRange(buffer, infoRange.dataStart, infoRange.dataEnd, ID_DURATION);
  if (!timeScaleRange || !durationRange) {
    console.warn('[patchWebmDuration] TimecodeScale or Duration section not found inside Info.', { hasTimeScale: !!timeScaleRange, hasDuration: !!durationRange });
    return blob;
  }

  const timeScaleNs = readPlainUint(buffer.slice(timeScaleRange.dataStart, timeScaleRange.dataEnd));
  if (!timeScaleNs) {
    console.warn('[patchWebmDuration] TimecodeScale value is 0/invalid.');
    return blob;
  }

  console.log('[patchWebmDuration] Patching OK — timeScaleNs:', timeScaleNs, 'old duration bytes width:', durationRange.dataEnd - durationRange.dataStart);

  const durationTicks = durationMs * (1_000_000 / timeScaleNs);
  const byteWidth = durationRange.dataEnd - durationRange.dataStart;
  const newDurationBytes = encodeFloat(durationTicks, byteWidth);

  const patched = Uint8Array.from(buffer);
  patched.set(newDurationBytes, durationRange.dataStart);

  return new Blob([patched], { type: blob.type });
}
