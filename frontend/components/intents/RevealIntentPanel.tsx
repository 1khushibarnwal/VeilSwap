"use client";

import { useState } from "react";

import { motion } from "framer-motion";

import { toast } from "sonner";

import { useRevealIntent } from "@/hooks/useRevealIntent";

export default function RevealIntentPanel() {
  const {
    revealIntent,
    isPending,
  } = useRevealIntent();

  const [intentId, setIntentId] =
    useState("");

  async function handleReveal() {
    try {
      const saved =
        localStorage.getItem(
          "latestIntent"
        );

      if (!saved) {
        toast.error(
          "No saved intent found"
        );

        return;
      }

      const data =
        JSON.parse(saved);

      await revealIntent(
        BigInt(intentId),

        data.tokenIn,

        data.tokenOut,

        BigInt(data.amountIn),

        BigInt(data.targetPrice),

        BigInt(data.minAmountOut),

        data.greaterThan,

        data.secret
      );

      toast.success(
        "Intent revealed"
      );
    } catch (err) {
      console.error(err);

      toast.error(
        "Reveal failed"
      );
    }
  }

  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 40,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      className="
        rounded-3xl
        border border-purple-500/20
        bg-white/5
        backdrop-blur-xl
        p-8
      "
    >
      <div className="mb-6">
        <h2 className="text-2xl font-bold">
          Reveal Intent
        </h2>
      </div>

      <div className="space-y-5">
        <div>
          <label className="text-sm text-gray-400">
            Intent ID
          </label>

          <input
            value={intentId}
            onChange={(e) =>
              setIntentId(
                e.target.value
              )
            }
            placeholder="0"
            className="
              mt-2
              w-full
              rounded-xl
              bg-black/30
              border border-white/10
              px-4 py-3
            "
          />
        </div>

        <button
          onClick={handleReveal}
          disabled={isPending}
          className="
            w-full
            rounded-xl
            bg-gradient-to-r
            from-purple-400
            to-cyan-400
            text-black
            font-semibold
            py-3
          "
        >
          {isPending
            ? "Revealing..."
            : "Reveal Intent"}
        </button>
      </div>
    </motion.div>
  );
}