/**
 * API Super Admin — institutions, pricing configs.
 */
import { apiDelete, apiGet, apiGetPaginated, apiPost, apiPut, buildQueryParams } from './apiClient';
import type {
  ApiInstitution,
  ApiPricingConfig,
  ListQueryParams,
  PagedResult,
} from '../types/api';

// ─── Institutions ─────────────────────────────────────────────────────────

/** GET /api/institutions */
export async function fetchInstitutions(
  params: ListQueryParams = {},
): Promise<PagedResult<ApiInstitution>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 50;
  const { data, pagination } = await apiGetPaginated<ApiInstitution[]>(
    `/api/institutions${buildQueryParams({ page, pageSize })}`,
  );
  return { items: data, pagination };
}

/** GET /api/institutions/{id} */
export async function fetchInstitutionById(id: string): Promise<ApiInstitution> {
  return apiGet<ApiInstitution>(`/api/institutions/${id}`);
}

export interface CreateInstitutionPayload {
  name: string;
  subDomain?: string;
  contactEmail?: string;
  // Khớp đúng tên enum thật của BE (Models/AppRole.cs: BillingModel.Monthly/Yearly, deserialize
  // qua JsonStringEnumConverter) — gửi tên khác sẽ bị BE từ chối 400 vì không khớp enum member nào.
  billingModel: 'Monthly' | 'Yearly';
  status?: 'Active' | 'Suspended' | 'Inactive';
}

/** POST /api/institutions */
export async function createInstitution(
  payload: CreateInstitutionPayload,
): Promise<ApiInstitution> {
  return apiPost<ApiInstitution>('/api/institutions', payload);
}

/** PUT /api/institutions/{id} */
export async function updateInstitution(
  id: string,
  payload: Partial<CreateInstitutionPayload>,
): Promise<ApiInstitution> {
  return apiPut<ApiInstitution>(`/api/institutions/${id}`, payload);
}

/** DELETE /api/institutions/{id} */
export async function deleteInstitution(id: string): Promise<void> {
  await apiDelete(`/api/institutions/${id}`);
}

/** Suspend: PUT /api/institutions/{id} với status=Suspended */
export async function suspendInstitution(id: string): Promise<ApiInstitution> {
  return apiPut<ApiInstitution>(`/api/institutions/${id}`, { status: 'Suspended' });
}

/** Activate: PUT /api/institutions/{id} với status=Active */
export async function activateInstitution(id: string): Promise<ApiInstitution> {
  return apiPut<ApiInstitution>(`/api/institutions/${id}`, { status: 'Active' });
}

/** POST /api/institutions/{id}/renew-subscription — chỉ SchoolAdmin. Gia hạn subscriptionExpiresAt
 *  thêm 1 tháng/năm tuỳ billingModel được CHỌN (school admin có thể vừa renew vừa đổi gói), tự
 *  un-suspend nếu đang Suspended. Không trả institution mới trong response — phải tự
 *  fetchInstitutionById lại sau khi gọi.
 *  QUAN TRỌNG: billingModel là field bắt buộc (enum non-nullable) bên BE (RenewSubscriptionDto) —
 *  không gửi kèm sẽ bị deserialize thành default enum member = Monthly (member 0), âm thầm ép mọi
 *  lần renew về gói Monthly + tính phí Monthly dù trường đang ở gói Yearly. */
export async function renewInstitutionSubscription(id: string, billingModel: 'Monthly' | 'Yearly'): Promise<void> {
  await apiPost<null>(`/api/institutions/${id}/renew-subscription`, { billingModel });
}

// ─── Pricing Configs ──────────────────────────────────────────────────────

/** GET /api/pricing-configs */
export async function fetchPricingConfigs(): Promise<ApiPricingConfig[]> {
  return apiGet<ApiPricingConfig[]>('/api/pricing-configs');
}

// Khớp đúng tên enum thật của BE (Models/AppRole.cs: PricingServiceType) — 4 loại: 2 loại tính theo
// lượt dùng (ATTENDANCE_UNIT/PROCTORING_PER_HOUR) + 2 loại phí gia hạn subscription theo billing
// model của trường (SUBSCRIPTION_MONTHLY/SUBSCRIPTION_YEARLY, dùng bởi InstitutionService.RenewSubscriptionAsync).
export interface CreatePricingPayload {
  serviceType: 'ATTENDANCE_UNIT' | 'PROCTORING_PER_HOUR' | 'SUBSCRIPTION_MONTHLY' | 'SUBSCRIPTION_YEARLY';
  unitPrice: number;
  effectiveDate: string;
}

