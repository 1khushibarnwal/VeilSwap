"use client";

import { motion } from "framer-motion";
import { useAccount, useBalance } from "wagmi";

export default function WalletOverview() {
  const { address, chain } = useAccount();

  const { data } = useBalance({
    address,
  });

  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 20,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      className="
        rounded-3xl
        border border-cyan-500/20
        bg-white/5
        backdrop-blur-xl
        p-8
      "
    >
      <h2 className="text-3xl font-bold mb-6">
        Wallet Overview
      </h2>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="glass rounded-2xl p-5">
          <p className="text-white/50 text-sm">
            Wallet Address
          </p>

          <p className="mt-2 font-mono text-sm break-all">
            {address || "Not Connected"}
          </p>
        </div>

        <div className="glass rounded-2xl p-5">
          <p className="text-white/50 text-sm">
            Network
          </p>

          <p className="mt-2 text-xl font-bold">
            {chain?.name || "Unknown"}
          </p>
        </div>

        <div className="glass rounded-2xl p-5">
          <p className="text-white/50 text-sm">
            ETH Balance
          </p>

          <p className="mt-2 text-xl font-bold">
            {data
              ? `${Number(data.formatted).toFixed(4)} ${data.symbol}`
              : "0 ETH"}
          </p>
        </div>
      </div>
    </motion.div>
  );
}