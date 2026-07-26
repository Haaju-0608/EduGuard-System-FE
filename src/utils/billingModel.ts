/** Nhãn hiển thị cho billingModel — value thật từ BE là enum PascalCase (Monthly/Yearly). */
export function billingModelLabel(model: string | null | undefined) {
  if (model === 'Monthly') return 'Monthly';
  if (model === 'Yearly') return 'Yearly';
  return model ?? '—';
}
