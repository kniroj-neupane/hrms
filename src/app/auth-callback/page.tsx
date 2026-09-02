import { auth } from "@/server/auth";
import { AuthCallbackClient } from "./client";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AuthCallbackPage() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      redirect("/sign-in");
    }

    return <AuthCallbackClient session={session} />;
  } catch (error) {
    console.error("Failed to get session in auth callback:", error);
    redirect("/sign-in");
  }
}
