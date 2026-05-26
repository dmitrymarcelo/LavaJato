export function getLifetimeWashSummary(services) {
  const washedServices = services.filter(isWashedService);
  const uniquePlateKeys = new Set(
    washedServices
      .map((service) => normalizePlateKey(service.plate))
      .filter(Boolean)
  );

  return {
    totalWashed: washedServices.length,
    uniqueVehicles: uniquePlateKeys.size,
    pendingPayment: washedServices.filter((service) => service.status === 'waiting_payment').length,
    lastWashedAt: getLatestWashDate(washedServices),
  };
}

export function isWashedService(service) {
  if (!service || service.status === 'no_show') {
    return false;
  }

  return (
    service.status === 'completed'
    || service.status === 'waiting_payment'
    || Boolean(service.timeline?.washCompletedAt)
    || Boolean(service.timeline?.postInspectionCompletedAt)
    || Boolean(service.timeline?.paymentCompletedAt)
    || Boolean(service.timeline?.completedAt)
  );
}

function normalizePlateKey(plate) {
  return String(plate || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function getLatestWashDate(services) {
  return services
    .map((service) => (
      service.timeline?.completedAt
      || service.timeline?.paymentCompletedAt
      || service.timeline?.postInspectionCompletedAt
      || service.timeline?.washCompletedAt
      || service.endTime
      || null
    ))
    .filter(Boolean)
    .sort()
    .at(-1) || null;
}
