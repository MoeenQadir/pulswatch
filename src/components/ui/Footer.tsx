import Link from "next/link";
import Logo from "./Logo";

export default function Footer() {
  return (
    <footer className="border-t border-white/5 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 md:flex-row">
        <div>
          <Logo />
          <p className="mt-2 text-xs text-slate-500">
            Uptime monitoring built with Next.js, Prisma &amp; TypeScript.
          </p>
        </div>
        <nav className="flex items-center gap-6 text-sm text-slate-400">
          <Link href="/login" className="hover:text-white">
            Sign in
          </Link>
          <Link href="/register" className="hover:text-white">
            Register
          </Link>
          <a
            href="https://github.com/MoeenQadir"
            target="_blank"
            rel="noreferrer"
            className="hover:text-white"
          >
            GitHub
          </a>
        </nav>
      </div>
    </footer>
  );
}
