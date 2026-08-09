import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiAlertCircle, FiArrowUpRight, FiCalendar, FiCheckCircle, FiClock, FiCreditCard, FiRefreshCw, FiRepeat, FiTrendingDown } from 'react-icons/fi';
import Pagination from '../../../components/ui/Pagination';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { fetchInstitutionById, fetchPricingConfigs, renewInstitutionSubscription } from '../../../services/adminApi';
import { fetchWallet, fetchWalletTransactions, topUpWallet } from '../../../services/schoolAdminApi';
import { billingModelLabel } from '../../../utils/billingModel';
import type { ApiInstitution, ApiPricingConfig, ApiTransaction, ApiWallet } from '../../../types/api';

/** Giá active mới nhất cho 1 loại dịch vụ (list configs đã fetch 1 lần cho cả trang) — phải lọc
 *  isActive=true trước rồi mới lấy effectiveDate mới nhất, khớp đúng cách BE thật sự chọn config để
 *  tính tiền (PricingConfigRepository.GetActiveConfigByServiceTypeAsync). Bỏ qua isActive sẽ hiện
 *  giá sai nếu SuperAdmin đã tắt (deactivate) config gần nhất qua Edit mà vẫn còn config cũ hơn đang
 *  active. */
function activeUnitPrice(configs: ApiPricingConfig[], serviceType: string): number | null {
  const matches = configs
    .filter((c) => c.serviceType === serviceType && c.isActive)
    .sort((a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime());
  return matches[0]?.unitPrice ?? null;
}

const TOP_UP_PACKAGES = [
  { amount: 100000,  label: '100,000',  price: '100.000 ₫',  popular: false },
  { amount: 500000,  label: '500,000',  price: '500.000 ₫',  popular: true  },
  { amount: 1000000, label: '1,000,000', price: '1.000.000 ₫', popular: false },
  { amount: 2000000, label: '2,000,000', price: '2.000.000 ₫', popular: false },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function WalletPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [wallet, setWallet] = useState<ApiWallet | null>(null);
  const [transactions, setTransactions] = useState<ApiTransaction[]>([]);
  const [loadingWallet, setLoadingWallet] = useState(true);
  const [loadingTx, setLoadingTx] = useState(true);
  const [showTopUp, setShowTopUp] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(500000);
  const [submitting, setSubmitting] = useState(false);
  const [institution, setInstitution] = useState<ApiInstitution | null>(null);
  const [loadingInstitution, setLoadingInstitution] = useState(true);
  const [renewing, setRenewing] = useState(false);
  const [showRenewConfirm, setShowRenewConfirm] = useState(false);
  const [renewPlan, setRenewPlan] = useState<'Monthly' | 'Yearly'>('Monthly');
  const [pricingConfigs, setPricingConfigs] = useState<ApiPricingConfig[]>([]);
  const [txPage, setTxPage] = useState(1);

  const institutionId = user?.institutionId ?? '';

  useEffect(() => {
    fetchPricingConfigs().then(setPricingConfigs).catch(() => setPricingConfigs([]));
  }, []);

  async function loadInstitution() {
    if (!institutionId) { setLoadingInstitution(false); return; }
    setLoadingInstitution(true);
    try {
      setInstitution(await fetchInstitutionById(institutionId));
    } catch {
      // Không chặn phần wallet nếu load institution lỗi
    } finally {
      setLoadingInstitution(false);
    }
  }

  useEffect(() => { loadInstitution(); }, [institutionId]);

  const handleRenewSubscription = async () => {
    if (!institutionId) return;
    setShowRenewConfirm(false);
    setRenewing(true);
    try {
      await renewInstitutionSubscription(institutionId, renewPlan);
      toast.success('Renewed', 'Subscription renewed successfully.');
      // Renew trừ tiền ví thật (xem WalletPage handleRenewSubscription) — phải load lại CẢ balance
      // lẫn institution, không chỉ institution, nếu không số dư hiện cũ tới khi F5 lại trang.
      await Promise.all([loadInstitution(), loadWallet()]);
    } catch (err) {
      toast.error('Error', err instanceof Error ? err.message : 'Failed to renew subscription.');
    } finally {
      setRenewing(false);
    }
  };

  // Mở modal renew → luôn mặc định Monthly (giá thấp hơn, ít rủi ro trừ nhầm nhiều tiền hơn dự
  // kiến), bất kể gói hiện tại của trường là gì — school admin tự đổi sang Yearly nếu muốn.
  const openRenewConfirm = () => {
    setRenewPlan('Monthly');
    setShowRenewConfirm(true);
  };

  // Giá gia hạn phụ thuộc gói ĐANG CHỌN trong modal (không phải billing model hiện tại của trường
  // — school admin có thể vừa renew vừa đổi gói) — khớp đúng 2 loại PricingServiceType.
  // SUBSCRIPTION_MONTHLY/SUBSCRIPTION_YEARLY thật bên BE.
  const monthlyPrice = activeUnitPrice(pricingConfigs, 'SUBSCRIPTION_MONTHLY');
  const yearlyPrice = activeUnitPrice(pricingConfigs, 'SUBSCRIPTION_YEARLY');
  const renewalPrice = renewPlan === 'Yearly' ? yearlyPrice : monthlyPrice;

  async function loadWallet() {
    if (!institutionId) {
      setLoadingWallet(false);
      setLoadingTx(false);
      return;
    }
    setLoadingWallet(true);
    setLoadingTx(true);
    try {
      const w = await fetchWallet(institutionId);
      setWallet(w);
      try {
        // pageSize:100 — đủ để phân trang tay ở FE (TX_PAGE_SIZE=20/trang) mà không cần refetch mỗi
        // lần đổi trang; "deductedRecent" bên dưới giờ tính trên phạm vi rộng hơn (100 thay vì 20).
        const { items } = await fetchWalletTransactions(w.id, { page: 1, pageSize: 100 });
        setTransactions(items ?? []);
      } catch {
        setTransactions([]);
      } finally {
        setLoadingTx(false);
      }
    } catch {
      toast.error('Error', 'Failed to load wallet data.');
      setLoadingTx(false);
    } finally {
      setLoadingWallet(false);
    }
  }

  useEffect(() => { loadWallet(); }, [institutionId]);

  const handleTopUp = async () => {
    if (!institutionId) return;
    setSubmitting(true);
    try {
      const result = await topUpWallet({
        institutionId,
        amount: selectedPackage,
        description: `Top-up ${selectedPackage.toLocaleString('vi-VN')} VND`,
      });
      if (result) {
        toast.info('Redirecting', 'Đang chuyển đến cổng thanh toán...');
        setTimeout(() => { window.location.href = result; }, 500);
      } else {
        toast.success('Success', `Topped up ${selectedPackage.toLocaleString()} credits.`);
        setShowTopUp(false);
        loadWallet();
      }
    } catch {
      toast.error('Error', 'Top-up failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const balance = wallet?.balance ?? 0;
  const isLowBalance = balance < 10000;

  // ApiWallet.totalDeducted không tồn tại trong response thật của BE (WalletResponseDto chỉ có
  // Id/InstitutionId/Balance/Currency/LowBalanceThreshold) — luôn undefined, hiện "0" giả vĩnh viễn.
  // Tính lại từ chính các giao dịch đã tải (chỉ trong phạm vi "Last 20 transactions" bên dưới).
  // BE luôn lưu Amount dương bất kể top-up hay phí (xem Services/InstitutionService.cs
  // RenewSubscriptionAsync: `Amount = renewalFee`, không âm) — chỉ `type` mới phân biệt được
  // chiều tiền, không được suy theo dấu của amount (trước đây lỡ fallback `amount > 0` khiến
  // mọi giao dịch phí — vốn cũng dương — bị tính nhầm thành top-up, luôn ra 0 giao dịch trừ tiền).
  const isTopUpType = (t: ApiTransaction) => t.type?.toLowerCase().includes('top_up') ?? false;
  const isDeductionTxn = (t: ApiTransaction) => !isTopUpType(t);
  const deductedRecent = transactions
    .filter(isDeductionTxn)
    .reduce((sum, t) => sum + Math.abs(t.amount ?? 0), 0);

  const TX_PAGE_SIZE = 20;
  const txTotalPages = Math.max(1, Math.ceil(transactions.length / TX_PAGE_SIZE));
  const safeTxPage = Math.min(txPage, txTotalPages);
  const pagedTransactions = transactions.slice((safeTxPage - 1) * TX_PAGE_SIZE, safeTxPage * TX_PAGE_SIZE);

  if (!institutionId && !loadingWallet) {
    return (
      <div className="space-y-6">
        <div className="bg-navy-card border border-border rounded-[20px] p-6">
          <h1 className="font-syne font-extrabold text-[1.6rem] text-white-soft">Institutional Wallet</h1>
        </div>
        <div className="bg-navy-card border border-red/20 rounded-[20px] py-16 text-center">
          <p className="text-3xl mb-3">🏫</p>
          <p className="font-syne font-bold text-white-soft mb-1">No institution linked</p>
          <p className="text-muted text-sm">Your account is not linked to any institution yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-syne font-extrabold text-[1.6rem] text-white-soft">Institutional Wallet</h1>
          <p className="text-muted text-sm mt-1">Manage AI credits for your institution</p>
        </div>
        <button
          onClick={loadWallet}
          disabled={loadingWallet}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-muted text-sm cursor-pointer hover:text-white-soft hover:border-blue-bright/40 transition-all bg-transparent disabled:opacity-50"
        >
          <FiRefreshCw className={loadingWallet ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Low Balance Alert */}
      {!loadingWallet && wallet && isLowBalance && (
        <div className="flex items-start gap-3 bg-red/5 border border-red/30 rounded-2xl px-5 py-4">
          <span className="text-xl shrink-0">⚠️</span>
          <div className="flex-1">
            <p className="text-sm font-bold text-red">Low Balance Alert</p>
            <p className="text-xs text-muted mt-0.5">
              Your institution wallet has only <strong className="text-white-soft">{balance.toLocaleString()} credits</strong> remaining.
              Please top-up to ensure attendance and proctoring services continue uninterrupted.
            </p>
          </div>
          <button
            onClick={() => setShowTopUp(true)}
            className="shrink-0 px-3 py-1.5 rounded-xl bg-red/10 border border-red/30 text-red text-xs font-semibold cursor-pointer hover:bg-red/20 transition-colors"
          >
            Top-up Now
          </button>
        </div>
      )}

      {/* Subscription Card */}
      {!loadingInstitution && institution && (() => {
        const isSuspended = institution.status.toLowerCase() === 'suspended';
        const expiresAt = institution.subscriptionExpiresAt ? new Date(institution.subscriptionExpiresAt) : null;
        const daysLeft = expiresAt ? Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000) : null;
        const isExpiringSoon = !isSuspended && daysLeft !== null && daysLeft <= 7;
        const tone = isSuspended
          ? { box: 'bg-red/5 border-red/30', text: 'text-red', chip: 'bg-red/10 border-red/30 text-red hover:bg-red/20' }
          : isExpiringSoon
            ? { box: 'bg-gold/5 border-gold/30', text: 'text-gold', chip: 'bg-gold/10 border-gold/30 text-gold hover:bg-gold/20' }
            : { box: 'bg-green/5 border-green/30', text: 'text-green', chip: 'bg-green/10 border-green/30 text-green hover:bg-green/20' };
        return (
          <div className={`flex items-start gap-3 rounded-2xl px-5 py-4 flex-wrap border ${tone.box}`}>
            <FiCalendar className={`text-xl shrink-0 mt-0.5 ${tone.text}`} />
            <div className="flex-1 min-w-[200px]">
              <p className={`text-sm font-bold ${tone.text}`}>
                {isSuspended ? 'Subscription Suspended' : isExpiringSoon ? 'Subscription Expiring Soon' : 'Subscription Active'}
              </p>
              <p className="text-xs text-muted mt-0.5">
                {billingModelLabel(institution.billingModel)} plan
                {expiresAt && (
                  <> — {isSuspended ? 'expired' : 'renews'} <strong className="text-white-soft">{expiresAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
                  {!isSuspended && daysLeft !== null && daysLeft >= 0 && ` (${daysLeft} day${daysLeft !== 1 ? 's' : ''} left)`}</>
                )}
              </p>
            </div>
            <button
              onClick={openRenewConfirm}
              disabled={renewing}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50 ${tone.chip}`}
            >
              <FiRepeat className={renewing ? 'animate-spin' : ''} size={12} />
              {renewing ? 'Renewing…' : 'Renew Subscription'}
            </button>
          </div>
        );
      })()}

      {/* Balance Card */}
      <div className="flex flex-col gap-4">
        <div className="relative overflow-hidden bg-linear-to-br from-blue/20 to-cyan/10 border border-blue/30 rounded-[20px] p-6">
          <div className="absolute top-0 right-0 w-48 h-48 bg-cyan/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="relative z-1">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted text-sm font-medium">Available Balance</p>
                {loadingWallet ? (
                  <div className="h-12 w-48 bg-white/10 rounded-xl animate-pulse mt-1" />
                ) : (
                  <p className="font-syne font-extrabold text-[3rem] text-white-soft leading-none mt-1">
                    {balance.toLocaleString()}
                  </p>
                )}
                <p className="text-cyan text-sm font-semibold mt-1">AI Credits</p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-blue/20 border border-blue/30 grid place-items-center">
                <FiCreditCard className="text-2xl text-cyan" />
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => setShowTopUp(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue text-white text-sm font-semibold hover:bg-blue/80 transition-colors cursor-pointer border-none"
              >
                <FiArrowUpRight /> Top-up Wallet
              </button>
              {wallet && (
                <div className="flex items-center gap-4 px-4 py-2.5 rounded-xl bg-navy/60 border border-border text-sm text-muted">
                  <span>Deducted (last 20 txns): <strong className="text-white-soft">{deductedRecent.toLocaleString()}</strong></span>
                </div>
              )}
            </div>
          </div>
        </div>

        {isLowBalance && !loadingWallet && (
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-red/5 border border-red/30">
            <FiAlertCircle className="text-red text-xl shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red">Low Balance Warning</p>
              <p className="text-xs text-muted mt-0.5">Balance below 10,000 credits. AI services may be suspended.</p>
            </div>
          </div>
        )}
      </div>

      {/* Renew Subscription Confirm Modal — hiện đúng giá thật trước khi trừ ví */}
      {showRenewConfirm && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-200 flex items-center justify-center p-4">
          <div className="bg-navy-card border border-border rounded-[20px] p-6 w-full max-w-sm">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-10 h-10 rounded-xl bg-green/10 border border-green/20 grid place-items-center shrink-0">
                <FiRepeat className="text-green" />
              </div>
              <div>
                <h3 className="font-syne font-bold text-white-soft text-base">Renew Subscription</h3>
                <p className="text-muted text-xs mt-0.5">Choose a plan to renew with — you can switch plans here too.</p>
              </div>
            </div>

            {/* Chọn gói — BE (RenewSubscriptionDto.BillingModel) bắt buộc phải gửi kèm, không có
                default hợp lý nào ở đây nên luôn bắt school admin chọn rõ ràng. */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {(['Monthly', 'Yearly'] as const).map((plan) => {
                const price = plan === 'Yearly' ? yearlyPrice : monthlyPrice;
                const isCurrentPlan = institution?.billingModel === plan;
                const selected = renewPlan === plan;
                return (
                  <button
                    key={plan}
                    type="button"
                    onClick={() => setRenewPlan(plan)}
                    className={`text-left rounded-xl border p-3 transition-colors cursor-pointer ${
                      selected ? 'border-green bg-green/10' : 'border-border bg-transparent hover:border-green/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-sm font-semibold text-white-soft">{billingModelLabel(plan)}</span>
                      {isCurrentPlan && (
                        <span className="shrink-0 text-[9px] font-bold text-cyan bg-cyan/10 border border-cyan/25 px-1.5 py-0.5 rounded-full">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted mt-1">
                      {price === null ? 'Not configured' : `${price.toLocaleString()} credits`}
                    </p>
                  </button>
                );
              })}
            </div>

            {renewalPrice === null ? (
              <p className="text-muted text-sm mb-5">
                No active price configured for {billingModelLabel(renewPlan)} renewal yet.
                Ask your Super Admin to set one up before renewing.
              </p>
            ) : (
              <p className="text-muted text-sm mb-5">
                Renewing will charge <strong className="text-white-soft">{renewalPrice.toLocaleString()} credits</strong> from
                your wallet (current balance: <strong className="text-white-soft">{balance.toLocaleString()}</strong>).
                {institution?.billingModel && institution.billingModel !== renewPlan && (
                  <span className="block text-gold mt-1.5">
                    This will also switch your plan from {billingModelLabel(institution.billingModel)} to {billingModelLabel(renewPlan)}.
                  </span>
                )}
                {renewalPrice > balance && (
                  <span className="block text-red mt-1.5">Not enough balance — top up first.</span>
                )}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowRenewConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm cursor-pointer hover:border-muted/50 transition-colors bg-transparent"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleRenewSubscription()}
                disabled={renewalPrice === null || renewalPrice > balance}
                className="flex-1 py-2.5 rounded-xl bg-green text-white text-sm font-semibold cursor-pointer hover:bg-green/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border-none"
              >
                Confirm & Renew
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Top-up Modal — portal để tránh CSS transform của parent */}
      {showTopUp && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-200 flex items-center justify-center p-4">
          <div className="bg-navy-card border border-border rounded-[20px] p-6 w-full max-w-lg">
            <h2 className="font-syne font-bold text-white-soft text-lg mb-4">Top-up Wallet</h2>
            <p className="text-xs text-muted font-semibold uppercase tracking-wider mb-3">Select Package</p>
            <div className="grid grid-cols-2 gap-3 mb-5">
              {TOP_UP_PACKAGES.map((pkg) => (
                <button
                  key={pkg.amount}
                  onClick={() => setSelectedPackage(pkg.amount)}
                  className={`relative p-4 rounded-[14px] border text-left cursor-pointer transition-all bg-transparent ${
                    selectedPackage === pkg.amount
                      ? 'border-blue-bright bg-blue/10 text-blue-bright'
                      : 'border-border text-muted hover:border-border/80'
                  }`}
                >
                  {pkg.popular && (
                    <span className="absolute -top-2 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan text-navy">POPULAR</span>
                  )}
                  <p className="font-syne font-extrabold text-xl text-white-soft">{pkg.label}</p>
                  <p className="text-xs mt-0.5 text-cyan font-semibold">{pkg.price}</p>
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowTopUp(false)}
                className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm cursor-pointer hover:border-muted/50 transition-colors bg-transparent"
              >
                Cancel
              </button>
              <button
                onClick={handleTopUp}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-blue text-white text-sm font-semibold cursor-pointer hover:bg-blue/80 disabled:opacity-50 transition-colors border-none"
              >
                {submitting ? 'Processing…' : 'Confirm Top-up'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Transaction History */}
      <div className="bg-navy-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-syne font-bold text-white-soft text-sm">Transaction History</h2>
          <span className="text-[11px] text-muted">Last {transactions.length} transactions</span>
        </div>
        {loadingTx ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="w-8 h-8 rounded-xl bg-white/5 animate-pulse shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-white/5 rounded animate-pulse w-2/3" />
                  <div className="h-2.5 bg-white/5 rounded animate-pulse w-1/3" />
                </div>
                <div className="h-4 bg-white/5 rounded animate-pulse w-16 shrink-0" />
              </div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-16 text-center text-muted text-sm">No transactions yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {pagedTransactions.map((txn) => {
              const isTopUp = isTopUpType(txn);
              return (
                <div key={txn.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-navy/40 transition-colors">
                  <div className={`w-8 h-8 rounded-xl grid place-items-center shrink-0 ${isTopUp ? 'bg-green/10 text-green' : 'bg-red/10 text-red'}`}>
                    {isTopUp ? <FiArrowUpRight /> : <FiTrendingDown />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white-soft/90 truncate">{txn.description ?? txn.type}</p>
                    <p className="text-[11px] text-muted mt-0.5 flex items-center gap-1.5">
                      <FiClock className="text-[10px]" />
                      {formatDate(txn.createdAt)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-syne font-bold text-sm ${isTopUp ? 'text-green' : 'text-red'}`}>
                      {isTopUp ? '+' : ''}{(txn.amount ?? 0).toLocaleString()}
                    </p>
                    <div className="flex items-center gap-1 justify-end mt-0.5">
                      <FiCheckCircle className="text-[10px] text-green" />
                      <span className="text-[10px] text-muted capitalize">{txn.status ?? 'Completed'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {!loadingTx && transactions.length > 0 && (
          <Pagination page={safeTxPage} totalPages={txTotalPages} onChange={setTxPage} className="px-5 py-3.5 border-t border-border" />
        )}
      </div>
    </div>
  );
}
