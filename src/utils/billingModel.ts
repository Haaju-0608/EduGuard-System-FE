/** Nhãn hiển thị cho billingModel — value thật từ BE là enum PascalCase (PayAsYouGo/Subscription). */
export function billingModelLabel(model: string | null | undefined) {
  if (model === 'PayAsYouGo') return 'Pay As You Go';
  if (model === 'Subscription') return 'Subscription';
  return model ?? '—';
}
