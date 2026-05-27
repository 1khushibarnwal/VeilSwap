import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/footer/Footer";
import RecentIntents from "@/components/intents/RecentIntents";

export default function IntentsPage() {
  return (
    <main className="min-h-screen pb-10">
      <Navbar />

      <section className="max-w-7xl mx-auto px-6 pt-20">
        <h1 className="text-5xl font-black">
          Explore Intents
        </h1>

        <p className="mt-4 text-white/70 text-lg">
          Browse all live on-chain intents across VeilSwap.
        </p>

        <div className="mt-10">
          <RecentIntents />
        </div>
      </section>

      <Footer />
    </main>
  );
}