import { createAuthClient } from "better-auth/react";
import { env } from "@/env";
import { adminClient, organizationClient } from "better-auth/client/plugins";

/** Secrets managers sometimes add quotes or trailing newlines. */
const normalizeBaseURL = (value: string | undefined) => {
  const trimmed = value?.trim().replace(/^["']|["']$/g, "");
  return trimmed || undefined;
};

export const authClient = createAuthClient({
  baseURL: normalizeBaseURL(env.NEXT_PUBLIC_BETTER_AUTH_URL),
  plugins: [adminClient(), organizationClient()],
});

export const { signIn, signOut, useSession } = authClient;
