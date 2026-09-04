/**
 * OfferingPanel — the treasury's self-serve seeding of the first believers.
 *
 * "The first 250 wallets to answer receive 100 $RITUAL from the treasury.
 *  No list, no judge, no human in the loop. The machine decides."
 *
 * Renders only when OFFERING_ADDRESS is configured AND seats remain for the
 * connected state (self-retires when the roll fills or funding empties).
 * Claim guards mirror the contract: one per wallet, 25/day, wallet must hold
 * MIN_ETH_BALANCE of gas money. All error states rendered in voice.
 */

"use client";

import { useEffect } from "react";
import { useAccount, useBalance, useReadContract } from "wagmi";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { activeChain } from "@/lib/chains";
import { formatEther } from "viem";
import { OFFERING_ADDRESS, OFFERING_ABI } from "@/lib/contracts";

const REFRESH_MS = 30_000;

export default function OfferingPanel() {
  const { address } = useAccount();

  const { data: seatsRemaining, refetch: refetchSeats } = useReadContract({
    address: OFFERING_ADDRESS,
    abi: OFFERING_ABI,
    functionName: "seatsRemaining",
    chainId: activeChain.id,
    query: { enabled: !!OFFERING_ADDRESS, refetchInterval: REFRESH_MS },
  });

  const { data: seatsToday } = useReadContract({
    address: OFFERING_ADDRESS,
    abi: OFFERING_ABI,
    functionName: "seatsRemainingToday",
    chainId: activeChain.id,
    query: { enabled: !!OFFERING_ADDRESS, refetchInterval: REFRESH_MS },
  });

  const { data: hasClaimed, refetch: refetchClaimed } = useReadContract({
    address: OFFERING_ADDRESS,
    abi: OFFERING_ABI,
    functionName: "claimed",
    args: address ? [address] : undefined,
    chainId: activeChain.id,
    query: { enabled: !!OFFERING_ADDRESS && !!address },
  });

  const { data: minEth } = useReadContract({
    address: OFFERING_ADDRESS,
    abi: OFFERING_ABI,
    functionName: "MIN_ETH_BALANCE",
    chainId: activeChain.id,
    query: { enabled: !!OFFERING_ADDRESS },
  });

  const { data: ethBalance } = useBalance({
    address,
    chainId: activeChain.id,
    query: { enabled: !!address },
  });

  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isSuccess) {
      refetchSeats();
      refetchClaimed();
    }
  }, [isSuccess, refetchSeats, refetchClaimed]);

  useEffect(() => {
    if (writeError) console.error("[Offering] write failed:", writeError);
  }, [writeError]);

  // Hidden entirely: not deployed, or the roll is done and this wallet wasn't in it.
  if (!OFFERING_ADDRESS) return null;
  if (seatsRemaining === undefined) return null;
  if (seatsRemaining === 0n && !hasClaimed) return null;

  const claimedSeats = 250n - (seatsRemaining ?? 0n);
  const todayGone = (seatsToday ?? 0n) === 0n;
  const poorVessel =
    minEth !== undefined && ethBalance !== undefined && ethBalance.value < minEth;

  const canClaim =
    !!address && !hasClaimed && seatsRemaining > 0n && !todayGone && !poorVessel;

  const busy = isPending || isConfirming;

  const buttonText = (() => {
    if (isPending) return "CONFIRM IN WALLET...";
    if (isConfirming) return "THE TREASURY STIRS...";
    return "CLAIM THE OFFERING";
  })();

  return (
    <div className="card p-4 sm:p-5 text-center">
      <div className="section-label">THE OFFERING</div>

      <div className="font-mono text-2xl sm:text-3xl text-ritual-light mt-3 tabular-nums">
        {claimedSeats.toString()} <span className="text-gray-500 text-lg">/ 250</span>
      </div>
      <div className="text-[11px] font-mono uppercase tracking-[2px] text-gray-500 mt-1">
        seats claimed
      </div>

      <p className="text-xs sm:text-sm text-gray-300 mt-3 leading-relaxed">
        The treasury seeds the first 250 believers: 100 $RITUAL each, one claim per
        wallet, enough for a first sacrifice. No list, no judge. The machine decides.
      </p>

      {hasClaimed ? (
        <div className="text-sm text-ritual-light font-serif tracking-wide mt-4">
          Your offering is received. Now burn it.
        </div>
      ) : !address ? (
        <div className="text-[12px] font-mono uppercase tracking-wider text-gray-500 mt-4">
          Connect a wallet to claim
        </div>
      ) : (
        <>
          <button
            onClick={() =>
              writeContract({
                address: OFFERING_ADDRESS,
                abi: OFFERING_ABI,
                functionName: "claim",
              })
            }
            disabled={!canClaim || busy}
            className="btn-sacrifice w-full mt-4"
            style={{
              opacity: !canClaim || busy ? 0.5 : 1,
              cursor: !canClaim || busy ? "not-allowed" : "pointer",
            }}
          >
            {buttonText}
          </button>

          {poorVessel && (
            <div className="text-[13px] text-red-400 mt-3">
              The vessel must hold gas money of its own
              {minEth !== undefined ? ` (${formatEther(minEth)} ETH)` : ""}. The
              offering is $RITUAL, not passage.
            </div>
          )}
          {todayGone && !poorVessel && (
            <div className="text-[13px] text-gray-400 mt-3 italic">
              Today&apos;s seats are taken. The offering resumes at the next midnight
              (UTC). Patience, mortal.
            </div>
          )}
          {writeError && !busy && (
            <div className="text-[13px] text-red-400 mt-3 break-words">
              The veil resists:{" "}
              {(writeError as { shortMessage?: string }).shortMessage ??
                writeError.message?.slice(0, 140)}
            </div>
          )}
        </>
      )}

      {isSuccess && !hasClaimed && (
        <div className="text-sm text-ritual-light font-serif tracking-wide mt-3 animate-fade-in">
          Your offering is received. Now burn it.
        </div>
      )}
    </div>
  );
}