/** POST /api/pricing-configs */
export async function createPricingConfig(
  payload: CreatePricingPayload,
): Promise<ApiPricingConfig> {
  return apiPost<ApiPricingConfig>('/api/pricing-configs', payload);
}

export interface UpdatePricingPayload extends CreatePricingPayload {
  isActive: boolean;
}

/** PUT /api/pricing-configs/{id} — chỉ SuperAdmin. BE (PricingConfigService.UpdateConfigAsync) từ
 *  chối đổi unitPrice nếu config này đã có Transaction tham chiếu (giữ nguyên số liệu lịch sử) —
 *  trường hợp đó phải tạo config mới (createPricingConfig) thay vì sửa cái cũ. Đổi serviceType/
 *  effectiveDate/isActive thì luôn được phép. */
export async function updatePricingConfig(
  id: string,
  payload: UpdatePricingPayload,
): Promise<void> {
  await apiPut<null>(`/api/pricing-configs/${id}`, payload);
}

// ─── Reports (Controllers/ReportsController.cs) ────────────────────────────
// Response shape khớp các anonymous object BE trả về (Services/ReportService.cs) — camelCase
// theo convention JSON serialization chung của BE, bất kể tên property gốc trong C# là gì.

export interface ReportFilters {
  institutionId?: string | null;
  from?: string | null;
  to?: string | null;
}

export interface AttendanceReportItem {
  id: string;
  classId: string;
  startTime: string;
  endTime: string | null;
  status: string;
  totalRecognized: number;
  totalStudents: number;
  records: number;
}
export interface AttendanceReport {
  filters: ReportFilters & { classId?: string | null };
  summary: {
    sessions: number;
    completed: number;
    totalRecognized: number;
    averageRecognitionRate: number;
  };
  items: AttendanceReportItem[];
}

export interface ViolationReportItem {
  violationId: string;
  participationId: string;
  examSlotId: string;
  examName: string;
  studentId: string;
  studentName: string;
  type: string;
  severity: string;
  aiConfidence: number | null;
  evidencePath: string | null;
  isReviewed: boolean;
  recordedAt: string;
}
export interface ViolationReport {
  filters: ReportFilters & { examSlotId?: string | null };
  summary: {
    total: number;
    reviewed: number;
    byType: { type: string; count: number }[];
    bySeverity: { severity: string; count: number }[];
  };
  items: ViolationReportItem[];
}

export interface WalletReportItem {
  id: string;
  walletId: string;
  amount: number;
  type: string;
  status: string;
  description: string | null;
  createdAt: string;
  processedAt: string | null;
}
export interface WalletReport {
  filters: ReportFilters & { walletId?: string | null };
  summary: {
    totalTransactions: number;
    successAmount: number;
    topUpAmount: number;
    feeAmount: number;
  };
  items: WalletReportItem[];
}

export interface RevenueReportItem {
  period: string;
  topUpAmount: number;
  attendanceFeeAmount: number;
  proctoringFeeAmount: number;
  serviceFeeAmount: number;
}
export interface RevenueReport {
  filters: { from?: string | null; to?: string | null; groupBy: string };
  summary: {
    topUpAmount: number;
    serviceFeeAmount: number;
    transactionCount: number;
  };
  items: RevenueReportItem[];
}

/** GET /api/reports/attendance */
export async function fetchAttendanceReport(
  params: { institutionId?: string; classId?: string; from?: string; to?: string } = {},
): Promise<AttendanceReport> {
  return apiGet<AttendanceReport>(`/api/reports/attendance${buildQueryParams(params)}`);
}

/** GET /api/reports/violations */
export async function fetchViolationReport(
  params: { institutionId?: string; examSlotId?: string; from?: string; to?: string } = {},
): Promise<ViolationReport> {
  return apiGet<ViolationReport>(`/api/reports/violations${buildQueryParams(params)}`);
}

/** GET /api/reports/wallet — SuperAdmin/SchoolAdmin */
export async function fetchWalletReport(
  params: { institutionId?: string; walletId?: string; from?: string; to?: string } = {},
): Promise<WalletReport> {
  return apiGet<WalletReport>(`/api/reports/wallet${buildQueryParams(params)}`);
}

/** GET /api/reports/revenue — SuperAdmin only */
export async function fetchRevenueReport(
  params: { from?: string; to?: string; groupBy?: 'day' | 'month' } = {},
): Promise<RevenueReport> {
  return apiGet<RevenueReport>(`/api/reports/revenue${buildQueryParams(params)}`);
}
