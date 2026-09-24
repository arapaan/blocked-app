import AppHeader from "../components/AppHeader";
import SettingsForm from "../components/SettingsForm";

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-[#f7f8f5] font-sans">
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 sm:py-12">
        <div className="mb-8 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">Pengaturan</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-zinc-950 sm:text-4xl">Buat aturan yang terasa pas.</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">Atur target olahraga, situs yang ingin dibatasi, dan jam fokusmu. Daftar situs dan jadwal disimpan oleh ekstensi Site Blocker.</p>
        </div>
        <SettingsForm />
      </main>
    </div>
  );
}
