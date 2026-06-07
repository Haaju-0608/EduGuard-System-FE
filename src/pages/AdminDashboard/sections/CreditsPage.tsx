import React, { useState } from 'react';
import { FiCreditCard, FiSliders, FiDollarSign, FiPlusCircle, FiCheckCircle, FiChevronRight, FiGrid, FiClock } from 'react-icons/fi';

interface DeptCredit {
  name: string;
  allocated: number;
  used: number;
}

const initialDepts: DeptCredit[] = [
  { name: 'IT Department', allocated: 5000, used: 3820 },
  { name: 'CS Department', allocated: 4000, used: 2450 },
  { name: 'Math Department', allocated: 2000, used: 1100 },
  { name: 'English Department', allocated: 1500, used: 940 },
];

interface InvoiceRecord {
  id: string;
  date: string;
  credits: number;
  amount: string;
  method: string;
  status: 'Completed' | 'Pending';
}

const initialInvoices: InvoiceRecord[] = [
  { id: 'INV-0912', date: 'June 01, 2026', credits: 10000, amount: '$100.00', method: 'Credit Card', status: 'Completed' },
  { id: 'INV-0841', date: 'May 12, 2026', credits: 5000, amount: '$50.00', method: 'Bank Transfer', status: 'Completed' },
  { id: 'INV-0710', date: 'April 02, 2026', credits: 20000, amount: '$180.00', method: 'Credit Card', status: 'Completed' },
];

