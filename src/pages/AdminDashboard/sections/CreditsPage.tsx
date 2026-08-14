import React, { useEffect, useState } from 'react';
import { FiRefreshCw, FiSearch } from 'react-icons/fi';
import CustomSelect from '../../../components/ui/CustomSelect';
import Pagination from '../../../components/ui/Pagination';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { useHubConnection, useHubEvent } from '../../../hooks/useHubConnection';
import { HubRoute, joinHubGroup } from '../../../services/realtimeClient';
import { fetchInstitutions } from '../../../services/adminApi';
import { fetchWallet } from '../../../services/schoolAdminApi';
import { billingModelLabel } from '../../../utils/billingModel';
import type { ApiInstitution, ApiWallet } from '../../../types/api';

const LOW_BALANCE_THRESHOLD = 10000;

interface InstWithWallet {
  inst: ApiInstitution;
  wallet: ApiWallet | null;
}

function InstitutionWalletCard({ inst, wallet }: InstWithWallet) {
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
      {wallet ? (
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] text-muted uppercase tracking-wider">Balance</p>
            <p className={`font-syne font-extrabold text-2xl ${(wallet.balance ?? 0) < LOW_BALANCE_THRESHOLD ? 'text-red' : 'text-white-soft'}`}>
              {(wallet.balance ?? 0).toLocaleString()}
              <span className="text-xs text-muted font-normal ml-1">credits</span>
            </p>
          </div>
          {(wallet.balance ?? 0) < LOW_BALANCE_THRESHOLD && (
            <span className="text-[10px] font-bold text-red bg-red/10 border border-red/25 px-2 py-0.5 rounded-full">Low Balance</span>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted">No wallet found.</p>
      )}
    </div>
  );
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
];

const BILLING_OPTIONS = [
  { value: 'all', label: 'All Billing Models' },
  { value: 'Monthly', label: 'Monthly' },
  { value: 'Yearly', label: 'Yearly' },
];

const BALANCE_OPTIONS = [
  { value: 'all', label: 'All Balances' },
  { value: 'low', label: 'Low Balance' },
  { value: 'healthy', label: 'Healthy' },
];

const WALLETS_PAGE_SIZE = 9;

export default function CreditsPage() {
  const { data, loading, reload: reloadAll } = useAsyncData(async () => {
    const result = await fetchInstitutions({ page: 1, pageSize: 50 });
    const withWallets: InstWithWallet[] = await Promise.all(
      result.items.map(async (inst) => ({
        inst,
        wallet: await fetchWallet(inst.id).catch(() => null),
      })),
    );
    return withWallets;
  }, []);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [billingFilter, setBillingFilter] = useState('all');
  const [balanceFilter, setBalanceFilter] = useState('all');
  const [walletsPage, setWalletsPage] = useState(1);

  const items: InstWithWallet[] = data ?? [];

  // Realtime: SuperAdmin không tự join group của institution nào cả (khác SchoolAdmin), nên phải tự
  // xin join "InstitutionAdmins" của TỪNG institution đang hiện trên trang này để nghe được
  // WalletBalanceUpdated — BE cho phép SuperAdmin join group của bất kỳ institution nào
  // (IsAdminForInstitution luôn true với SuperAdmin).
  const notificationHub = useHubConnection(HubRoute.Notifications, items.length > 0);
  useEffect(() => {
    if (!notificationHub) return;
    items.forEach(({ inst }) => {
      joinHubGroup(HubRoute.Notifications, 'JoinInstitutionNotifications', [inst.id]).catch(() => undefined);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notificationHub, data]);
  useHubEvent(notificationHub, 'WalletBalanceUpdated', () => { reloadAll(); });

  const filtered = items.filter(({ inst, wallet }) => {
    const q = search.trim().toLowerCase();
    const matchSearch = !q || (inst.name ?? '').toLowerCase().includes(q) || (inst.subDomain ?? '').toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || inst.status?.toLowerCase() === statusFilter;
    const matchBilling = billingFilter === 'all' || inst.billingModel === billingFilter;
    const isLow = (wallet?.balance ?? 0) < LOW_BALANCE_THRESHOLD;
    const matchBalance = balanceFilter === 'all' || (balanceFilter === 'low' ? isLow : !isLow);
    return matchSearch && matchStatus && matchBilling && matchBalance;
  });

  const walletsTotalPages = Math.max(1, Math.ceil(filtered.length / WALLETS_PAGE_SIZE));
  const safeWalletsPage = Math.min(walletsPage, walletsTotalPages);
  const pagedItems = filtered.slice((safeWalletsPage - 1) * WALLETS_PAGE_SIZE, safeWalletsPage * WALLETS_PAGE_SIZE);

  useEffect(() => { setWalletsPage(1); }, [search, statusFilter, billingFilter, balanceFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-syne text-2xl font-extrabold text-white-soft">Credits Overview</h1>
          <p className="text-muted text-sm mt-1">Institution wallet balances.</p>
        </div>
        <button onClick={reloadAll} disabled={loading} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-muted text-sm cursor-pointer hover:text-white-soft hover:border-blue-bright/40 transition-all bg-transparent disabled:opacity-50">
          <FiRefreshCw className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-50 bg-navy-card border border-border rounded-xl px-4 py-2.5 focus-within:border-blue-bright/40 transition-colors">
          <FiSearch className="text-muted shrink-0" />
          <input
            type="text"
            placeholder="Search institution name, subdomain..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-sm text-white-soft placeholder:text-muted"
          />
        </div>
        <CustomSelect value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} />
        <CustomSelect value={billingFilter} onChange={setBillingFilter} options={BILLING_OPTIONS} />
        <CustomSelect value={balanceFilter} onChange={setBalanceFilter} options={BALANCE_OPTIONS} />
      </div>

      {/* Institution Wallet Balances */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-muted uppercase tracking-wider">Institution Wallets</p>
          <span className="text-xs text-muted">{filtered.length} of {items.length}</span>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 bg-navy-card border border-border rounded-[20px] animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-navy-card border border-border rounded-[20px] py-12 text-center text-muted text-sm">
            {items.length === 0 ? 'No institutions found.' : 'No institutions match your search.'}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pagedItems.map(({ inst, wallet }) => (
                <InstitutionWalletCard key={inst.id} inst={inst} wallet={wallet} />
              ))}
            </div>
            <Pagination page={safeWalletsPage} totalPages={walletsTotalPages} onChange={setWalletsPage} label={`${filtered.length} institutions`} className="mt-3" />
          </>
        )}
      </div>
    </div>
  );
}
