import React, { useState } from 'react';
import { FiRefreshCw } from 'react-icons/fi';
import Pagination from '../../../components/ui/Pagination';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { fetchInstitutions, fetchPricingConfigs } from '../../../services/adminApi';
import { fetchWallet } from '../../../services/schoolAdminApi';
import { billingModelLabel } from '../../../utils/billingModel';
import type { ApiInstitution, ApiPricingConfig } from '../../../types/api';

// Khớp đúng enum thật của BE (Models/AppRole.cs PricingServiceType) — không có "BiometricRegistration".
type ServiceType = 'ATTENDANCE_UNIT' | 'PROCTORING_PER_HOUR' | 'SUBSCRIPTION_MONTHLY' | 'SUBSCRIPTION_YEARLY';

const SERVICE_META: Record<string, { label: string; icon: string; color: string }> = {
  ATTENDANCE_UNIT: { label: 'Attendance', icon: '📋', color: 'text-blue-bright' },
  PROCTORING_PER_HOUR: { label: 'Proctoring', icon: '🎥', color: 'text-cyan' },
  SUBSCRIPTION_MONTHLY: { label: 'Monthly Sub.', icon: '🔄', color: 'text-gold' },
  SUBSCRIPTION_YEARLY: { label: 'Yearly Sub.', icon: '🗓️', color: 'text-green' },
};

// Fetches wallet + transactions for one institution
function useInstitutionWallet(inst: ApiInstitution) {
  return useAsyncData(() => fetchWallet(inst.id), [inst.id]);
}

function InstitutionWalletCard({ inst }: { inst: ApiInstitution }) {
  const { data: wallet, loading } = useInstitutionWallet(inst);

  return (
    <div className="bg-navy-card border border-border rounded-[20px] p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-blue/10 border border-blue/20 grid place-items-center text-sm font-bold text-blue-bright shrink-0">
          {(inst.name ?? '?').slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white-soft truncate">{inst.name}</p>
          <p className="text-[11px] text-muted">{billingModelLabel(inst.billingModel)}</p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${inst.status?.toLowerCase() === 'active' ? 'text-green bg-green/10 border-green/25' : 'text-red bg-red/10 border-red/25'}`}>
          {inst.status}
        </span>
      </div>
      {loading ? (
        <div className="h-8 bg-white/5 rounded-xl animate-pulse" />
      ) : wallet ? (
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] text-muted uppercase tracking-wider">Balance</p>
            <p className={`font-syne font-extrabold text-2xl ${(wallet.balance ?? 0) < 10000 ? 'text-red' : 'text-white-soft'}`}>
              {(wallet.balance ?? 0).toLocaleString()}
              <span className="text-xs text-muted font-normal ml-1">credits</span>
            </p>
          </div>
          {(wallet.balance ?? 0) < 10000 && (
            <span className="text-[10px] font-bold text-red bg-red/10 border border-red/25 px-2 py-0.5 rounded-full">Low Balance</span>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted">No wallet found.</p>
      )}
    </div>
  );
}

const WALLETS_PAGE_SIZE = 9;

export default function CreditsPage() {
  const { data: pricingData, loading: loadingP, reload: reloadP } = useAsyncData(fetchPricingConfigs, []);
  const { data: instData, loading: loadingI, reload: reloadI } = useAsyncData(
    () => fetchInstitutions({ page: 1, pageSize: 50 }),
    [],
  );
  const [walletsPage, setWalletsPage] = useState(1);

  const configs: ApiPricingConfig[] = pricingData ?? [];
  const institutions: ApiInstitution[] = instData?.items ?? [];
  const walletsTotalPages = Math.max(1, Math.ceil(institutions.length / WALLETS_PAGE_SIZE));
  const safeWalletsPage = Math.min(walletsPage, walletsTotalPages);
  const pagedInstitutions = institutions.slice((safeWalletsPage - 1) * WALLETS_PAGE_SIZE, safeWalletsPage * WALLETS_PAGE_SIZE);

  // Phải lọc isActive=true trước rồi mới lấy effectiveDate mới nhất, khớp đúng cách BE thật sự
  // chọn config để tính tiền (PricingConfigRepository.GetActiveConfigByServiceTypeAsync) — nếu
  // SuperAdmin đã tắt (deactivate) config gần nhất qua Edit, không được hiện nhầm nó là active.
  const activeConfigs = (['ATTENDANCE_UNIT', 'PROCTORING_PER_HOUR', 'SUBSCRIPTION_MONTHLY', 'SUBSCRIPTION_YEARLY'] as ServiceType[]).map((type) => {
    const list = configs.filter((c) => c.serviceType === type && c.isActive).sort(
      (a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime(),
    );
    return { type, config: list[0] ?? null };
  });

  function reloadAll() { reloadP(); reloadI(); }
  const loading = loadingP || loadingI;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-syne text-2xl font-extrabold text-white-soft">Credits Overview</h1>
          <p className="text-muted text-sm mt-1">Active pricing rates and institution wallet balances.</p>
        </div>
        <button onClick={reloadAll} disabled={loading} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-muted text-sm cursor-pointer hover:text-white-soft hover:border-blue-bright/40 transition-all bg-transparent disabled:opacity-50">
          <FiRefreshCw className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Active Pricing Rates */}
      <div>
        <p className="text-xs font-bold text-muted uppercase tracking-wider mb-3">Active Credit Rates</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {activeConfigs.map(({ type, config }) => {
            const meta = SERVICE_META[type];
            return (
              <div key={type} className="bg-navy-card border border-border rounded-[20px] p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{meta.icon}</span>
                  <p className={`text-xs font-bold ${meta.color}`}>{meta.label}</p>
                </div>
                {loadingP ? (
                  <div className="h-8 bg-white/5 rounded-xl animate-pulse" />
                ) : config ? (
                  <>
                    <p className={`font-syne font-extrabold text-2xl ${meta.color}`}>
                      {config.unitPrice.toLocaleString()}
                      <span className="text-xs text-muted font-normal ml-1">credits/student</span>
                    </p>
                    <p className="text-[11px] text-muted mt-1">
                      Effective: {new Date(config.effectiveDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted">Not configured</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Institution Wallet Balances */}
      <div>
        <p className="text-xs font-bold text-muted uppercase tracking-wider mb-3">Institution Wallets</p>
        {loadingI ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 bg-navy-card border border-border rounded-[20px] animate-pulse" />
            ))}
          </div>
        ) : institutions.length === 0 ? (
          <div className="bg-navy-card border border-border rounded-[20px] py-12 text-center text-muted text-sm">
            No institutions found.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pagedInstitutions.map((inst) => (
                <InstitutionWalletCard key={inst.id} inst={inst} />
              ))}
            </div>
            <Pagination page={safeWalletsPage} totalPages={walletsTotalPages} onChange={setWalletsPage} label={`${institutions.length} institutions`} className="mt-3" />
          </>
        )}
      </div>
    </div>
  );
}