export default function CreditsPage() {
  const [totalCredits, setTotalCredits] = useState(12450);
  const [depts, setDepts] = useState<DeptCredit[]>(initialDepts);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>(initialInvoices);
  const [isEditingAllocation, setIsEditingAllocation] = useState(false);
  const [tempAllocations, setTempAllocations] = useState<number[]>([]);
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(10000);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleStartEdit = () => {
    setTempAllocations(depts.map(d => d.allocated));
    setIsEditingAllocation(true);
  };

  const handleSaveAllocation = () => {
    // Save temporary state
    const sumAllocated = tempAllocations.reduce((a, b) => a + b, 0);
    if (sumAllocated > totalCredits) {
      alert('Total allocated credits cannot exceed total credits available!');
      return;
    }

    setDepts(
      depts.map((d, index) => ({
        ...d,
        allocated: tempAllocations[index],
      }))
    );
    setIsEditingAllocation(false);
    showToast('Department credits reallocated successfully!');
  };

  const handleSliderChange = (index: number, val: number) => {
    const nextAlloc = [...tempAllocations];
    nextAlloc[index] = val;
    setTempAllocations(nextAlloc);
  };

  const handleBuyCredits = (e: React.FormEvent) => {
    e.preventDefault();
    const amountMap: Record<number, string> = {
      5000: '$50.00',
      10000: '$100.00',
      50000: '$450.00',
    };

    const newInvoice: InvoiceRecord = {
      id: 'INV-' + Math.floor(1000 + Math.random() * 9000),
      date: new Date().toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' }),
      credits: selectedPackage,
      amount: amountMap[selectedPackage] || '$100.00',
      method: 'Credit Card',
      status: 'Completed',
    };

    setTotalCredits(prev => prev + selectedPackage);
    setInvoices([newInvoice, ...invoices]);
    setIsBuyModalOpen(false);
    showToast(`Purchased ${selectedPackage.toLocaleString()} credits successfully!`);
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 bg-navy-mid border border-cyan/50 text-white-soft px-4 py-3 rounded-xl shadow-[0_8px_32px_rgba(6,182,212,0.15)] animate-fade-slide-in font-dm text-sm">
          <FiCheckCircle className="text-cyan text-lg flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-syne font-extrabold text-2xl text-white-soft flex items-center gap-2">
            <FiCreditCard className="text-gold" />
            AI Credits & Billing
          </h1>
          <p className="text-muted font-dm text-sm mt-1">
            Manage biometric API verification credits, allocate balances to departments, and track transactions.
          </p>
        </div>
        <button
          onClick={() => setIsBuyModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-linear-to-r from-blue to-blue-bright text-white font-dm font-semibold text-sm px-4 py-2.5 rounded-xl cursor-pointer shadow-lg hover:brightness-110 hover:-translate-y-0.5 transition-all border-0 w-full sm:w-auto"
        >
          <FiPlusCircle className="text-base" />
          <span>Purchase Credits</span>
        </button>
      </div>

      {/* Grid structure: Allocation vs Buy info */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Global balance card & Allocations (3/5) */}
        <div className="lg:col-span-3 space-y-6">
          {/* Credit balance visual card */}
          <div className="relative overflow-hidden bg-linear-to-br from-navy-card to-blue/10 border border-blue-bright/20 rounded-2xl p-6 shadow-lg group">
            {/* HSL glow background element */}
            <div className="absolute -right-20 -top-20 w-48 h-48 rounded-full bg-blue-bright/10 blur-3xl pointer-events-none group-hover:bg-blue-bright/15 transition-all duration-75" />
            
            <div className="relative z-10 flex flex-col justify-between h-full font-dm">
              <span className="text-muted font-medium text-xs tracking-wider uppercase">System Total Balance</span>
              <div className="flex items-end gap-3 mt-3 mb-6">
                <span className="font-syne font-extrabold text-[2.5rem] leading-none text-white-soft">
                  {totalCredits.toLocaleString()}
                </span>
                <span className="text-muted text-sm font-medium mb-1">credits remaining</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted border-t border-border/40 pt-4">
                <span>Estimated depletion: <strong>48 days</strong></span>
                <span>Last purchased: <strong>June 01</strong></span>
              </div>
            </div>
          </div>

          {/* Allocation by Department */}
          <div className="bg-navy-card border border-border rounded-[16px] p-5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-syne font-bold text-white-soft text-base flex items-center gap-2">
                <FiSliders className="text-blue-bright" />
                Department Allocation
              </h3>
              {!isEditingAllocation ? (
                <button
                  onClick={handleStartEdit}
                  className="text-xs text-cyan cursor-pointer hover:underline font-dm font-medium bg-transparent border-0"
                >
                  Adjust Allocation
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsEditingAllocation(false)}
                    className="text-xs text-muted cursor-pointer hover:text-white-soft font-dm font-medium bg-transparent border-0"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveAllocation}
                    className="text-xs text-cyan cursor-pointer hover:underline font-dm font-bold bg-transparent border-0"
                  >
                    Save Changes
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {depts.map((d, index) => {
                const percentage = Math.round((d.used / d.allocated) * 100);
                const currentAlloc = isEditingAllocation ? tempAllocations[index] : d.allocated;
                
                return (
                  <div key={d.name} className="font-dm text-sm">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-white-soft font-medium">{d.name}</span>
                      <span className="text-xs text-muted">
                        {d.used.toLocaleString()} /{' '}
                        {isEditingAllocation ? (
                          <span className="text-cyan font-semibold">{currentAlloc.toLocaleString()}</span>
                        ) : (
                          d.allocated.toLocaleString()
                        )}{' '}
                        credits
                      </span>
                    </div>

                    {/* slider or normal meter */}
                    {isEditingAllocation ? (
                      <div className="flex items-center gap-3 mt-1.5">
                        <input
                          type="range"
                          min={d.used}
                          max={10000}
                          step={100}
                          value={currentAlloc}
                          onChange={(e) => handleSliderChange(index, parseInt(e.target.value))}
                          className="flex-1 accent-cyan h-1 bg-navy rounded-lg cursor-pointer"
                        />
                        <span className="font-mono text-xs text-white-soft w-[60px] text-right">
                          {currentAlloc.toLocaleString()}
                        </span>
                      </div>
                    ) : (
                      <div className="w-full h-2 bg-navy rounded-full overflow-hidden border border-border/30">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            percentage > 85 ? 'bg-red' : percentage > 60 ? 'bg-gold' : 'bg-linear-to-r from-blue to-cyan'
                          }`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Invoices billing history (2/5) */}
        <div className="lg:col-span-2 bg-navy-card border border-border rounded-[16px] p-5 flex flex-col justify-between">
          <div>
            <h3 className="font-syne font-bold text-white-soft text-base mb-4 flex items-center gap-2">
              <FiClock className="text-gold" />
              Billing History
            </h3>

            <div className="space-y-3 font-dm">
              {invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-navy/40 border border-border/40 hover:bg-navy-mid transition-colors cursor-pointer group"
                >
                  <div className="min-w-0">
                    <p className="text-xs text-white-soft font-mono font-bold group-hover:text-cyan transition-colors">
                      {inv.id}
                    </p>
                    <p className="text-[10px] text-muted mt-0.5">
                      {inv.date} • {inv.method}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-white-soft font-semibold font-mono">+{inv.credits.toLocaleString()} Cr</p>
                    <p className="text-[10px] text-muted">{inv.amount}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <button className="flex items-center justify-center gap-1 text-xs text-muted hover:text-white-soft cursor-pointer font-dm mt-6 bg-transparent border-0 self-center">
            <span>View all transactions</span>
            <FiChevronRight />
          </button>
        </div>
      </div>

      {/* Floating Buy Credits modal */}
      {isBuyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setIsBuyModalOpen(false)}
            className="absolute inset-0 bg-navy/80 backdrop-blur-xs cursor-pointer"
          />

          <div className="relative bg-navy-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-slide-in overflow-hidden">
            <h3 className="font-syne font-bold text-white-soft text-lg mb-4 flex items-center gap-2 border-b border-border/30 pb-3">
              <FiDollarSign className="text-cyan" />
              Purchase AI Credits
            </h3>

            <form onSubmit={handleBuyCredits} className="space-y-4 font-dm text-sm">
              <div className="space-y-3">
                {[
                  { credits: 5000, price: '$50.00', desc: 'Ideal for small departments' },
                  { credits: 10000, price: '$100.00', desc: 'Most popular package' },
                  { credits: 50000, price: '$450.00', desc: 'Enterprise university scale (10% off)' },
                ].map((pkg) => (
                  <label
                    key={pkg.credits}
                    className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedPackage === pkg.credits
                        ? 'border-cyan bg-cyan/10 text-white-soft'
                        : 'border-border/60 bg-navy/40 text-muted hover:border-border hover:bg-navy-mid'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="credit_package"
                        checked={selectedPackage === pkg.credits}
                        onChange={() => setSelectedPackage(pkg.credits)}
                        className="accent-cyan cursor-pointer"
                      />
                      <div>
                        <p className="text-xs font-bold text-white-soft">+{pkg.credits.toLocaleString()} Credits</p>
                        <p className="text-[10px] text-muted">{pkg.desc}</p>
                      </div>
                    </div>
                    <span className="font-mono text-sm font-bold text-cyan">{pkg.price}</span>
                  </label>
                ))}
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-border/30 mt-5">
                <button
                  type="button"
                  onClick={() => setIsBuyModalOpen(false)}
                  className="px-4 py-2 border border-border rounded-xl text-white-soft font-medium bg-transparent hover:bg-navy cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-linear-to-r from-blue to-blue-bright text-white rounded-xl font-semibold cursor-pointer shadow-lg hover:brightness-110 transition-all border-0"
                >
                  Purchase Now
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
