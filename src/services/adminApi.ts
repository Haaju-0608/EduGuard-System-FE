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
  billingModel: 'PerUse' | 'Subscription' | 'Free';
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

// ─── Pricing Configs ──────────────────────────────────────────────────────

/** GET /api/pricing-configs */
export async function fetchPricingConfigs(): Promise<ApiPricingConfig[]> {
  return apiGet<ApiPricingConfig[]>('/api/pricing-configs');
}

/** GET /api/pricing-configs/active/{serviceType} */
export async function fetchActivePricing(
  serviceType: 'Attendance' | 'Proctoring' | 'BiometricRegistration',
): Promise<ApiPricingConfig> {
  return apiGet<ApiPricingConfig>(`/api/pricing-configs/active/${serviceType}`);
}

export interface CreatePricingPayload {
  serviceType: 'Attendance' | 'Proctoring' | 'BiometricRegistration';
  unitPrice: number;
  effectiveDate: string;
}

/** POST /api/pricing-configs */
export async function createPricingConfig(
  payload: CreatePricingPayload,
): Promise<ApiPricingConfig> {
  return apiPost<ApiPricingConfig>('/api/pricing-configs', payload);
}
