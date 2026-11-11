# Clash Routing Rules

**一份用于 Clash Verge Rev 的 JavaScript 订阅增强脚本：保留重要服务的指定出口，用自动更新的规则补充直连、代理和广告拦截。**

可以把它理解成给现有订阅增加一层“交通指挥”：节点负责连接网络，这份脚本决定哪些流量交给哪个节点组。通用域名和 IP 清单来自 [AgentRoute](https://github.com/ryuu-restart/agent-route)。

本仓库分享的是一份已在个人环境运行的配置实例，**需要你已有可用订阅，不提供代理节点或固定 IP**。主要文件为 [clash-verge-rules.js](./clash-verge-rules.js)。

## 它能做什么

| 能力 | 实际用途 |
| --- | --- |
| 服务分别走指定出口 | 示例中 Claude、Google/Gemini、X 使用固定出口；OpenAI/ChatGPT/Codex 使用日常代理 |
| 补充直连、代理和拦截清单 | 让订阅没有明确处理的网站也能按通用规则分流 |
| 自动更新通用清单 | 五个 AgentRoute 规则集每 24 小时尝试刷新 |
| 保留已有具体规则的优先级 | 个人例外、服务规则和订阅具体规则优先于新增通用清单 |
| 清理完全相同的规则 | 减少重复项，方便检查和维护 |
| 随订阅重新生成而应用 | 把逻辑保存在增强脚本里，避免只修改临时生成的配置 |

## 适用环境与两种用法

实际验证环境：**Windows / Clash Verge Rev 2.5.8 / Mihomo v1.19.32**。其他系统、客户端和核心版本没有在本仓库验证。

脚本由两个函数组成：

| 函数 | 负责什么 | 适合谁 |
| --- | --- | --- |
| `applyAgentRoute(config)` | 添加远程规则集、安排顺序、替换旧中国 IP 兜底并去重 | 已有自己的配置，只想借鉴 AgentRoute 接入方式的人 |
| `main(config)` | 构建作者的个人策略组、固定出口、进程规则、DNS 和监听入口，最后调用上面的函数 | 准备适配整套个人路由方案的人 |

**多数人可以从单独接入 `applyAgentRoute` 开始。** 完整 `main` 带有个人节点名和 CC-Guard 依赖，直接覆盖到其他订阅可能导致指定服务无法联网。

## 用法一：给自己的脚本补充 AgentRoute

这一用法只引入规则补充函数，继续使用你自己的节点、策略组、DNS 和监听配置。

1. 备份目标订阅当前使用的增强脚本和相关配置。
2. 打开 [clash-verge-rules.js](./clash-verge-rules.js)，将文件末尾完整的 `applyAgentRoute(config)` 函数复制到你现有增强脚本的顶层，与 `main` 并列。
3. 在复制的函数内，将 `const daily = "日常网络-自动恢复";` 改为你配置中**已经存在且可用**的日常代理组名称，例如 `const daily = "节点选择";`。它同时负责通用代理流量和规则下载。
4. 保留你原来 `main` 中的处理逻辑，在最终返回配置的位置调用 `applyAgentRoute(config)`。如果原来结尾是 `return config;`，将它改为 `return applyAgentRoute(config);`。同一个脚本只保留一个 `main`。
5. 保存脚本，在 Clash Verge Rev 的“订阅”页点击“重新激活订阅”，然后按下文检查规则加载和实际分流。

调用结构如下；这里是结构示意，`applyAgentRoute` 的完整实现仍需从脚本复制：

```js
function main(config) {
  // 保留你原来对 config 的处理。
  return applyAgentRoute(config);
}

// 在这里放置复制来的完整 applyAgentRoute(config) 函数。
```

这个函数仍包含两项具体取舍，需要结合自己的规则决定是否保留：

- 添加 `globalsign.com` 的直连例外。这是作者环境中为证书服务保留的安排，其他环境可删除 `certificate` 相关处理。
- 删除 `GEOIP,CN,DIRECT` 和 `GEOIP,CN,DIRECT,no-resolve`，使用 AgentRoute 的 `cn-ip` 集合接替它们。

函数把新增规则放到第一条 `GEOSITE,CN,...`、`DOMAIN-SUFFIX,CN,...` 或 `MATCH,...` 之前；如果这些标记都不存在，就追加到末尾。接入前应确认自己的规则结构适合这个位置；更早的其他兜底规则可能使新增规则无法被匹配。不要在同一配置的多个增强阶段重复接入。

## 用法二：适配完整的个人路由方案

完整脚本的默认分工如下：

| 流量 | 示例中的路径 |
| --- | --- |
| Claude / Anthropic | `Claude-固定出口` → `CCGuard-候选出口` → 固定节点 |
| Google / Gemini | 专用服务组 → 固定出口链 |
| X / Twitter | 专用服务组 → 固定出口链 |
| OpenAI / ChatGPT / Codex | `OpenAI-日常代理` → `日常网络-自动恢复` |
| 其他流量 | 已有具体规则 → AgentRoute 补充 → 原默认规则 |

固定出口组没有自动回退到日常代理或直连的路径；日常代理组使用订阅节点做故障切换。固定 IP 需要由你自己的节点服务提供，脚本不能把普通节点变成固定 IP。

使用完整脚本前，需要适配这些位置：

| 位置或名称 | 需要准备或修改的内容 |
| --- | --- |
| `ccSourceName` | 输入配置必须提供唯一一个名为 `CCGuard-供应商静态代理` 的节点，或改成你自己的来源节点名；凭据在本地提供 |
| `preferred` | 将日本、韩国等示例节点名改为自己的优先节点；脚本还会追加其他有效订阅节点 |
| 服务组名称和原 `MATCH` 目标 | 核对自己的订阅确实提供这些组，必要时调整映射 |
| `domains` 与进程规则 | 按自己的服务出口要求修改；进程名称示例使用 Windows 的 `.exe` 名称 |
| DNS 配置段 | 包含公共加密 DNS、节点域名解析和健康检查域名的安排，需结合自己的网络确认 |
| 本地端口 `17892 / 17893 / 17894` | 分别用于固定出口使用和本地验证流程，需核对端口占用及依赖程序 |
| TUN、模式和选择记忆字段 | 脚本设置部分 TUN 字段、`mode: rule` 和 `store-selected`，最终结果还受客户端合并影响 |

这里的 CC-Guard 是作者本地的出口管理流程。脚本会把来源节点转换为 `cc-guard-claude` Provider 中的 `fixed` 节点；来源节点缺失或重名时，该节点使用 `REJECT`，对应服务会无法联网。

适配后，将完整文件用于目标订阅的 JavaScript 增强入口，再重新激活订阅。**完整 `main` 的输入应是该订阅的生成链配置，不能把已经处理过的 `clash-verge.yaml` 再交给它执行**：来源节点已被移走，二次处理会导致固定出口被替换成 `REJECT`。

每个安装生成的绑定脚本文件名不同，请从自己的订阅配置确认。直接编辑生成的 `clash-verge.yaml` 不会替代持久增强脚本。

## 为什么这样安排规则顺序

Clash 按顺序匹配，先命中的规则决定路径。作者环境中的主要顺序是：

```text
个人进程、服务域名及技术路径规则
  ↓
订阅的具体规则、证书服务直连例外
  ↓
内网 → 广告拦截 → 海外代理 → 国内直连 → 中国 IP
  ↓
原有 .cn / GEOSITE CN 国内域名补充
  ↓
原 MATCH 默认出口
```

例如，一个网站已经被前面的个人规则指定走固定出口，就不会再被后面的通用规则改走其他线路。相应地，**广告拦截也不能覆盖已经被前置规则匹配的请求**。这种顺序适合希望保留既有使用习惯、再补充分流覆盖的人。

`GEOSITE,CN` 属于完整方案保留的国内域名补充，依赖客户端提供相应 geodata；只复制 `applyAgentRoute` 不会自动添加这一规则。

## 五类远程规则及更新方式

| Provider | 内容 | 动作 | Mihomo behavior |
| --- | --- | --- | --- |
| `agentroute-private` | 私有或内部用途域名 | 直连 `DIRECT` | `domain` |
| `agentroute-reject` | 上游收录的拦截域名 | 拦截 `REJECT` | `domain` |
| `agentroute-proxy` | 上游收录的代理域名 | 交给 `daily` 指定的代理组 | `domain` |
| `agentroute-direct` | 上游收录的直连域名 | 直连 `DIRECT` | `domain` |
| `agentroute-cn-ip` | 中国 IP 网段 | `DIRECT,no-resolve` | `ipcidr` |

地址、规则类型及建议刷新间隔来自 [AgentRoute 公开索引](https://raw.githubusercontent.com/ryuu-restart/agent-route/release/index.json)。本仓库只引用其发布地址，不维护或复制完整上游数据。

```text
下载地址：https://raw.githubusercontent.com/ryuu-restart/agent-route/release/mihomo/<类别>.yaml
文件格式：Mihomo YAML
刷新间隔：86400 秒（24 小时）
下载出口：daily 指定的代理组
本地缓存：Clash 数据目录下的 ruleset/agentroute/
```

`no-resolve` 表示匹配这条 IP 规则时不主动触发域名解析，并不关闭 DNS。

两种更新需要区分：**规则清单由 Mihomo 定期刷新；个人 JavaScript 脚本需要自行更新并重新激活订阅。** `git pull` 或 `git push` 不会自动改动正在运行的 Clash。回退本仓库的脚本版本，也不会回退 AgentRoute release 分支上的规则数据。

## 如何确认生效

1. 保存并重新激活订阅，确认客户端没有报告配置生成或加载失败。
2. 检查配置中的五个 `agentroute-*` Provider 已加载，且规则下载没有报错。配置项含义见 [Mihomo 规则集合文档](https://wiki.metacubex.one/config/rule-providers/)。
3. 访问自己关心的网站，从连接记录查看命中的规则和实际出口，尤其检查已有个人例外。

如果安装了 Node.js，可以在应用前运行 `node --check clash-verge-rules.js` 做语法检查；**运行脚本本身不需要另外安装 Node.js**，由 Clash Verge Rev 执行。语法通过只说明 JavaScript 可解析，不能替代客户端加载和联网检查。

下面是作者在 **2026-11-11** 接入时的验证记录，供理解行为；上游更新或网络环境不同后，结果可能变化：

| 检查 | 当时的结果 |
| --- | --- |
| Mihomo 原生配置校验、客户端重新生成 | 通过，五个远程 Provider 均已加载 |
| GitHub | 命中 `agentroute-proxy`，走日常代理 |
| DeepSeek | 命中 `agentroute-direct`，直连 |
| `ads.pubmatic.com` | 命中 `agentroute-reject`，拦截 |
| `223.5.5.5` | 命中 `agentroute-cn-ip`，直连 |
| Google、Claude、X / ChatGPT | 分别保留原固定出口 / 日常代理 |

当时去除了 57 条完全重复规则，五个远程集合合计 344314 条。Claude 页面返回 403，与改前一致，未验证登录或模型调用；私有域名集合仅验证加载，未访问实际内网服务。真实订阅重新下载和系统重启后的长期表现尚未验证。

路由正确不等于完成了浏览器隐私检测。本仓库没有提供已通过的浏览器检测结论，可在自己的常用浏览器分别检查 [IP](https://browserleaks.com/ip)、[DNS](https://browserleaks.com/dns) 和 [WebRTC](https://browserleaks.com/webrtc)。Chrome 的 [WebRTC Network Limiter](https://chromewebstore.google.com/detail/webrtc-network-limiter/npeicpdbkakmehahjeeohfdhnlpdklia) 可限制 WebRTC 网络路径，也可能影响音视频，是否使用由你决定。

## 更新与恢复

建议流程：**修改脚本 → 备份现有配置 → 应用并重新激活 → 检查受影响的流量 → 保存 Git 版本。**

如果接入后出现问题，将应用前备份的增强脚本及本次改动的其他配置恢复，再重新激活订阅。已经下载的规则缓存可以保留，没有配置引用就不会参与匹配。

从 Git 取回旧版本时，还需要把它应用到实际绑定的增强脚本；单独回退提交不会改变客户端。首次提交保存的是作者已经接入 AgentRoute 的版本，不包含接入前的完整环境。

## 文件与来源

```text
clash-verge-rules.js   完整个人增强脚本，含可单独借鉴的 applyAgentRoute 函数
README.md              用途、适配方法、规则顺序、验证和恢复说明
.gitignore             排除常见的本地配置、订阅、缓存、日志和备份
.gitattributes         保留归档脚本的原始字节，避免自动换行转换
```

仓库不包含订阅链接、节点连接凭据、控制器密钥或完整运行配置。节点名、策略组名和本地回环端口是示例中的配置约定，不能代替自己的节点数据。

- [AgentRoute](https://github.com/ryuu-restart/agent-route)：远程分流数据与发布索引。
- [Clash Verge Rev](https://github.com/clash-verge-rev/clash-verge-rev)：订阅管理和 JavaScript 增强入口。
- [Mihomo](https://github.com/MetaCubeX/mihomo)：实际执行规则、代理连接和远程规则刷新。

本仓库是个人配置实例，与上述项目分别维护。反馈问题时，请说明客户端和核心版本、采用哪一种用法、预期与实际命中的规则，并去掉订阅地址、节点凭据和完整配置中的敏感内容。
