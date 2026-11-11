// Durable network routing. No credentials in this script.
// Health checks cover the complete fixed-exit chains; no direct fallback.
function main(config) {
  // Recovered supplier remains separate from ordinary subscription routes.
  const ccSourceName = "CCGuard-供应商静态代理";
  const ccSources = (config.proxies || []).filter(n => n.name === ccSourceName);
  config.proxies = (config.proxies || []).filter(n => n.name !== ccSourceName);
  const ccExit = ccSources.length === 1 ? { ...ccSources[0], name: "fixed" } : { name: "fixed", type: "reject" };
  const exitName = "静态IP-链式";
  const chainGroup = "静态出口-自动恢复";
  const daily = "日常网络-自动恢复";
  const available = new Set((config.proxies || []).map(p => p.name));
  const preferred = ["日本JP-HY2", "韩国KR-HY2", "新加坡SG-A", "美国USLA2-A"];
  const fronts = preferred.filter(name => available.has(name));
  // Daily traffic and general DNS must outlive an outage of the verified fronts: they come first, then every
  // other subscription node. Subscription info entries (traffic left, expiry) are not nodes.
  const info = /(剩余|到期|重置|流量|防失联|套餐|距离|永久|官网|GB|TB)/i;
  const dailyFronts = [...fronts, ...(config.proxies || []).filter(p => !fronts.includes(p.name) && p.name !== exitName &&
    !p.name.startsWith("静态出口·") && !["direct", "reject"].includes(String(p.type).toLowerCase()) && !info.test(p.name))
    .map(p => p.name)];
  // All protected services share the verified supplier configured for CC-Guard.
  const protectedGroups = ["Claude-固定出口", "Google-固定出口", "X-固定出口"];
  const dailyGroup = "OpenAI-日常代理";
  const reserved = ["链式前置-固定", "链式前置-自动", chainGroup, daily, "备用机场-日本",
    ...protectedGroups, dailyGroup, "OpenAI-固定出口"];
  const fallback = (name, proxies) => ({name, type: "fallback", proxies: proxies.length ? proxies : ["REJECT"],
    url: "https://www.gstatic.com/generate_204", interval: 30, timeout: 4000,
    lazy: false, "max-failed-times": 2, "expected-status": 204, "empty-fallback": "REJECT"});
  // Remove obsolete legacy supplier nodes; credentials have one maintained source.
  config.proxies = (config.proxies || []).filter(p => p.name !== exitName && !p.name.startsWith("静态出口·"));
  config["proxy-providers"] = {...(config["proxy-providers"] || {})};
  delete config["proxy-providers"]["固定出口链路"];
  const fixedFallback = {name: chainGroup, type: "select", proxies: ["CCGuard-候选出口", "REJECT"]};
  config["proxy-groups"] = (config["proxy-groups"] || []).filter(g => !reserved.includes(g.name));
  for (const g of config["proxy-groups"]) {
    const target = ["Gemini", "Twitter", "谷歌服务"].includes(g.name) ? chainGroup :
      ["节点选择", "自动选择", "ChatGPT", "Netflix", "Telegram", "TikTok", "WhatsApp", "Copilot", "Steam"].includes(g.name) ? daily : null;
    if (target) {
      for (const key of Object.keys(g)) if (key !== "name") delete g[key];
      Object.assign(g, {type: "select", proxies: [target, "REJECT"]});
    }
  }
  config["proxy-groups"].unshift(
    fallback(daily, dailyFronts), fixedFallback,
    ...protectedGroups.map(name => ({name, type: "select", proxies: [chainGroup, "REJECT"]})),
    {name: dailyGroup, type: "select", proxies: [daily, "REJECT"]}
  );
  // This listener pins Claude CLI independently of rule/global/direct mode.
  config.listeners = (config.listeners || []).filter(l => !["claude-fixed-http", "claude-verify-http"].includes(l.name));
  config.listeners.push({name: "claude-fixed-http", type: "http", listen: "127.0.0.1",
    port: 17892, proxy: "Claude-固定出口", users: []});
  // Repair probes the chain here while the protected groups stay REJECT; no client uses it.
  config.listeners.push({name: "claude-verify-http", type: "http", listen: "127.0.0.1",
    port: 17893, proxy: chainGroup, users: []});
  const rules = [
    "PROCESS-NAME,claude.exe,Claude-固定出口",
    "PROCESS-NAME,codex.exe,OpenAI-日常代理",
    "PROCESS-NAME,ChatGPT.exe,OpenAI-日常代理",
    "PROCESS-NAME,Antigravity.exe,Google-固定出口"
  ];
  const domains = {
    // Official app/content hosts: https://code.claude.com/docs/en/desktop#network-access-requirements
    "Claude-固定出口": ["anthropic.com", "claude.ai", "claude.com", "claudeusercontent.com", "clau.de",
      "claudemcpcontent.com", "claude.app"],
    "OpenAI-日常代理": ["openai.com", "chatgpt.com", "oaistatic.com", "oaiusercontent.com", "auth0.com"],
    "Google-固定出口": ["google.com", "googleapis.com", "gstatic.com", "googleusercontent.com", "googlesyndication.com"],
    "X-固定出口": ["x.com", "twitter.com", "twimg.com", "t.co"]
  };
  for (const [group, suffixes] of Object.entries(domains)) {
    for (const domain of suffixes) rules.push(`DOMAIN-SUFFIX,${domain},${group}`);
  }
  // Keep general DNS and recovery probes independent of the fixed SOCKS exit.
  rules.push("IP-CIDR,1.1.1.1/32,日常网络-自动恢复,no-resolve", "IP-CIDR,8.8.8.8/32,日常网络-自动恢复,no-resolve");
  const own = new Set(rules);
  config.rules = [...rules, ...(config.rules || []).filter(r => !own.has(r) &&
    !r.endsWith(",OpenAI-固定出口") && !["claude.exe", "codex.exe", "ChatGPT.exe", "Antigravity.exe"].some(p => r.startsWith("PROCESS-NAME," + p + ",")) &&
    !r.startsWith("IP-CIDR,1.1.1.1/32,") && !r.startsWith("IP-CIDR,8.8.8.8/32,") &&
    !["DOMAIN,www.cloudflare.com,静态IP-链式", "DOMAIN,api.ipify.org,静态IP-链式"].includes(r))];
  // Domestic sites missing from the subscription's short DIRECT list fall to GEOIP,CN, which needs an IP; the DNS
  // answer comes through the daily proxy and is a foreign CDN address, so they reach MATCH and the HY2 fronts drop
  // them. Decide by domain, after every subscription rule, so only traffic reaching the GEOIP/MATCH tail changes.
  // GlobalSign serves the OCSP/CRL of many domestic certificates and the fronts cannot reach it.
  const domestic = ["GEOSITE,CN,DIRECT", "DOMAIN-SUFFIX,globalsign.com,DIRECT"];
  config.rules = config.rules.filter(r => !domestic.includes(r));
  const geoipTail = config.rules.findIndex(r => r.toUpperCase().startsWith("GEOIP,CN,"));
  const matchTail = config.rules.findIndex(r => r.startsWith("MATCH,"));
  config.rules.splice(geoipTail >= 0 ? geoipTail : matchTail >= 0 ? matchTail : config.rules.length, 0, ...domestic);
  const oldDNS = config.dns || {};
  const originalNodePolicy = oldDNS["proxy-server-nameserver-policy"] || oldDNS["nameserver-policy"] || {};
  // Bootstrap DNS for airport hostnames must not need that same airport connection.
  const nodePolicy = Object.fromEntries(Object.entries(originalNodePolicy).map(([name, servers]) =>
    [name, (Array.isArray(servers) ? servers : [servers]).map(s => s.includes("#") ? s : s + "#DIRECT")]));
  const direct = "https://223.5.5.5/dns-query#DIRECT";
  const general = ["https://1.1.1.1/dns-query", "https://8.8.8.8/dns-query"];
  // Group health checks request www.gstatic.com. With respect-rules, that name
  // resolves through Google-固定出口, i.e. the static chain. When the static IP
  // dies, every group's health check dies with it and the daily network follows.
  // Resolve these names directly; the connection itself still follows the rules.
  const healthDns = {
    "+.gstatic.com": direct, "+.googleapis.com": direct, "+.google.com": direct,
    "+.googleusercontent.com": direct, "+.googlesyndication.com": direct
  };
  config.dns = {...oldDNS, enable: true, ipv6: false, listen: "127.0.0.1:1053",
    "prefer-h3": false, "respect-rules": true,
    "default-nameserver": [direct],
    "proxy-server-nameserver": [direct],
    "proxy-server-nameserver-policy": nodePolicy,
    "nameserver-policy": healthDns, nameserver: general, fallback: [],
    "direct-nameserver": [direct], "direct-nameserver-follow-policy": false};
  // The app's TUN settings remain authoritative and are saved separately.
  config.tun = {...(config.tun || {}), "dns-hijack": ["any:53", "tcp://any:53"], "strict-route": true};
  config.mode = "rule";
  config.profile = {...(config.profile || {}), "store-selected": true};
  // Shared fixed egress for Claude, Google/Gemini and X, approved on 2026-11-09.
  const claudeProvider = "cc-guard-claude";
  config["proxy-providers"][claudeProvider] = { type: "inline", payload: [ccExit] };
  const claude = config["proxy-groups"].find(g => g.name === "Claude-固定出口");
  const candidate = "CCGuard-候选出口";
  claude.proxies = [candidate, "REJECT"];
  config["proxy-groups"] = config["proxy-groups"].filter(g => g.name !== candidate);
  config["proxy-groups"].push({ name: candidate, type: "select", use: [claudeProvider], filter: "^fixed$", "empty-fallback": "REJECT", hidden: true });
  config.listeners = config.listeners.filter(l => l.name !== "cc-guard-verify-candidate");
  config.listeners.push({ name: "cc-guard-verify-candidate", type: "http", listen: "127.0.0.1", port: 17894, proxy: candidate });
  return applyAgentRoute(config);
}

