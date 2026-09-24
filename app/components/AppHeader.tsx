import Link from "next/link";

export default function AppHeader() {
  return (
    <header className="flex w-full items-center justify-between border-b border-zinc-200/70 px-6 py-5 sm:px-10">
      <Link href="/" className="flex items-center gap-3" aria-label="Ruang Fokus beranda">
        <span className="grid size-10 place-items-center rounded-2xl bg-emerald-950 text-sm font-bold text-emerald-50">
          RF
        </span>
        <span>
          <span className="block text-sm font-semibold tracking-tight text-zinc-900">ruang fokus</span>
          <span className="block text-xs text-zinc-500">gerak dulu, lanjut nanti</span>
        </span>
      </Link>
      <nav className="flex items-center gap-1 rounded-full border border-zinc-200 bg-white p-1 text-sm shadow-sm">
        <Link href="/" className="rounded-full px-4 py-2 text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950">
          Hari ini
        </Link>
        <Link href="/settings" className="rounded-full px-4 py-2 text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950">
          Pengaturan
        </Link>
      </nav>
    </header>
  );
}
