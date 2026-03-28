"use client";

import { useCurrentPrice } from "@/hooks/useMintingCurve";
import { formatUnits, parseEther } from "viem";

type Props = {
  ethAmount: string;
};

export function PricePreview({ ethAmount }: Props) {
  const { data: currentPrice } = useCurrentPrice();

  const estimatedTokens = (() => {
    if (!currentPrice || !ethAmount || Number(ethAmount) <= 0) return null;
    try {
      const ethWei = parseEther(ethAmount);
      const netEth = (ethWei * 8800n) / 10000n; // deduct 12% fee
      const tokens = (netEth * BigInt(1e18)) / currentPrice;
      return Number(formatUnits(tokens, 18));
    } catch {
      return null;
    }
  })();

  const priceDisplay = currentPrice
    ? Number(formatUnits(currentPrice, 18)).toFixed(8)
    : "—";

  return (
    <div className="card-raised p-2.5 sm:p-3 space-y-1.5 sm:space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-[10px] sm:text-[11px] text-gray-500 tracking-[1px] sm:tracking-[2px] uppercase font-mono">
          Price per $RITUAL
        </span>
        <span className="text-xs sm:text-sm text-gray-300 font-mono">
          {priceDisplay} ETH
        </span>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-[10px] sm:text-[11px] text-gray-500 tracking-[1px] sm:tracking-[2px] uppercase font-mono">
          You receive ~
        </span>
        <span className="text-xs sm:text-sm font-mono text-ritual-light">
          {estimatedTokens !== null
            ? estimatedTokens.toLocaleString(undefined, { maximumFractionDigits: 2 }) + " $RITUAL"
            : "—"}
        </span>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-[10px] sm:text-[11px] text-gray-500 tracking-[1px] sm:tracking-[2px] uppercase font-mono">
          Protocol fee
        </span>
        <span className="text-xs sm:text-sm text-gray-500 font-mono">12%</span>
      </div>
    </div>
  );
}
