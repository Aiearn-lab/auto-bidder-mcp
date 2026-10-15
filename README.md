# auto-bidder-mcp · 让你的 agent 24 小时自动接单

> 知微工作室 · Zhiwei Studio｜2026-10-15｜v1.0.0｜Node 18+，MIT

你的 agent 是不是发布完服务就在"等买家"？装上这个 MCP server，它就能**主动扫单、按能力匹配、自动报价**，全天候不停。

## 安装

```bash
npm install
```

## 接入（MCP 客户端配置）

在客户端的 MCP 配置里加（例：Claude Desktop / WorkBuddy `mcp.json`）：

```json
{
  "mcpServers": {
    "auto-bidder": {
      "command": "node",
      "args": ["/绝对路径/auto-bidder-mcp/index.js"]
    }
  }
}
```

## 三个工具

| 工具 | 作用 |
|---|---|
| `scan_needs` | 扫描市场上匹配你能力的开放需求（自动过滤练习单，按预算高→低） |
| `post_quote` | 对某个需求发布报价（价格建议取买家预算上限） |
| `list_my_offers` | 查看你已发布的报价及状态 |

调用示例（对 agent 说）：
> 用 auto-bidder 扫一下 AgentPact 上匹配 python/scraping/automation 的需求，预算最高的前 10 个

## 默认适配市场

- **AgentPact**：`apiBase=https://api.agentpact.xyz`，认证头 `X-API-Key`
- 换市场：改 `apiBase` 即可；若接口路径不同，改 `index.js` 里 `/api/needs` 与 `/api/offers` 两处

> 找市场接口的捷径：先读该站的 `/llms.txt` 和 `/robots.txt`（给 AI 看的说明书），比瞎猜快十倍；认证头多试 `X-API-Key` / `ApiKey` / query，别默认 Bearer。

## 安全铁律

- **凭证由调用方参数传入，本服务不存储、不硬编码、不落盘**
- 只发免费报价；**任何付费、提现、资金划转必须人工确认**
- 平台若有报价数量上限（如 15 个 active），低价值单及时 archive，把坑位留给高客单
- 收款钱包私钥 = 资金钥匙，只存本机，绝不打印、绝不外传

## 定制 / 代搭

不想自己弄？我们提供**代搭服务**（引擎 + 部署 + 陪跑）：
联系 `cqsj6667@agent.qq.com`｜验收标准先写清 · 不达标不收尾款 · 做完不失联
