import Link from "next/link";
import {
  Activity,
  BellRing,
  BarChart3,
  Globe,
  Layers,
  Lock,
  Radio,
  Webhook,
} from "lucide-react";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import UptimeBar from "@/components/ui/UptimeBar";

export const metadata = {
  title: "PulseWatch — Uptime & Status Monitoring",
};

// static demo buckets for the hero mock
const heroBuckets = Array.from({ length: 90 }, (_, i) => {
  const r = (Math.sin(i * 12.9898) * 43758.5453) % 1;
  const failure = Math.abs(r) > 0.96;
  return {
    t: Date.now() - (90 - i) * 86400_000,
    total: 24,
    failures: failure ? 1 : 0,
    uptime: failure ? 95.8 : 100,
  };
});

const features = [
  {
    icon: Radio,
    title: "HTTP & TCP checks",
    desc: "Ping websites, REST APIs, database ports and anything with an address — on your schedule, from 30s to 1h intervals.",
  },
  {
    icon: BarChart3,
    title: "Uptime & latency history",
    desc: "90-day uptime bars, response-time charts and SLA rollups computed from every raw check.",
  },
  {
    icon: BellRing,
    title: "Incident timeline",
    desc: "Downtime is detected, deduplicated and tracked as incidents with investigate → resolve workflow.",
  },
  {
    icon: Webhook,
    title: "Signed webhooks",
    desc: "HMAC-SHA256 signed MONITOR_DOWN / MONITOR_UP events delivered to any HTTPS endpoint you own.",
  },
  {
    icon: Globe,
    title: "Public status pages",
    desc: "Share a branded /status/your-team page with live availability — no login required.",
  },
  {
    icon: Lock,
    title: "JWT auth & API keys",
    desc: "HttpOnly-cookie sessions plus hashed API keys with rate-limited REST access for automation.",
  },
];

const steps = [
  {
    n: "01",
    title: "Add a monitor",
    desc: "Point PulseWatch at any http(s) or tcp endpoint. Pick an interval, timeout and expected status.",
  },
  {
    n: "02",
    title: "We check around the clock",
    desc: "A background scheduler runs due checks, records latency and flags failures with retries.",
  },
  {
    n: "03",
    title: "Get told before users",
    desc: "Downtime opens an incident and fires your webhooks. Recovery resolves it automatically.",
  },
];

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-[-320px] h-[560px] w-[860px] -translate-x-1/2 rounded-full bg-cyan-glow/10 blur-[120px]"
          />
          <div className="mx-auto max-w-6xl px-6 pb-20 pt-20 text-center md:pt-28">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-glow/30 bg-cyan-glow/10 px-4 py-1.5 text-xs font-medium text-cyan-glow">
              <span className="relative flex h-2 w-2">
                <span className="absolute h-full w-full animate-pulse-ring rounded-full bg-cyan-glow opacity-60" />
                <span className="relative h-2 w-2 rounded-full bg-cyan-glow" />
              </span>
              Open-source uptime monitoring
            </span>
            <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold leading-tight tracking-tight text-white md:text-6xl">
              Know before your users do.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-400">
              PulseWatch watches your websites, APIs and infrastructure 24/7 — with uptime
              history, incident tracking, public status pages and webhooks.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/register" className="btn-primary w-full sm:w-auto">
                Start monitoring — free
              </Link>
              <Link href="/login" className="btn-ghost w-full sm:w-auto">
                View live demo →
              </Link>
            </div>
            <p className="mt-4 font-mono text-xs text-slate-500">
              demo account: demo@pulsewatch.dev · demo1234
            </p>

            {/* hero mock */}
            <div className="card mx-auto mt-14 max-w-3xl p-6 text-left shadow-glow-cyan">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-glow/15">
                    <Activity className="h-4 w-4 text-cyan-glow" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">pulsewatch.dev</p>
                    <p className="text-xs text-up">Operational · 99.98% uptime</p>
                  </div>
                </div>
                <p className="font-mono text-xs text-slate-500">142 ms avg</p>
              </div>
              <UptimeBar buckets={heroBuckets} className="mt-4" />
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-t border-white/5 py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-glow">
                Features
              </p>
              <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">
                Everything uptime, nothing bloat
              </h2>
            </div>
            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <div key={f.title} className="card p-6 transition-colors hover:border-cyan-glow/30">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-glow/10 ring-1 ring-cyan-glow/25">
                    <f.icon className="h-5 w-5 text-cyan-glow" />
                  </span>
                  <h3 className="mt-4 font-semibold text-white">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-t border-white/5 bg-night-800/40 py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-glow">
                How it works
              </p>
              <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">
                Three steps to peace of mind
              </h2>
            </div>
            <div className="mt-14 grid gap-5 md:grid-cols-3">
              {steps.map((s) => (
                <div key={s.n} className="card relative p-6">
                  <span className="font-mono text-4xl font-bold text-cyan-glow/25">{s.n}</span>
                  <h3 className="mt-3 font-semibold text-white">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Stack strip */}
        <section className="border-t border-white/5 py-16">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <p className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 font-mono text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" /> Next.js 14 App Router
              </span>
              <span>TypeScript strict</span>
              <span>Prisma ORM</span>
              <span>PostgreSQL / SQLite</span>
              <span>Redis cache</span>
              <span>Vitest</span>
              <span>Docker</span>
              <span>GitHub Actions</span>
            </p>
          </div>
        </section>

        {/* CTA */}
        <section id="demo" className="pb-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="card relative overflow-hidden p-10 text-center md:p-14">
              <div
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-0 h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-cyan-glow/10 blur-[100px]"
              />
              <h2 className="text-3xl font-bold text-white md:text-4xl">
                Your users shouldn&apos;t be your monitors.
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-slate-400">
                Spin up PulseWatch and get your first uptime bar in under a minute.
              </p>
              <Link href="/register" className="btn-primary mt-8">
                Create free account
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
