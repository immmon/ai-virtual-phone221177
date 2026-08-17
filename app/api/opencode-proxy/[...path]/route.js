// 上游 API 地址（末尾不要带斜杠）
// 优先从环境变量读取，如果没设置则使用下面的默认值
const UPSTREAM_BASE = process.env.OPENCODE_UPSTREAM_URL || 'https://heddsghnvvc/api/opencode-proxy';

// 允许跨域的来源（* 表示所有）
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// 处理所有 HTTP 方法（GET, POST, PUT, DELETE, OPTIONS 等）
export async function handler(request, { params }) {
  const path = params.path || [];
  const pathStr = '/' + path.join('/');
  const upstreamUrl = `${UPSTREAM_BASE}${pathStr}`;

  // 1. 处理 OPTIONS 预检请求（直接返回 CORS 头）
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': CORS_ORIGIN,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  try {
    // 2. 构建转发请求
    const fetchOptions = {
      method: request.method,
      headers: {
        // 透传大部分请求头，但去掉 host 等
        ...Object.fromEntries(request.headers.entries()),
        // 可以覆盖或添加自定义头，例如：
        // 'Authorization': request.headers.get('Authorization') || '',
      },
      // 如果有请求体（POST/PUT），直接转发
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      // 不压缩，直接透传
      duplex: 'half',
    };

    // 3. 发送请求到上游
    const response = await fetch(upstreamUrl, fetchOptions);

    // 4. 构建响应（直接透传状态码和响应体）
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Access-Control-Allow-Origin', CORS_ORIGIN);
    // 如果需要，也可以设置其他 CORS 头
    // responseHeaders.set('Access-Control-Allow-Credentials', 'true');

    // 5. 返回响应（注意：如果响应体是流，需要克隆或直接使用）
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    // 6. 错误处理：返回 500 并带上错误信息（方便调试）
    console.error('代理错误:', error);
    return new Response(
      JSON.stringify({
        error: '代理请求失败',
        message: error.message,
        stack: error.stack,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': CORS_ORIGIN,
        },
      }
    );
  }
}

// 为所有方法导出同一个处理函数（Next.js App Router 要求）
export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
export const OPTIONS = handler;
// 如果还需要其他方法，按同样方式添加
