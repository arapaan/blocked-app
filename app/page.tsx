import UploadFileDialog from "./components/UploadFileDialog";
import AppHeader from "./components/AppHeader";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f7f8f5] font-sans">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <UploadFileDialog />
        <footer className="mt-10 flex flex-wrap justify-between gap-2 border-t border-zinc-200 pt-5 text-xs text-zinc-500">
          <span>Ruang Fokus · disiplin kecil, setiap hari.</span>
          <span>Zona waktu perangkat: lokal</span>
        </footer>
      </main>
    </div>
  );
}
