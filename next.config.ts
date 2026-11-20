// The old vercel.app address sends pages to the real subdomain (permanent redirect). /api is left alone so webhooks that
// were registered against the old address keep working: Nuvion does not follow redirects on a delivery.
const config = {
  async redirects() {
    return [
      {
        source: "/",
        has: [
          {
            type: "host" as const,
            value: "better-auth-nuvion-example.vercel.app",
          },
        ],
        destination: "https://better-auth-nuvion-example.umoh.name.ng",
        permanent: true,
      },
      {
        source: "/:path((?!api/).+)",
        has: [
          {
            type: "host" as const,
            value: "better-auth-nuvion-example.vercel.app",
          },
        ],
        destination: "https://better-auth-nuvion-example.umoh.name.ng/:path*",
        permanent: true,
      },
    ];
  },
};

export default config;
