# Clash 私有分流规则

保存当前 Clash Verge Rev 使用的订阅增强脚本，便于追踪修改、恢复和迁移。脚本保留个人固定出口与日常代理分工，并接入 AgentRoute 的五类远程规则。

`clash-verge-rules.js` 是 2026-11-11 已生效脚本的原样副本，入口为 `main(config)`。适配并实际验证的环境为 **Clash Verge Rev 2.5.8 / Mihomo v1.19.32**。

## 仓库内容与依赖

- `clash-verge-rules.js`：完整的个人订阅增强逻辑，包括既有策略组、监听入口、DNS 设置，以及新增的 `applyAgentRoute(config)`。
- `README.md`：路由说明、使用方法、验证记录和恢复方法。
- `.gitignore`：排除常见的本地配置、订阅目录、缓存、日志和备份。
- `.gitattributes`：保留脚本原始字节，避免不同平台的换行转换影响归档校验。

仓库不保存订阅链接、节点服务器地址及凭据、控制器密钥、完整运行配置或原始检测日志。脚本中的节点名、策略组名和回环端口用于连接现有配置，本身不包含连接凭据。

这份脚本依赖本地订阅和已有的 CC-Guard 配置链。输入配置中的 `CCGuard-供应商静态代理` 必须由本地配置提供；脚本将它转换为 `cc-guard-claude` 的 `fixed` 节点。缺失或出现多个同名来源时，固定出口使用 `REJECT`。日常代理的优先候选为 `日本JP-HY2`、`韩国KR-HY2`、`新加坡SG-A`、`美国USLA2-A`，随后使用其他有效订阅节点。

因此，换设备时还需要单独迁移有效订阅、固定出口凭据及相关本地增强配置。脚本也依赖原订阅提供的策略组和 MATCH 目标，更换订阅时需要核对这些名称。仓库本身不是可以独立联网的完整 YAML 配置。完整脚本只能应用于原始订阅的增强链；不要把已经生成的 `clash-verge.yaml` 再传给 `main(config)`。

## 路由设计

| 流量 | 策略 |
| --- | --- |
| Claude / Anthropic | `Claude-固定出口` → CC-Guard 固定出口 |
| Google / Gemini | `Google-固定出口` 或既有服务组 → 固定出口链 |
| X / Twitter | `X-固定出口` 或既有服务组 → 固定出口链 |
| OpenAI / ChatGPT / Codex | `OpenAI-日常代理` → `日常网络-自动恢复` |
| 其他流量 | 先匹配个人及订阅具体规则，再使用 AgentRoute 补充和原兜底 |

固定出口组不自动降级到直连或日常代理。日常网络使用订阅节点的自动故障切换。完整脚本还保留本地 HTTP 监听入口 `127.0.0.1:17892`、`:17893`、`:17894`，分别服务固定出口使用和验证流程；迁移时需要检查端口占用及依赖程序。

规则从上到下匹配，主要顺序为：

```text
个人进程、服务域名及技术路径规则
→ 订阅的具体规则
→ globalsign.com 证书服务直连例外
→ AgentRoute private / reject / proxy / direct / cn-ip
→ 原有 .cn / GEOSITE CN 国内域名补充
→ 原 MATCH 目标
```

已有具体规则优先，因此 AgentRoute 广告拦截不会覆盖已被前置规则匹配的流量。这是当前个人配置有意保留的优先级。

## AgentRoute 远程规则

