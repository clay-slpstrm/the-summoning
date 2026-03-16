// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// TODO: Week 2 — full implementation per ARCHITECTURE.md §3.3
// Placeholder to allow Deploy.s.sol to compile during Week 1.

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IRitualToken.sol";
import "./interfaces/IElderArtifacts.sol";

contract SummoningEngine is Ownable, ReentrancyGuard {
    IRitualToken public immutable ritualToken;
    IElderArtifacts public immutable artifacts;

    constructor(address _token, address _artifacts, address _owner) Ownable(_owner) {
        ritualToken = IRitualToken(_token);
        artifacts = IElderArtifacts(_artifacts);
    }
}
