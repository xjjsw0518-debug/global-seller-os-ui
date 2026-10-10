// User-selected 771273.png: local visual samples, never live routing facts.
const firstRows = [
  ["成本优化", "当前成本较高，建议切换至更高性价比模型", "qwen-plus", "40%", "20%", "节省 $12.30 / 天", "LOW"],
  ["性能提升", "高峰期延迟上升，建议增加高性能模型比例", "GPT-4o", "30%", "50%", "延迟降低 45%", "MEDIUM"],
  ["风险规避", "模型错误率上升，建议切换备用模型", "Claude 3.5", "15%", "5%", "成功率 +12.4%", "HIGH"],
  ["负载均衡", "当前负载不均，建议调整流量分配", "DeepSeek V3", "10%", "20%", "系统更稳定", "LOW"],
  ["非高峰处理", "适合批量处理的任务，建议移至非高峰时段", "Gemini 1.5", "5%", "15%", "节省 $8.60 / 天", "LOW"],
];
const categories = ["成本优化", "成本优化", "成本优化", "成本优化", "成本优化", "成本优化", "成本优化", "性能提升", "性能提升", "性能提升", "性能提升", "风险规避", "风险规避", "负载均衡", "负载均衡", "负载均衡", "非高峰处理", "非高峰处理", "非高峰处理"];
export const frozenAdviceRows = [...firstRows, ...categories.map((category, index) => {
  const template = firstRows.find((row) => row[0] === category);
  return [category, template[1], template[2], `${10 + index % 4 * 10}%`, `${15 + index % 4 * 10}%`, template[5], [2, 6, 9, 13, 17].includes(index) ? "HIGH" : index % 3 === 0 ? "MEDIUM" : "LOW"];
})].map(([category, reason, model, currentShare, proposedShare, benefit, risk], index) => ({ id: `routing-visual-${index + 1}`, category, reason, model, currentShare, proposedShare, benefit, risk, status: "待应用", scope: ["文案生成任务", "数据分析任务", "批量商品任务"][index % 3] }));
export const frozenRoutingHistory = [
  { time: "2024-12-07 14:20", text: "将20%流量从GPT-4切换至qwen-plus", scope: "文案生成任务", benefit: "节省 $6.20 / 天", status: "已启用", result: "执行成功" },
  { time: "2024-12-07 11:36", text: "增加DeepSeek V3在高峰期的流量配比", scope: "数据分析任务", benefit: "成功率 +9.8%", status: "已启用", result: "执行成功" },
  { time: "2024-12-07 09:18", text: "启用非高峰批处理策略", scope: "批量商品任务", benefit: "节省 $12.60 / 天", status: "已启用", result: "执行成功" },
];
