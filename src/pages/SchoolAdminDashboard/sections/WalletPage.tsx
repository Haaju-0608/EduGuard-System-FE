import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiAlertCircle, FiArrowUpRight, FiCheckCircle, FiClock, FiCreditCard, FiDollarSign, FiRefreshCw, FiTrendingDown } from 'react-icons/fi';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { fetchWallet, fetchWalletTransactions, topUpWallet } from '../../../services/schoolAdminApi';
import type { ApiTransaction, ApiWallet } from '../../../types/api';

const TOP_UP_PACKAGES = [
  { credits: 5000, price: '$45', popular: false },
  { credits: 10000, price: '$85', popular: true },
  { credits: 25000, price: '$200', popular: false },
  { credits: 50000, price: '$380', popular: false },
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
  const [selectedPackage, setSelectedPackage] = useState(10000);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'bank'>('card');
  const [submitting, setSubmitting] = useState(false);

  const institutionId = user?.institutionId ?? '';

  async function loadWallet() {
    if (!institutionId) return;
    setLoadingWallet(true);
    try {
      const w = await fetchWallet(institutionId);
      setWallet(w);
      setLoadingTx(true);
      try {
        const { items } = await fetchWalletTransactions(w.id, { page: 1, pageSize: 20 });
        setTransactions(items);
      } catch {
        setTransactions([]);
      } finally {
        setLoadingTx(false);
      }
    } catch {
      toast.error('Error', 'Failed to load wallet data.');
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
        description: `Top-up ${selectedPackage.toLocaleString()} credits via ${paymentMethod === 'card' ? 'Credit Card' : 'Bank Transfer'}`,
      });
      if (result?.paymentUrl) {
        window.open(result.paymentUrl, '_blank');
        toast.info('Redirecting', 'Opening payment gateway...');
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

      {/* Balance Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 relative overflow-hidden bg-linear-to-br from-blue/20 to-cyan/10 border border-blue/30 rounded-[20px] p-6">
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
                  <span>Total deducted: <strong className="text-white-soft">{wallet.totalDeducted.toLocaleString()}</strong></span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {isLowBalance && !loadingWallet && (
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-red/5 border border-red/30">
              <FiAlertCircle className="text-red text-xl shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red">Low Balance Warning</p>
                <p className="text-xs text-muted mt-0.5">Balance below 10,000 credits. AI services may be suspended.</p>
              </div>
            </div>
          )}
          <div className="flex-1 bg-navy-card border border-border rounded-2xl p-4 space-y-3">
            <p className="text-xs font-bold text-muted uppercase tracking-wider">Estimated Cost Per Use</p>
            {[
              { label: 'AI Attendance (per session)', cost: '~90 credits' },
              { label: 'AI Proctoring (per exam)', cost: '~350 credits' },
              { label: 'Face Registration (per student)', cost: '~5 credits' },
            ].map((item) => (
              <div key={item.label} className="flex justify-between text-xs">
                <span className="text-muted">{item.label}</span>
                <span className="text-white-soft font-medium">{item.cost}</span>
              </div>
            ))}
            {!loadingWallet && balance > 0 && (
              <div className="pt-2 border-t border-border flex items-center gap-2 text-xs">
                <FiTrendingDown className="text-gold" />
                <span className="text-muted">
                  Runway: ~<strong className="text-gold">{Math.floor(balance / 90)} attendance sessions</strong>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top-up Modal — portal để tránh CSS transform của parent */}
      {showTopUp && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-200 flex items-center justify-center p-4">
          <div className="bg-navy-card border border-border rounded-[20px] p-6 w-full max-w-lg">
            <h2 className="font-syne font-bold text-white-soft text-lg mb-4">Top-up Wallet</h2>
            <p className="text-xs text-muted font-semibold uppercase tracking-wider mb-3">Select Package</p>
            <div className="grid grid-cols-2 gap-3 mb-5">
              {TOP_UP_PACKAGES.map((pkg) => (
                <button
                  key={pkg.credits}
                  onClick={() => setSelectedPackage(pkg.credits)}
                  className={`relative p-4 rounded-[14px] border text-left cursor-pointer transition-all bg-transparent ${
                    selectedPackage === pkg.credits
                      ? 'border-blue-bright bg-blue/10 text-blue-bright'
                      : 'border-border text-muted hover:border-border/80'
                  }`}
                >
                  {pkg.popular && (
                    <span className="absolute -top-2 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan text-navy">POPULAR</span>
                  )}
                  <p className="font-syne font-extrabold text-xl text-white-soft">{pkg.credits.toLocaleString()}</p>
                  <p className="text-xs mt-0.5">credits · <strong>{pkg.price}</strong></p>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted font-semibold uppercase tracking-wider mb-3">Payment Method</p>
            <div className="flex gap-3 mb-5">
              {(['card', 'bank'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  className={`flex-1 flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all bg-transparent text-sm font-medium ${
                    paymentMethod === m ? 'border-blue-bright bg-blue/10 text-white-soft' : 'border-border text-muted'
                  }`}
                >
                  {m === 'card' ? <FiCreditCard /> : <FiDollarSign />}
                  {m === 'card' ? 'Credit Card' : 'Bank Transfer'}
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
          <span className="text-[11px] text-muted">Last 20 transactions</span>
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
            {transactions.map((txn) => {
              const isTopUp = txn.type?.toLowerCase().includes('topup') || txn.amount > 0;
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
                      {isTopUp ? '+' : ''}{txn.amount.toLocaleString()}
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
      </div>
    </div>
  );
}
