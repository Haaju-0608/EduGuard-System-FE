import type { ApiExamQuestion } from '../types/api';

const READING_MARKER = '__eduguardReading';

interface LegacyEncodedReadingContent {
  [READING_MARKER]: true;
  passage: string;
  question: string;
}

export interface ParsedQuestionContent {
  /** null nếu đây không phải câu hỏi Reading */
  passage: string | null;
  question: string;
}

/** BE (từ 15/08, xem `reading_passages` table + `ExamQuestion.PassageId`) là nguồn đúng cho câu
 *  hỏi Reading — `q.passageText` đã được BE trả kèm sẵn, không cần tự parse gì nữa. Hàm này chỉ
 *  còn giữ nhánh fallback để đọc được những câu hỏi Reading tạo TRƯỚC khi BE có bảng riêng (lúc đó
 *  FE lách bằng cách nhét JSON `{__eduguardReading, passage, question}` vào chính `questionContent`
 *  vì BE chưa có chỗ lưu đoạn văn dùng chung) — nếu không có nhánh này, các câu hỏi cũ sẽ hiện
 *  nguyên chuỗi JSON thô ra màn hình thay vì đoạn văn + câu hỏi.
 */
export function getPassageAndQuestion(q: Pick<ApiExamQuestion, 'questionContent' | 'passageText'>): ParsedQuestionContent {
  if (q.passageText) return { passage: q.passageText, question: q.questionContent };

  const trimmed = q.questionContent.trim();
  if (trimmed.startsWith('{')) {
    try {
      const obj = JSON.parse(trimmed) as Partial<LegacyEncodedReadingContent>;
      if (obj && obj[READING_MARKER] === true && typeof obj.question === 'string') {
        return { passage: typeof obj.passage === 'string' ? obj.passage : null, question: obj.question };
      }
    } catch {
      // Không phải JSON hợp lệ — coi như nội dung câu hỏi thường (fall through).
    }
  }
  return { passage: null, question: q.questionContent };
}

export interface QuestionGroup {
  /** null = câu hỏi thường (MCQ), không thuộc đoạn văn nào */
  passage: string | null;
  items: ApiExamQuestion[];
}

/** Gộp các câu hỏi Reading LIÊN TIẾP (theo displayOrder) cùng 1 đoạn văn thành 1 nhóm để hiển thị
 *  đoạn văn đúng 1 lần thay vì lặp lại ở mỗi câu con. Ưu tiên gộp theo `passageId` thật (câu hỏi
 *  mới) — chỉ so sánh nội dung đoạn văn (kém chính xác hơn, 2 đoạn văn trùng chữ tình cờ sẽ bị gộp
 *  nhầm) cho câu hỏi Reading cũ chưa có `passageId`. */
export function groupQuestionsByPassage(questions: ApiExamQuestion[]): QuestionGroup[] {
  const groups: (QuestionGroup & { key: string | null })[] = [];
  for (const q of questions) {
    const parsed = getPassageAndQuestion(q);
    const key = q.passageId ?? (parsed.passage !== null ? `text:${parsed.passage}` : null);
    const last = groups[groups.length - 1];
    if (key !== null && last && last.key === key) {
      last.items.push(q);
    } else {
      groups.push({ passage: parsed.passage, items: [q], key });
    }
  }
  return groups.map(({ passage, items }) => ({ passage, items }));
}
