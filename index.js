#!/usr/bin/env node
/**
 * auto-bidder-mcp — 让你的 agent 24h 自动接单（MCP 版）
 * 知微工作室 · Zhiwei Studio · 2026-10-15 · v1.0.0
 *
 * 提供 3 个工具：
 *   scan_needs      扫描市场上匹配你能力的开放需求（自动过滤练习单）
 *   post_quote      对某个需求发布报价
 *   list_my_offers  查看你已发布的报价及状态
 *
 * 安全设计：
 *   - 凭证全部由调用方参数传入，本服务不存储、不硬编码、不落盘。
 *   - 只做"免费报价"，绝不做任何付费 / 提现 / 资金划转动作。
 *   - 默认适配 AgentPact（https://api.agentpact.xyz，认证头 X-API-Key）；
 *     换市场只需改 apiBase 与两个接口路径。
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const DEFAULT_CAPS = [
  "python", "data", "scraping", "api", "automation",
  "code-review", "llm", "integration", "documentation", "test",
];

const server = new Server(
  { name: "auto-bidder-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

async function api(apiBase, apiKey, path, method = "GET", payload) {
  const res = await fetch(apiBase.replace(/\/$/, "") + path, {
    method,
    headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "scan_needs",
      description: "扫描市场上匹配你能力的开放需求（自动过滤练习单，按预算从高到低排序）",
      inputSchema: {
        type: "object",
        properties: {
          apiBase: { type: "string", description: "市场 API 地址，例：https://api.agentpact.xyz" },
          apiKey: { type: "string", description: "你的 agent API Key" },
          capabilityKeywords: { type: "array", items: { type: "string" }, description: "你的能力关键词" },
          practiceCeiling: { type: "number", description: "低于此价格视为练习单，默认 1" },
          limit: { type: "number", description: "返回条数，默认 20" },
        },
        required: ["apiBase", "apiKey"],
      },
    },
    {
      name: "post_quote",
      description: "对某个需求发布报价（价格建议取买家预算上限，不漫天要价）",
      inputSchema: {
        type: "object",
        properties: {
          apiBase: { type: "string" },
          apiKey: { type: "string" },
          agentId: { type: "string" },
          needId: { type: "string" },
          price: { type: "number" },
          title: { type: "string" },
          description: { type: "string" },
        },
        required: ["apiBase", "apiKey", "agentId", "needId", "price"],
      },
    },
    {
      name: "list_my_offers",
      description: "查看你已发布的报价及状态",
      inputSchema: {
        type: "object",
        properties: {
          apiBase: { type: "string" },
          apiKey: { type: "string" },
          agentId: { type: "string" },
        },
        required: ["apiBase", "apiKey", "agentId"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: a } = req.params;
  try {
    if (name === "scan_needs") {
      const caps = (a.capabilityKeywords && a.capabilityKeywords.length
        ? a.capabilityKeywords : DEFAULT_CAPS).map(s => String(s).toLowerCase());
      const ceiling = a.practiceCeiling === undefined ? 1 : Number(a.practiceCeiling);
      const { body } = await api(a.apiBase, a.apiKey, "/api/needs");
      const needs = Array.isArray(body) ? body : [];
      const scored = needs
        .map(n => {
          const blob = [n.title, n.description_md, (n.tags || []).join(" ")].join(" ").toLowerCase();
          const score = caps.filter(c => blob.includes(c)).length;
          return { n, score };
        })
        .filter(x => x.score > 0)
        .filter(x => !/practice/i.test((x.n.title || "") + (x.n.description_md || "")))
        .filter(x => Number(x.n.budget_max || 0) > ceiling)
        .sort((p, q) => Number(q.n.budget_max || 0) - Number(p.n.budget_max || 0))
        .slice(0, a.limit === undefined ? 20 : Number(a.limit));
      const out = scored.map(x => ({
        id: x.n.id, title: x.n.title, budget: x.n.budget_max,
        category: x.n.category, matchScore: x.score,
      }));
      return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
    }

    if (name === "post_quote") {
      const payload = {
        agentId: a.agentId,
        title: String(a.title || ("Re: " + a.needId)).slice(0, 100),
        descriptionMd: a.description ||
          "Delivery with acceptance criteria agreed before start. One revision round included.",
        category: "development",
        basePrice: Number(a.price),
        tags: [],
      };
      const r = await api(a.apiBase, a.apiKey, "/api/offers", "POST", payload);
      return { content: [{ type: "text", text: JSON.stringify(r) }] };
    }

    if (name === "list_my_offers") {
      const { body } = await api(a.apiBase, a.apiKey, "/api/offers");
      const offers = Array.isArray(body) ? body : [];
      const mine = offers.filter(o => (o.agent_id || o.agentId) === a.agentId);
      const out = mine.map(o => ({ id: o.id, status: o.status, price: o.basePrice, title: o.title }));
      return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
    }

    return { content: [{ type: "text", text: "unknown tool: " + name }], isError: true };
  } catch (e) {
    return { content: [{ type: "text", text: "error: " + (e && e.message ? e.message : String(e)) }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
