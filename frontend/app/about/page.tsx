"use client";

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/footer/Footer";

export default function AboutPage() {
  return (
    <main className="min-h-screen pb-10">
      <Navbar />

      <section className="max-w-6xl mx-auto px-6 pt-16">
        {/* Hero */}
        <div className="text-center mb-20">
          <h1 className="text-6xl md:text-7xl font-black">
            About VeilSwap
          </h1>

          <p className="mt-6 text-xl text-white/60 max-w-3xl mx-auto leading-relaxed">
            VeilSwap is an intent-based trading
            protocol designed to bring private,
            intelligent, and solver-powered
            execution to decentralized finance.
          </p>
        </div>

        {/* Vision */}
        <div className="glass rounded-3xl p-10 mb-10">
          <h2 className="text-4xl font-bold mb-6">
            Our Vision
          </h2>

          <p className="text-white/70 leading-relaxed text-lg">
            Modern DeFi still exposes users to
            front-running, poor execution, and
            fragmented liquidity.
            <br />
            <br />
            VeilSwap introduces hidden
            on-chain intents through a
            commit-reveal architecture,
            allowing users to express what
            they want while solvers compete
            to fulfill it efficiently.
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 mb-10">
          <div className="glass rounded-3xl p-8">
            <h3 className="text-2xl font-bold mb-4">
              Hidden Intents
            </h3>

            <p className="text-white/60 leading-relaxed">
              Trade intentions remain hidden
              until revealed, reducing
              front-running and MEV exposure.
            </p>
          </div>

          <div className="glass rounded-3xl p-8">
            <h3 className="text-2xl font-bold mb-4">
              Solver Network
            </h3>

            <p className="text-white/60 leading-relaxed">
              Solvers compete to execute user
              intents under optimal market
              conditions.
            </p>
          </div>

          <div className="glass rounded-3xl p-8">
            <h3 className="text-2xl font-bold mb-4">
              Smart Execution
            </h3>

            <p className="text-white/60 leading-relaxed">
              Automated execution logic ensures
              trades happen only when user-defined
              conditions are satisfied.
            </p>
          </div>
        </div>

        {/* Architecture */}
        <div className="glass rounded-3xl p-10 mb-10">
          <h2 className="text-4xl font-bold mb-6">
            Protocol Architecture
          </h2>

          <div className="space-y-4 text-white/70 leading-relaxed">
            <p>
              • Users create hashed trade intents.
            </p>

            <p>
              • Intent details stay hidden during
              the commit phase.
            </p>

            <p>
              • Revealed intents become executable
              by solvers.
            </p>

            <p>
              • Smart contracts enforce execution
              conditions on-chain.
            </p>
          </div>
        </div>

        {/* Future */}
        <div className="glass rounded-3xl p-10">
          <h2 className="text-4xl font-bold mb-6">
            The Future
          </h2>

          <p className="text-white/70 leading-relaxed text-lg">
            VeilSwap aims to evolve into a
            full intent settlement layer with:
          </p>

          <div className="mt-6 grid md:grid-cols-2 gap-4">
            <div className="glass rounded-2xl p-5">
              Cross-chain intents
            </div>

            <div className="glass rounded-2xl p-5">
              AI-assisted routing
            </div>

            <div className="glass rounded-2xl p-5">
              Solver reputation systems
            </div>

            <div className="glass rounded-2xl p-5">
              Intent aggregation
            </div>

            <div className="glass rounded-2xl p-5">
              MEV-resistant execution
            </div>

            <div className="glass rounded-2xl p-5">
              Real-time execution markets
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}