import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ExamTerminationProvider } from './contexts/ExamTerminationContext';
import ToastContainer from './components/feedback/ToastContainer';

// Trình duyệt mặc định đổi giá trị <input type="number"> đang focus khi lăn chuột qua — bỏ focus
// ngay khi lăn để chặn hành vi này trên toàn app, không cần sửa từng input riêng lẻ.
document.addEventListener(
  'wheel',
  (e) => {
    const target = e.target;
    if (target instanceof HTMLInputElement && target.type === 'number' && document.activeElement === target) {
      target.blur();
    }
  },
  { passive: true },
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <ThemeProvider>
        <ToastProvider>
          <NotificationProvider>
            <ExamTerminationProvider>
              <App />
              <ToastContainer />
            </ExamTerminationProvider>
          </NotificationProvider>
        </ToastProvider>
      </ThemeProvider>
    </AuthProvider>
  </StrictMode>,
);
