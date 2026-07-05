---
name: safe-admin
description: Prepare, simulate, and verify owner transactions through the 2-of-3 Safe (startEpoch, withdraw, pause/unpause, ENS ops, ownership changes). Use whenever an onlyOwner call on any Summoning contract is needed, or the user asks to "do X from the Safe".
---

# Safe Admin Operations

Safe (owner of all 5 contracts + treasury): `0x67c6f1dA08Cd99A661ec6f77A060E985d9672baB`
2-of-3. Signers: deployer/owner1 `0x1Aa8…0E40`, "OG" owner2 `0xB220…cA94`, owner3 `0x7B36…6938`.
Claude CANNOT execute Safe transactions — prepare calldata + verification; the user drives
app.safe.global and collects signatures.

## Standard flow (proven on the F→D→E wiring batch and validated on Sepolia rehearsal #3)

1. **Prepare exact calldata locally** and paste it into the reply for the user:
   ```bash
   cast calldata "<sig>" <args...>
   ```
2. User: Safe → Transaction Builder → target address → paste.
   - **ABI often fails to auto-load** even for verified contracts → toggle
     **Custom data** and use the raw hex. This is normal.
3. **Tenderly simulate must PASS before signing.** Known non-issues:
   - "Delegate call can be dangerous" warning appears for ALL MultiSend batches — normal
     for batches, and should NOT appear for single calls.
   - Beware STALE TABS: confirm the simulation shows chainId 1 (a leftover Sepolia
     Tenderly tab once masqueraded as the mainnet sim).
4. 2-of-3 sign → execute.
5. **Verify on-chain after execution** with cast — never trust the UI success banner alone.

## Common operations reference

| Operation | Target | Signature | Notes |
|---|---|---|---|
| Start epoch | ENGINE `0x5D47…5be5` | `startEpoch(uint256,uint256)` sel `0xfb8afa7f` | args: oldOneId, thresholdWei. Starts 48h clock INSTANTLY. Follow RUNBOOK.md fully |
| Sweep treasury | CURVE `0x8c7c…5462` | `withdraw(address)` | arg: the Safe itself. Sends full balance |
| Pause mint | CURVE | `pause()` | incident response (H-02) |
| Pause game | ENGINE | `pause()` | blocks commitRitual/claims; resolveEpoch stays live |
| Unpause | CURVE / ENGINE | `unpause()` | |
| Set metadata base | GLYPHS / ARTIFACTS | `setBaseURI(string)` | current: https://api.thesummoning.xyz/api/metadata/{glyph,artifact}/ |
| Accept ownership | (2-step ownable, e.g. GLYPHS) | `acceptOwnership()` sel `0x79ba5097` | |
| ENS reverse record | ENS ReverseRegistrar `0xa58E81fe9b61B5c3fE2AFD33CF304c454AbFc7Cb` | `setName(string)` sel `0xc47f0027` | makes Etherscan show the name on the Safe; name must already forward-resolve to the Safe |

Addresses: TOKEN `0x8daA…7863`, CURVE `0x8c7c…5462`, ARTIFACTS `0x8324…af5A`,
GLYPHS `0xe820…D156`, ENGINE `0x5D47…5be5`.

## Post-execution verification pattern

```bash
RPC=$(grep '^RPC_URL=' backend/.env.mainnet 2>/dev/null | cut -d= -f2)
# read back the exact state the tx was meant to change, e.g.:
cast call <target> "<getter>()" --rpc-url $RPC
# for startEpoch additionally: currentEpochId incremented + getEpoch fields correct,
# then backend /api/epochs/current reflects it within ~2 min.
```

## Hard rules

- One state-changing intent per request; simulate before signing, verify after executing.
- `withdraw` recipient must be the Safe. Never an EOA.
- Never propose startEpoch unless RUNBOOK.md Part 1 pre-flight (see mainnet-status skill) is green and the user explicitly says launch/announce is ready.
