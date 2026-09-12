/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // standalone：产物自包含 node_modules/static，可直接 `node server.js`
  // 或打入 Docker 镜像，适配 Railway / Render / Fly.io / Zeabur 等任意 Node 平台
  output: "standalone",
};

export default nextConfig;