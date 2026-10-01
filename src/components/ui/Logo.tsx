import Link from "next/link";
import { Activity } from "lucide-react";

export default function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2">
      <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-glow/15 ring-1 ring-cyan-glow/40">
        <Activity className="h-4.5 w-4.5 h-4 w-4 text-cyan-glow" />
      </span>
      <span className="text-lg font-bold tracking-tight text-white">
        Pulse<span className="text-cyan-glow">Watch</span>
      </span>
    </Link>
  );
}
