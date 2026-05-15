"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { parseEther } from "viem";
import { useMintRitual, useTokensOut } from "@/hooks/useMintingCurve";
import { useRitualBalance } from "@/hooks/useRitualToken";
import { PricePreview } from "./PricePreview";

const QUICK_AMOUNTS = ["0.001", "0.01", "0.1"] as const;

export function MintInterface() {
  const { isConnected } = useAccount();
  const [ethAmount, setEthAmount] = useState("0.01");
  const [showSuccess, setShowSuccess] = useState(false);
  const { mint, isPending, isConfirming, isSuccess } = useMintRitual();
  const { display: balanceDisplay, refetch } = useRitualBalance();

  // Live quote for slippage protection. parseEther can throw on bad input — guard it.
  const ethWei = (() => {
    if (!ethAmount || Number(ethAmount) <= 0) return 0n;
    try {
      return parseEther(ethAmount);
    } catch {
      return 0n;
    }
  })();
  const { data: expectedTokens } = useTokensOut(ethWei);

  const handleMint = () => {
    if (!ethAmount || Number(ethAmount) <= 0) return;
    // expectedTokens may be undefined if the quote hasn't loaded yet; refuse to submit
    // without a quote so we don't fall back to minTokens=0 (no slippage protection).
    if (expectedTokens === undefined || expectedTokens === 0n) return;
    mint(ethAmount, expectedTokens);
  };

  // Refetch balance on success and auto-reset after 4s
  useEffect(() => {
    if (isSuccess) {
      refetch();
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, refetch]);

  const buttonLabel = () => {
    if (isPending) return "Confirm in wallet...";
    if (isConfirming) return "Channeling...";
    if (showSuccess) return "Ritual Complete ✓";
    return "Invoke the Ritual";
  };

  const isDisabled =
    isPending ||
    isConfirming ||
    !ethAmount ||
    Number(ethAmount) <= 0 ||
    expectedTokens === undefined ||
    expectedTokens === 0n;

  return (
    <div className="card space-y-4 sm:space-y-5">
      <div className="section-label">Acquire $RITUAL</div>

      {isConnected ? (
        <>
          {/* Balance */}
          <div className="flex items-center justify-between">
            <span className="text-[14px] text-gray-300 tracking-[2px] uppercase font-mono font-bold">
              Your balance
            </span>
            <span className="text-sm text-ritual-light font-mono">
              {balanceDisplay} $RITUAL
            </span>
          </div>

          {/* ETH Amount Input */}
          <div className="space-y-2">
            <label className="text-[14px] text-gray-300 tracking-[2px] uppercase font-mono font-bold">
              ETH to spend
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                inputMode="decimal"
                value={ethAmount}
                onChange={(e) => setEthAmount(e.target.value)}
                min="0"
                step="0.001"
                placeholder="0.01"
                className="flex-1 bg-void-raised border border-void-border rounded-lg px-3 py-2.5 sm:py-2
                           text-base sm:text-sm font-mono text-gray-200 outline-none
                           focus:border-ritual/50 transition-colors"
              />
              <span className="text-sm text-gray-500 font-mono">ETH</span>
            </div>

            {/* Quick-select buttons */}
            <div className="flex gap-2">
              {QUICK_AMOUNTS.map((amount) => (
                <button
                  key={amount}
                  onClick={() => setEthAmount(amount)}
                  className={`btn-quick ${
                    ethAmount === amount ? "btn-quick-active" : "btn-quick-inactive"
                  }`}
                >
                  {amount} ETH
                </button>
              ))}
            </div>
          </div>

          {/* Price Preview */}
          <PricePreview ethAmount={ethAmount} />

          {/* Success message */}
          {showSuccess && (
            <div
              className="text-center text-sm text-ritual-light font-serif animate-fade-in py-2 rounded-lg"
              style={{
                background: "linear-gradient(135deg, #4c1d9522, #7c3aed22)",
                border: "1px solid #7c3aed33",
                boxShadow: "0 0 30px #7c3aed22",
              }}
            >
              The ritual is complete. $RITUAL flows to your wallet.
            </div>
          )}

          {/* Mint Button */}
          <button
            className="btn-sacrifice"
            onClick={handleMint}
            disabled={isDisabled}
            style={showSuccess ? {
              background: "linear-gradient(135deg, #065f46, #059669)",
              boxShadow: "0 0 20px #05966944",
            } : undefined}
          >
            {buttonLabel()}
          </button>
        </>
      ) : (
        <div className="text-center py-8 text-gray-500 italic text-sm">
          Connect your wallet to begin the ritual.
        </div>
      )}
    </div>
  );
}
