/** Display labels only: canonical API values and statistical inputs stay intact. */
export const presentModelQuotaMetric = (value) => value === "UNKNOWN" ? "未知" : value;

export function presentModelQuotaReadSource(source, referenceVisual = false) {
  if (referenceVisual) return source;
  if (source === "SERVER_READ_PROJECTION") return "实时";
  if (source === "TEST_FIXTURE") return "样例";
  return "未知";
}
