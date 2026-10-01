import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import ApiKeysManager from "@/components/settings/ApiKeysManager";
import WebhookForm from "@/components/settings/WebhookForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    include: {
      apiKeys: { where: { revokedAt: null }, orderBy: { createdAt: "desc" } },
      webhooks: { where: { active: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="mt-1 text-sm text-slate-400">
          Manage API access and webhook notifications.
        </p>
      </div>

      <ApiKeysManager initialKeys={user.apiKeys} />
      <WebhookForm initialWebhooks={user.webhooks} />

      <div className="card p-6">
        <h2 className="font-semibold text-white">Your status page</h2>
        <p className="mt-1 text-sm text-slate-400">
          Share your public status page — no login required.
        </p>
        <code className="mt-3 block rounded-lg border border-white/10 bg-night-700 px-4 py-3 font-mono text-sm text-cyan-glow">
          {process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/status/{user.id}
        </code>
      </div>
    </div>
  );
}
