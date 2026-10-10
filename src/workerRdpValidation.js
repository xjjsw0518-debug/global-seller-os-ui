const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const IPV4_VALID = /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const DNS_LABEL = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;

export function isValidRdpHost(value) {
  const raw = String(value ?? "").trim();
  if (!raw || /[\s\\/?#@%]/.test(raw) || raw.includes("://")) return false;
  let host = raw;
  if (raw.startsWith("[") || raw.endsWith("]")) {
    if (!(raw.startsWith("[") && raw.endsWith("]"))) return false;
    host = raw.slice(1, -1);
  }
  if (host.includes(":")) {
    if (!/^[0-9a-fA-F:.]+$/.test(host)) return false;
    try {
      const parsed = new URL("http://[" + host + "]/");
      return parsed.hostname.startsWith("[") && parsed.hostname.endsWith("]");
    } catch { return false; }
  }
  if (IPV4.test(host)) return IPV4_VALID.test(host);
  const dns = host.endsWith(".") ? host.slice(0, -1) : host;
  if (!dns || dns.length > 253) return false;
  return dns.split(".").every((label) => label.length <= 63 && DNS_LABEL.test(label));
}

export function isValidRdpPort(value) {
  const raw = String(value ?? "").trim();
  if (!/^\d{1,5}$/.test(raw)) return false;
  const port = Number(raw);
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

export function getRdpAddressErrors(host, port) {
  const errors = [];
  if (!isValidRdpHost(host)) errors.push("请输入有效的 RDP 主机名或 IP 地址（不含协议或路径）。");
  if (!isValidRdpPort(port)) errors.push("RDP 端口须为 1 至 65535 的整数。");
  return errors;
}

export function formatRdpEndpoint(host, port = 3389) {
  const value = String(host ?? "").trim();
  if (!value) return "未配置";
  const bracketedIpv6 = value.startsWith("[") && value.endsWith("]");
  const isIpv6 = value.includes(":");
  const displayHost = isIpv6 && !bracketedIpv6 ? "[" + value + "]" : value;
  return displayHost + ":" + (port || 3389);
}
