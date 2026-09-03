// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Offering
/// @notice The treasury's offering to the first believers. A self-serve, one-per-wallet
///         claim of CLAIM_AMOUNT $RITUAL, capped at MAX_CLAIMS total and DAILY_CLAIM_CAP
///         per UTC day, funded by the treasury Safe and sweepable back by it.
///
///         Replaces the hand-curated "First Cultists" drop with a mechanism that needs
///         no human in the loop — consistent with the self-perpetuating engine it feeds.
///
///         Sybil analysis (why self-serve is safe here): $RITUAL has no sell path — the
///         minting curve has no buyback and no pool exists; the token's only use is being
///         burned in The Summoning. Farming the Offering therefore yields tokens whose
///         only utility is playing the game (the desired outcome) or idling (neutral).
///         The residual harm is seat-hoarding, bounded by two cheap filters:
///           - MIN_ETH_BALANCE: the claiming wallet must hold real gas money, killing
///             zero-effort bot swarms.
///           - DAILY_CLAIM_CAP: seats drain over days, not in one block, so the public
///             counter stays a standing acquisition hook.
///         Deliberately NO tx.origin gate: it would exclude smart-account (AA) wallets,
///         and the damage ceiling here does not justify excluding real users.
contract Offering is Ownable, ReentrancyGuard {

    // ── Storage ──────────────────────────────────────────────────────────────

    IERC20 public immutable ritualToken;

    /// @notice Total claims ever made (also the claim ordinal in the event).
    uint256 public totalClaims;

    /// @notice wallet => has claimed (one offering per vessel, forever).
    mapping(address => bool) public claimed;

    /// @dev UTC day number (block.timestamp / 1 days) the daily counter refers to.
    uint256 public currentDay;

    /// @notice Claims made during `currentDay`.
    uint256 public claimsToday;

    // ── Constants ────────────────────────────────────────────────────────────

    uint256 public constant CLAIM_AMOUNT     = 100e18;      // 100 $RITUAL — one sacrifice, on the house
    uint256 public constant MAX_CLAIMS      = 250;          // the roll of the First Cultists
    uint256 public constant DAILY_CLAIM_CAP = 25;           // seats drain over ≥10 days, not one block
    uint256 public constant MIN_ETH_BALANCE = 0.005 ether;  // vessel must hold real gas money

    // ── Events ───────────────────────────────────────────────────────────────

    event OfferingClaimed(address indexed vessel, uint256 amount, uint256 claimNumber);
    event Swept(address indexed to, uint256 amount);

    // ── Errors ───────────────────────────────────────────────────────────────

    error Offering__AlreadyClaimed();
    error Offering__Exhausted();
    error Offering__DailyCapReached();
    error Offering__UnworthyVessel();
    error Offering__ZeroAddress();
    error Offering__TransferFailed();
    error Offering__NothingToSweep();

    // ── Constructor ──────────────────────────────────────────────────────────

    /// @param _token The $RITUAL token.
    /// @param _owner The treasury Safe (sweep authority; no other powers).
    constructor(address _token, address _owner) Ownable(_owner) {
        if (_token == address(0)) revert Offering__ZeroAddress();
        ritualToken = IERC20(_token);
    }

    // ── Claim ────────────────────────────────────────────────────────────────

    /// @notice Claim the offering: CLAIM_AMOUNT $RITUAL, once per wallet.
    ///         Reverts if the roll is full, today's seats are gone, the contract is
    ///         unfunded, or the caller holds less than MIN_ETH_BALANCE of gas money.
    function claim() external nonReentrant {
        if (claimed[msg.sender]) revert Offering__AlreadyClaimed();
        if (totalClaims >= MAX_CLAIMS) revert Offering__Exhausted();
        if (ritualToken.balanceOf(address(this)) < CLAIM_AMOUNT) revert Offering__Exhausted();
        if (msg.sender.balance < MIN_ETH_BALANCE) revert Offering__UnworthyVessel();

        uint256 day = block.timestamp / 1 days;
        if (day != currentDay) {
            currentDay = day;
            claimsToday = 0;
        }
        if (claimsToday >= DAILY_CLAIM_CAP) revert Offering__DailyCapReached();

        // Effects before interaction (CEI; token is hook-free OZ ERC-20, belt anyway).
        claimed[msg.sender] = true;
        claimsToday++;
        totalClaims++;

        if (!ritualToken.transfer(msg.sender, CLAIM_AMOUNT)) revert Offering__TransferFailed();

        emit OfferingClaimed(msg.sender, CLAIM_AMOUNT, totalClaims);
    }

    // ── Owner (treasury Safe) ────────────────────────────────────────────────

    /// @notice Sweep the full remaining $RITUAL balance back to the treasury.
    ///         The only owner power. Sweeping ends the Offering (claims revert Exhausted
    ///         until re-funded); re-funding re-opens it with the counters intact.
    function sweep(address to) external onlyOwner {
        if (to == address(0)) revert Offering__ZeroAddress();
        uint256 amount = ritualToken.balanceOf(address(this));
        if (amount == 0) revert Offering__NothingToSweep();
        if (!ritualToken.transfer(to, amount)) revert Offering__TransferFailed();
        emit Swept(to, amount);
    }

    // ── Views (for the UI counter) ───────────────────────────────────────────

    /// @notice Seats still claimable overall: the roll cap and the actual funding,
    ///         whichever binds first.
    function seatsRemaining() external view returns (uint256) {
        uint256 byCap = MAX_CLAIMS - totalClaims;
        uint256 byFunding = ritualToken.balanceOf(address(this)) / CLAIM_AMOUNT;
        return byCap < byFunding ? byCap : byFunding;
    }

    /// @notice Seats still claimable today (resets at UTC midnight).
    function seatsRemainingToday() external view returns (uint256) {
        if (block.timestamp / 1 days != currentDay) return DAILY_CLAIM_CAP;
        return DAILY_CLAIM_CAP - claimsToday;
    }
}