// AgentRoute supplements the user's and subscription's specific routes.
// This extension is re-applied by Clash Verge whenever the subscription is regenerated.
function applyAgentRoute(config) {
  const daily = "日常网络-自动恢复";
  const names = ["private", "reject", "proxy", "direct", "cn-ip"];
  config["rule-providers"] = {...(config["rule-providers"] || {})};
  for (const name of names) {
    config["rule-providers"]["agentroute-" + name] = {
      type: "http", behavior: name === "cn-ip" ? "ipcidr" : "domain", format: "yaml",
      url: "https://raw.githubusercontent.com/ryuu-restart/agent-route/release/mihomo/" + name + ".yaml",
      path: "./ruleset/agentroute/" + name + ".yaml", interval: 86400, proxy: daily
    };
  }
  const existing = (config.rules || []).filter(rule => !rule.startsWith("RULE-SET,agentroute-") &&
    !/^GEOIP,CN,DIRECT(?:,no-resolve)?$/i.test(rule));
  // Keep the certificate-service exception ahead of the general rule sets.
  const certificate = "DOMAIN-SUFFIX,globalsign.com,DIRECT";
  const rules = existing.filter(rule => rule !== certificate);
  const insertAt = rules.findIndex(rule => /^(GEOSITE,CN,|DOMAIN-SUFFIX,CN,|MATCH,)/i.test(rule));
  rules.splice(insertAt < 0 ? rules.length : insertAt, 0, certificate,
    "RULE-SET,agentroute-private,DIRECT",
    "RULE-SET,agentroute-reject,REJECT",
    "RULE-SET,agentroute-proxy," + daily,
    "RULE-SET,agentroute-direct,DIRECT",
    "RULE-SET,agentroute-cn-ip,DIRECT,no-resolve");
  config.rules = [...new Set(rules)];
  return config;
}
