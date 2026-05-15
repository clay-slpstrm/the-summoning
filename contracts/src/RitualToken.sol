// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title RitualToken
/// @notice ERC-20 token ($RITUAL) with restricted minting via MintingCurve and public burn.
///         Capped at MAX_SUPPLY (1B tokens) — bounds the worst-case treasury value
///         (H-05) and gives the bonding curve a defined endgame.
contract RitualToken is ERC20, ERC20Burnable, Ownable {
    /// @notice Hard cap on total supply. Enforced in mint().
    uint256 public constant MAX_SUPPLY = 1_000_000_000e18;

    /// @notice The address authorized to mint tokens (MintingCurve contract).
    address public minter;

    error OnlyMinter();
    error MinterAlreadySet();
    error ZeroAddress();
    error MaxSupplyExceeded();

    event MinterSet(address indexed minter);

    modifier onlyMinter() {
        if (msg.sender != minter) revert OnlyMinter();
        _;
    }

    constructor(address _owner) ERC20("Ritual", "RITUAL") Ownable(_owner) {}

    /// @notice Set the minter address. Can only be called once by owner.
    /// @param _minter The MintingCurve contract address.
    function setMinter(address _minter) external onlyOwner {
        if (_minter == address(0)) revert ZeroAddress();
        if (minter != address(0)) revert MinterAlreadySet();
        minter = _minter;
        emit MinterSet(_minter);
    }

    /// @notice Mint tokens. Only callable by the MintingCurve. Reverts above MAX_SUPPLY.
    /// @param to Recipient address.
    /// @param amount Token amount (18 decimals).
    function mint(address to, uint256 amount) external onlyMinter {
        if (totalSupply() + amount > MAX_SUPPLY) revert MaxSupplyExceeded();
        _mint(to, amount);
    }
}