规则来自 [AgentRoute](https://github.com/ryuu-restart/agent-route)，地址及类型参考其[公开索引](https://raw.githubusercontent.com/ryuu-restart/agent-route/release/index.json)。本仓库引用上游规则地址，不复制上游规则数据或接入指令。

| Provider | Mihomo behavior | 动作 |
| --- | --- | --- |
| `agentroute-private` | `domain` | `DIRECT` |
| `agentroute-reject` | `domain` | `REJECT` |
| `agentroute-proxy` | `domain` | `日常网络-自动恢复` |
| `agentroute-direct` | `domain` | `DIRECT` |
| `agentroute-cn-ip` | `ipcidr` | `DIRECT,no-resolve` |

五类规则均使用 Mihomo 原生 YAML 格式，从 `https://raw.githubusercontent.com/ryuu-restart/agent-route/release/mihomo/<类别>.yaml` 下载，每 86400 秒刷新，下载路径使用 `日常网络-自动恢复`，缓存位于 Clash 数据目录下的 `ruleset/agentroute/`。

`applyAgentRoute` 在补充规则时去除完全相同的规则，并用远程 `cn-ip` 替代旧的两种 `GEOIP,CN,DIRECT` 兜底。`no-resolve` 表示匹配此 IP 规则时不主动触发域名解析，不等于禁止 DNS 请求。

上游规则内容由 Mihomo 定期刷新，跟随 AgentRoute 的 release 分支。回退本仓库的 Git 版本只恢复个人脚本，不回退上游规则数据。仓库里的个人 JS 脚本需要通过 Git 管理和本地应用；推送 GitHub 不会自动修改正在运行的 Clash。私有仓库也不作为无需认证的远程订阅地址使用，不需要把 GitHub Token 写入 Clash。

## 在当前电脑应用

当前订阅绑定的脚本文件为：

```text
%APPDATA%\io.github.clash-verge-rev.clash-verge-rev\profiles\shcHexA9Kmgd.js
```

文件标识只适用于当前安装。若以后更换订阅或重装客户端，先在客户端配置中确认实际绑定的增强脚本，避免覆盖其他文件。

1. 在本仓库目录获取或修改 `clash-verge-rules.js`，执行 `node --check .\clash-verge-rules.js` 检查语法。
2. 备份当前绑定脚本，再将仓库脚本复制到该位置。下列 PowerShell 命令适用于当前电脑，在本仓库目录执行：

   ```powershell
   $clashRoot = Join-Path $env:APPDATA 'io.github.clash-verge-rev.clash-verge-rev'
   $targetScript = Join-Path $clashRoot 'profiles\shcHexA9Kmgd.js'
   $backupRoot = Join-Path $clashRoot ('rules_backups\' + (Get-Date -Format 'yyyyMMdd_HHmmss_fff'))
   New-Item -ItemType Directory -Path $backupRoot -ErrorAction Stop | Out-Null
   Copy-Item -LiteralPath $targetScript -Destination (Join-Path $backupRoot 'shcHexA9Kmgd.js') -ErrorAction Stop
   Copy-Item -LiteralPath '.\clash-verge-rules.js' -Destination $targetScript -Force -ErrorAction Stop
   Write-Output "备份目录：$backupRoot"
   ```

3. 在 Clash Verge Rev 的“订阅”页面点击“重新激活订阅”，让客户端读取脚本并重新生成配置。直接编辑生成的 `clash-verge.yaml` 不能替代这个步骤。
4. 核对五个 `agentroute-*` Provider 已加载，并从连接记录确认实际命中规则及出口。若修改了规则逻辑，检查受影响的网站及个人例外。

完整脚本保留了原有 DNS、监听及 TUN 相关配置逻辑，客户端设置仍参与最终配置合并。2026-11-11 的 AgentRoute 增量只改变了运行配置的 `rules` 和 `rule-providers`；这不代表将完整脚本移到其他环境时不会改变 DNS 或策略组。

## 版本管理与恢复

日常流程：修改仓库脚本 → 检查 → 备份并应用 → 验证 → Git 提交与推送。若在 Clash 编辑器直接修改，也应先将实际绑定脚本同步回本仓库，再提交，避免两个副本分叉。

出现问题时，将应用前保存的 `shcHexA9Kmgd.js` 复制回原绑定位置，再点击“重新激活订阅”。从 Git 恢复旧版时，也需要重新复制到绑定位置并重新激活，单独回退 Git 提交不会改变正在运行的客户端。

接入 AgentRoute 之前的本地备份位于：

```text
%APPDATA%\io.github.clash-verge-rev.clash-verge-rev\agentroute_backup_20261111_165334\before\profiles\shcHexA9Kmgd.js
```

用它替换绑定脚本并重新激活订阅，即可撤销本次 AgentRoute 补充；规则缓存可保留，撤销引用后不参与匹配。该备份保留在本机，不上传到仓库。

## 已完成的验证

以下为 **2026-11-11 接入时** 的记录，反映当时的客户端状态，不是持续在线监控：

- 候选配置通过 Mihomo 原生 `-t` 校验；客户端“重新激活订阅”成功，五个远程 Provider 均已加载。
- 原生规则由 3906 条变为 3852 条：删除 57 条完全重复规则、移除 2 条旧 GEOIP 兜底、增加 5 条 RULE-SET。当时五个远程集合合计 344314 条，上游更新后数量可变化。
- 连接记录确认：GitHub 命中代理集合、DeepSeek 命中直连集合、`ads.pubmatic.com` 命中拦截集合、`223.5.5.5` 命中中国 IP 集合。
- Google、Claude、X 保持固定出口；ChatGPT 保持日常代理。节点、订阅文件、DNS、监听、策略组及选择没有因 AgentRoute 增量变化。
- GitHub、Google、ChatGPT、DeepSeek 返回 HTTPS 200；Claude 返回 403，与改前一致，未验证登录或模型调用。百度首次 TLS 失败，复测 200。
- 私有域名集合已加载，未访问真实内网服务作验证；未以真实订阅重新下载或系统重启验证长期持久性。

本次归档的脚本 SHA-256：

```text
1075396bb2aaf15bb5de9e561321c954656c61c9d5d173f0a7c413eb675eeedf
```

浏览器检测状态仍为：[IP 未验证](https://browserleaks.com/ip)、[DNS 未验证](https://browserleaks.com/dns)、[WebRTC 未验证](https://browserleaks.com/webrtc)。Chrome 的 [WebRTC Network Limiter](https://chromewebstore.google.com/detail/webrtc-network-limiter/npeicpdbkakmehahjeeohfdhnlpdklia) 可限制 WebRTC 的网络路径，可能影响音视频；安装状态与等效策略是否生效仍待核实。安装、启用或修改浏览器设置前须取得用户同意。
