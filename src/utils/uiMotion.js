const clampProgress = (progress) => Math.min(1, Math.max(0, Number(progress) || 0));

export const easeOutCubic = (progress) => {
  const normalized = clampProgress(progress);
  return 1 - Math.pow(1 - normalized, 3);
};

export const interpolateMetricValue = (start, end, progress, precision = 0) => {
  const next = Number(start) + (Number(end) - Number(start)) * easeOutCubic(progress);
  const factor = Math.pow(10, Math.max(0, precision));
  return Math.round(next * factor) / factor;
};
