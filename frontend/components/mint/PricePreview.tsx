"use client";

import { useCurrentPrice, useTokensOut } from "@/hooks/useMintingCurve";
import { formatUnits, parseEther } from "viem";

type Props = {
  ethAmount: string;
};

export function PricePreview({ ethAmount }: Props) {
  const { data: currentPrice } = useCurrentPrice();

  const ethWei = (() => {
    if (!ethAmount || Number(ethAmount) <= 0) return 0n;
    try {
      return parseEther(ethAmount);
    } catch {
      return 0n;
    }
  })();

  // Live tokens-out quote — mirrors the contract's integral exactly. Source of truth
  // for the displayed "You receive" amount and the slippage-protected minTokens
  // submitted with mint().
  const { data: tokensOutWei } = useTokensOut(ethWei);
  const estimatedTokens =
    tokensOutWei !== undefined && tokensOutWei > 0n
      ? Number(formatUnits(tokensOutWei, 18))
      : null;

  const priceDisplay = currentPrice
    ? Number(formatUnits(currentPrice, 18)).toFixed(8)
    : "—";

  return (
    <div className="card-raised p-2.5 sm:p-3 space-y-1.5 sm:space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-[14px] sm:text-[15px] text-gray-300 tracking-[1px] sm:tracking-[2px] uppercase font-mono">
          Price per $RITUAL
        </span>
        <span className="text-sm sm:text-base text-gray-200 font-mono">
          {priceDisplay} ETH
        </span>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-[14px] sm:text-[15px] text-gray-300 tracking-[1px] sm:tracking-[2px] uppercase font-mono">
          You receive ~
        </span>
        <span className="text-xs sm:text-sm font-mono text-ritual-light">
          {estimatedTokens !== null
            ? estimatedTokens.toLocaleString(undefined, { maximumFractionDigits: 2 }) + " $RITUAL"
            : "—"}
        </span>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-[14px] sm:text-[15px] text-gray-300 tracking-[1px] sm:tracking-[2px] uppercase font-mono">
          Protocol fee
        </span>
        <span className="text-sm sm:text-base text-gray-200 font-mono">12%</span>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-[14px] sm:text-[15px] text-gray-300 tracking-[1px] sm:tracking-[2px] uppercase font-mono">
          Max slippage
        </span>
        <span className="text-sm sm:text-base text-gray-200 font-mono">1%</span>
      </div>
    </div>
  );
}
