import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // As capas ficam no bucket público do Supabase. Sem esta autorização o
    // next/image recusa o domínio em tempo de execução — o build passa e a
    // imagem quebra só em produção, que é o pior lugar para descobrir.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
