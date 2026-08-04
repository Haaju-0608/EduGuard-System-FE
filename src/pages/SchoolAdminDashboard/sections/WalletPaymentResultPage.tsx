import { useSearchParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiCheck, FiCopy, FiX } from 'react-icons/fi';
import { useState } from 'react';

// Trang nhận redirect sau khi thanh toán VNPay xong.
// BE (Controllers/WalletController.cs, action vnpay-return) xử lý xong (validate chữ ký + cộng tiền
// vào ví) rồi mới Redirect() trình duyệt sang đây kèm 4 query param cố định:
//   success = "True" | "False"  (chuỗi, viết hoa chữ đầu — bool.ToString() mặc định của C#)
//   message = thông báo tiếng Việt, đã Uri.EscapeDataString ở BE → URLSearchParams tự decode giúp
//   amount  = số tiền VNĐ thật (không phải amount*100 kiểu vnp_Amount gốc của VNPay)
//   txnRef  = mã tham chiếu giao dịch

export default function WalletPaymentResultPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const isSuccess = (params.get('success') ?? '').toLowerCase() === 'true';
  const message = params.get('message');

  const amountRaw = params.get('amount');
  const amount = amountRaw && !Number.isNaN(Number(amountRaw)) ? Number(amountRaw) : null;

  const txnRef = params.get('txnRef');

  const tone = isSuccess
    ? { accent: 'bg-green', ring: 'border-green/30 bg-green/10', icon: 'text-green', title: 'text-green' }
    : { accent: 'bg-red', ring: 'border-red/30 bg-red/10', icon: 'text-red', title: 'text-red' };

  const copyRef = () => {
    if (!txnRef) return;
    navigator.clipboard.writeText(txnRef).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-navy-card border border-border rounded-2xl overflow-hidden">
        <div className={`h-1 ${tone.accent}`} />

        <div className="p-8 text-center">
          <div className={`w-14 h-14 rounded-full mx-auto grid place-items-center border ${tone.ring}`}>
            {isSuccess ? <FiCheck className={`${tone.icon} text-2xl`} strokeWidth={3} /> : <FiX className={`${tone.icon} text-2xl`} strokeWidth={3} />}
          </div>

          <h1 className={`font-syne font-extrabold text-xl mt-5 ${tone.title}`}>
            {isSuccess ? 'Payment successful' : 'Payment failed'}
          </h1>
          <p className="text-muted text-sm mt-2 leading-relaxed">
            {message
              ?? (isSuccess
                ? 'Your wallet has been topped up successfully.'
                : 'The payment was cancelled or could not be verified.')}
          </p>

          {isSuccess && amount !== null && (
            <p className="font-syne font-extrabold text-[2.75rem] leading-none text-white-soft mt-6">
              +{amount.toLocaleString('vi-VN')} <span className="text-lg font-bold text-muted align-top">₫</span>
            </p>
          )}

          {txnRef && (
            <button
              onClick={copyRef}
              className="mt-6 w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-navy border border-border text-left cursor-pointer hover:border-blue-bright/40 transition-colors"
            >
              <span className="min-w-0">
                <span className="block text-[10px] font-bold text-muted uppercase tracking-wider">Reference</span>
                <span className="block text-xs text-white-soft font-mono truncate">{txnRef}</span>
              </span>
              {copied ? <FiCheck className="text-green text-sm shrink-0" /> : <FiCopy className="text-muted text-sm shrink-0" />}
            </button>
          )}

          <button
            onClick={() => navigate('/school/wallet')}
            className="w-full flex items-center justify-center gap-2 mt-3 py-2.5 rounded-xl bg-blue text-white text-sm font-semibold cursor-pointer hover:bg-blue/80 transition-colors border-none"
          >
            <FiArrowLeft /> Back to Wallet
          </button>
        </div>
      </div>
    </div>
  );
}
