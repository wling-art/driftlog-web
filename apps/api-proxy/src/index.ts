interface Env {
  API: { fetch(request: Request): Promise<Response> }
}

// 把请求转给 Cloudflare Tunnel 后面的 API，并带上访客 IP
export default {
  fetch(request: Request, env: Env) {
    const headers = new Headers(request.headers)
    const ip = request.headers.get("cf-connecting-ip")
    if (ip) headers.set("x-forwarded-for", ip)
    const url = new URL(request.url)
    url.protocol = "http:"
    return env.API.fetch(new Request(url, new Request(request, { headers })))
  },
}
