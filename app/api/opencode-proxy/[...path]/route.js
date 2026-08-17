// app/api/opencode-proxy/[...path]/route.js
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// 上游地址：OpenCodeGo 的 API 地址，末尾带 /v1
// 建议在 Netlify 环境变量中设置，例如 OPENCODE_UPSTREAM_URL=https://你的opencodego地址/v1
const UPSTREAM_BASE = process.env.OPENCODE_UPSTREAM_URL || 'https://opencode.ai/zen/go/v1';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

async function forward(req, params) {
  const { path } = await params;
  const pathStr = Array.isArray(path) ? path.join('/') : path;

  // 拼接上游完整 URL
  const upstreamUrl = `${UPSTREAM_BASE}/${pathStr}`;

  // 复制请求头
  const headers = new Headers(req.headers);
  // 删除可能干扰转发的头
  headers.delete('host');
  headers.delete('origin');
  headers.delete('referer');

  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer();

  const upstreamRes = await fetch(upstreamUrl, {
    method: req.method,
    headers,
    body,
    redirect: 'follow',
  });

  // 构造返回头，手动加 CORS
  const resHeaders = new Headers(upstreamRes.headers);
  resHeaders.set('Access-Control-Allow-Origin', CORS_ORIGIN);
  resHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  resHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  resHeaders.set('Access-Control-Allow-Credentials', 'true');

  return new NextResponse(upstreamRes.body, {
    status: upstreamRes.status,
    statusText: upstreamRes.statusText,
    headers: resHeaders,
  });
}

export async function GET(req, ctx) { return forward(req, ctx.params); }
export async function POST(req, ctx) { return forward(req, ctx.params); }
export async function PUT(req, ctx) { return forward(req, ctx.params); }
export async function DELETE(req, ctx) { return forward(req, ctx.params); }
export async function PATCH(req, ctx) { return forward(req, ctx.params); }

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': CORS_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
  }
