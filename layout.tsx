"use client";
import "./globals.css";
import "@rainbow-me/rainbowkit/styles.css";
import { useState } from "react";
import { WagmiProvider }          from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme }    from "@rainbow-me/rainbowkit";
import { Toaster }                          from "react-hot-toast";
import { wagmiConfig }                      from "@/lib/wagmi";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <html lang="en">
      <head>
        <title>VeilSwap — Private Intent Trading</title>
        <meta name="description" content="Commit-reveal, TWAP-gated limit orders with MEV protection on Arbitrum." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <WagmiProvider config={wagmiConfig}>
          <QueryClientProvider client={queryClient}>
            <RainbowKitProvider
              theme={darkTheme({
                accentColor:       "#c8923a",
                accentColorForeground: "#0c0e12",
                borderRadius:      "medium",
                overlayBlur:       "small",
              })}
            >
              {children}
              <Toaster
                position="bottom-right"
                toastOptions={{
                  style: {
                    background:   "#1a1e26",
                    color:        "#f0ece4",
                    border:       "1px solid rgba(200,194,188,0.1)",
                    borderRadius: "10px",
                    fontFamily:   "'DM Sans', sans-serif",
                    fontSize:     "13px",
                  },
                  success: { iconTheme: { primary: "#3a9e7a", secondary: "#1a1e26" } },
                  error:   { iconTheme: { primary: "#c45252", secondary: "#1a1e26" } },
                }}
              />
            </RainbowKitProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </body>
    </html>
  );
}
