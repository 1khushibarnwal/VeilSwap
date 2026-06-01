"use client";

import { ReactNode } from "react";

import { WagmiProvider } from "wagmi";

import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

import {
  createAppKit,
} from "@reown/appkit/react";

import {
  arbitrumSepolia,
} from "wagmi/chains";

import {
  config,
  projectId,
  wagmiAdapter,
} from "@/lib/wagmi";

const queryClient = new QueryClient();


export default function Web3Provider({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}