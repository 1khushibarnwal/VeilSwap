"use client";

import { useState } from "react";

import { motion } from "framer-motion";

import { toast } from "sonner";

import {
  encodePacked,
  keccak256,
} from "viem";

import { useAccount } from "wagmi";

import { useCreateIntent } from "@/hooks/useCreateIntent";

export default function CreateIntentPanel() {
  const { address } = useAccount();

  const {
    createIntent,
    isPending,
  } = useCreateIntent();

  const [expiry, setExpiry] =
    useState("24");

  async function handleCreateIntent() {
    try {
      if (!address) {
        toast.error(
          "Connect wallet first"
        );

        return;
      }

      // -----------------------------
      // DEMO VALUES
      // -----------------------------

      const tokenIn =
        "0x980b62da83ef3d4576c64799355829fbfcdba2bc";

      const tokenOut =
        "0x75faf114eafb1bdbe2f0316df893fd58ce46aa4d";

      const amountIn =
        BigInt(1000);

      const targetPrice =
        BigInt(2000);

      const minAmountOut =
        BigInt(1800);

      const greaterThan = true;

      // random secret
      const secret =
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

      const expiryTimestamp =
        BigInt(
          Math.floor(Date.now() / 1000) +
            Number(expiry) *
              60 *
              60
        );

      // -----------------------------
      // CREATE HASH
      // -----------------------------

      const commitmentHash =
        keccak256(
          encodePacked(
            [
              "address",
              "address",
              "address",
              "uint256",
              "uint256",
              "uint256",
              "bool",
              "uint256",
              "bytes32",
            ],
            [
              address,
              tokenIn,
              tokenOut,
              amountIn,
              targetPrice,
              minAmountOut,
              greaterThan,
              expiryTimestamp,
              secret,
            ]
          )
        );

      console.log({
        commitmentHash,
      });

      // -----------------------------
      // SEND TX
      // -----------------------------

      await createIntent(
        commitmentHash,
        expiryTimestamp
      );

      // SAVE DATA FOR REVEAL
      localStorage.setItem(
        "latestIntent",
        JSON.stringify({
          tokenIn,
          tokenOut,
          amountIn:
            amountIn.toString(),
          targetPrice:
            targetPrice.toString(),
          minAmountOut:
            minAmountOut.toString(),
          greaterThan,
          expiryTimestamp:
            expiryTimestamp.toString(),
          secret,
        })
      );

      toast.success(
        "Intent created"
      );
    } catch (err) {
      console.error(err);

      toast.error(
        "Failed to create intent"
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
        border border-cyan-500/20
        bg-white/5
        backdrop-blur-xl
        p-8
      "
    >
      <div className="mb-6">
        <h2 className="text-2xl font-bold">
          Create Intent
        </h2>
      </div>

      <div className="space-y-5">
        <div>
          <label className="text-sm text-gray-400">
            Expiry (hours)
          </label>

          <input
            value={expiry}
            onChange={(e) =>
              setExpiry(
                e.target.value
              )
            }
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
          onClick={
            handleCreateIntent
          }
          disabled={isPending}
          className="
            w-full
            rounded-xl
            bg-cyan-400
            text-black
            font-semibold
            py-3
          "
        >
          {isPending
            ? "Submitting..."
            : "Submit Intent"}
        </button>
      </div>
    </motion.div>
  );
}