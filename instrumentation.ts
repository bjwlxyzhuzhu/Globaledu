/**
 * 服务端启动钩子：需要时让 Node 的 fetch 走本机代理（Clash），
 * 否则 openai/supabase 的服务端调用在某些网络下连不上（curl 走代理而 Node fetch 默认不走）。
 * 代理地址从 DEV_PROXY（.env.local）或 HTTPS_PROXY/HTTP_PROXY 读取。
 *
 * 先探测代理端口是否真的在监听：开机自启时本站可能比 Clash 先起来，
 * 那时若硬套代理，所有服务端外部请求会全部失败。探测不通就直连。
 * 阿里云生产环境不设这些变量，自动直连，不受影响。
 *
 * ⚠ 全部逻辑必须写在 `if (NEXT_RUNTIME === "nodejs")` 这个正向判断块内部：
 *   中间件存在时 Next 会把本文件也编到 edge runtime，靠这个块做死代码消除，
 *   undici / node:* 才不会被打进 edge 包（否则 build 直接报 UnhandledSchemeError）。
 *   改成提前 return 的写法会破坏消除，切勿改。
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const proxy =
      process.env.DEV_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    if (!proxy) {
      console.log("[dev-proxy] 未配置代理，直连外部服务");
      return;
    }

    // 400ms TCP 探活：端口没在听就别用代理
    const alive = await (async () => {
      try {
        const { hostname, port } = new URL(proxy);
        const net = await import("node:net");
        return await new Promise<boolean>((resolve) => {
          const sock = net.connect({ host: hostname, port: Number(port) || 80 });
          const done = (ok: boolean) => { sock.destroy(); resolve(ok); };
          sock.setTimeout(400, () => done(false));
          sock.on("connect", () => done(true));
          sock.on("error", () => done(false));
        });
      } catch {
        return false;
      }
    })();

    if (!alive) {
      console.log("[dev-proxy] 代理", proxy, "未在监听，改为直连外部服务");
      return;
    }

    const { setGlobalDispatcher, ProxyAgent } = await import("undici");
    setGlobalDispatcher(new ProxyAgent(proxy));
    console.log("[dev-proxy] 服务端 fetch 经代理访问外部服务:", proxy);
  }
}
