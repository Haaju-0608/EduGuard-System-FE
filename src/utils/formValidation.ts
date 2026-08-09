// Validate phía FE khớp với validate.txt BE gửi (User/Institution DTOs) — chặn sớm các trường hợp rõ
// ràng sai trước khi submit, tránh round-trip rồi mới nhận 400. BE vẫn là nguồn validate thật sự.

export const MAX_FULLNAME_LENGTH = 255;
export const MAX_PHONE_LENGTH = 10;
export const MAX_STUDENT_CODE_LENGTH = 50;
export const MAX_INSTITUTION_NAME_LENGTH = 255;
export const MAX_SUBDOMAIN_LENGTH = 100;

/** Số điện thoại nội địa VN: đúng 10 chữ số, bắt đầu bằng 0 — không nhận dấu +, khoảng trắng hay
 *  gạch ngang. */
const PHONE_REGEX = /^0\d{9}$/;

export function isValidPhone(phone: string): boolean {
  return PHONE_REGEX.test(phone.trim());
}

/** Đúng regex BE yêu cầu cho Institution.SubDomain: ^[a-z0-9-]+$ */
export const SUBDOMAIN_REGEX = /^[a-z0-9-]+$/;
