import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";
import { nuvionClient } from "@umohpyro/better-auth-nuvion/client";

export const authClient = createAuthClient({
  plugins: [organizationClient(), nuvionClient()],
});
