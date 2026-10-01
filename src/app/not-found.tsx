import Link from "next/link";
import { Activity } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="card p-10 max-w-md w-full">
        <Activity className="mx-auto h-10 w-10 text-cyan-glow" />
        <h1 className="mt-6 font-mono text-5xl font-bold text-white">404</h1>
        <p className="mt-3 text-slate-400">
          This page didn&apos;t respond. Even we couldn&apos;t monitor it into existence.
        </p>
        <Link href="/" className="btn-primary mt-8 w-full">
          Back to homepage
        </Link>
      </div>
    </main>
  );
}
