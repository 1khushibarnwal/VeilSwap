"use client";

import Image from "next/image";
import ConnectWallet from "@/components/ConnectWallet";
import { motion } from "framer-motion";
import { IconSun } from "@tabler/icons-react";
import Link from "next/link";

const navItems = [
  {
    name: "Dashboard",
    href: "/",
  },
  {
    name: "Intents",
    href: "/intents",
  },
  {
    name: "Portfolio",
    href: "/portfolio",
  },
  {
    name: "Docs",
    href: "/docs",
  },
  {
    name: "About",
    href: "/about",
  },
];

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 px-6 pt-6">
      <nav className="glass rounded-3xl max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Left */}
        <motion.div
          whileHover={{
            scale: 1.03,
          }}
          className="flex items-center gap-3 cursor-pointer"
        >
          <Image
            src="/veilswap.png"
            alt="VeilSwap"
            width={48}
            height={48}
            loading="eager"
            className="drop-shadow-[0_0_18px_rgba(0,255,255,0.65)]"
          />

          <div>
            <h1 className="text-2xl font-bold">
              VeilSwap
            </h1>
          </div>
        </motion.div>

        {/* Center */}
        <div className="hidden md:flex items-center gap-3">
          {navItems.map((item, index) => (
            <Link
              key={index}
              href={item.href}
              className={`px-5 py-2 rounded-2xl transition-all cursor-pointer ${
                index === 0
                  ? "glass glow-cyan"
                  : "hover:bg-white/5"
              }`}
            >
              {item.name}
            </Link>
          ))}
        </div>

        {/* Right */}
        <div className="flex items-center gap-4">
          <ConnectWallet />

          <button className="glass p-3 rounded-2xl hover:scale-105 transition-all">
            <IconSun size={18} />
          </button>
        </div>
      </nav>
    </header>
  );
}