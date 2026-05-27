"use client";

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/footer/Footer";

import WalletOverview from "@/components/portfolio/WalletOverview";
import PortfolioStats from "@/components/portfolio/PortfolioStats";
import PortfolioActivity from "@/components/portfolio/PortfolioActivity";

export default function PortfolioPage() {
  return (
    <main className="min-h-screen pb-10">
      <Navbar />

      <section className="max-w-7xl mx-auto px-6 pt-16">
        <div className="mb-10">
          <h1 className="text-5xl font-black">
            Portfolio
          </h1>

          <p className="text-white/60 mt-3 text-lg">
            Track your wallet, intents,
            activity, and execution history.
          </p>
        </div>

        <div className="space-y-6">
          <WalletOverview />

          <PortfolioStats />

          <PortfolioActivity />
        </div>
      </section>

      <Footer />
    </main>
  );
}