import { useSearchParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiCheckCircle, FiXCircle } from 'react-icons/fi';

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

  const isSuccess = (params.get('success') ?? '').toLowerCase() === 'true';
  const message = params.get('message');

  const amountRaw = params.get('amount');
  const amount = amountRaw && !Number.isNaN(Number(amountRaw)) ? Number(amountRaw) : null;

  const txnRef = params.get('txnRef');

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-navy-card border border-border rounded-[20px] p-8 text-center space-y-5">
        <div className={`w-16 h-16 rounded-2xl mx-auto grid place-items-center border ${
          isSuccess ? 'bg-green/10 border-green/30' : 'bg-red/10 border-red/30'
        }`}>
          {isSuccess ? <FiCheckCircle className="text-green text-3xl" /> : <FiXCircle className="text-red text-3xl" />}
        </div>

        <div>
          <h1 className="font-syne font-extrabold text-xl text-white-soft">
            {isSuccess ? 'Payment Successful' : 'Payment Failed'}
          </h1>
          <p className="text-muted text-sm mt-1.5 leading-relaxed">
            {message
              ?? (isSuccess
                ? 'Your wallet has been topped up successfully.'
                : 'The payment was cancelled or the transaction could not be verified.')}
          </p>
        </div>

        {isSuccess && amount !== null && (
          <div className="bg-navy border border-border rounded-xl px-4 py-3">
            <p className="text-[10px] text-muted uppercase tracking-wider font-bold">Amount</p>
            <p className="font-syne font-extrabold text-2xl text-green mt-0.5">{amount.toLocaleString('vi-VN')} ₫</p>
          </div>
        )}

        {txnRef && (
          <p className="text-[11px] text-muted font-mono">Ref: {txnRef}</p>
        )}

        <button
          onClick={() => navigate('/school/wallet')}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue text-white text-sm font-semibold cursor-pointer hover:bg-blue/80 transition-colors border-none"
        >
          <FiArrowLeft /> Back to Wallet
        </button>
      </div>
    </div>
  );
}
