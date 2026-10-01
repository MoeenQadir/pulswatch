import Link from "next/link";
import Logo from "@/components/ui/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <Logo />
      <div className="mt-8 w-full max-w-md">{children}</div>
      <p className="mt-8 text-xs text-slate-500">
        <Link href="/" className="hover:text-slate-300">
          ← Back to homepage
        </Link>
      </p>
    </main>
  );
}
