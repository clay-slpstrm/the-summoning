// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title RitualToken
/// @notice ERC-20 token ($RITUAL) with restricted minting via BondingCurve and public burn.
contract RitualToken is ERC20, ERC20Burnable, Ownable {
    /// @notice The address authorized to mint tokens (BondingCurve contract).
    address public minter;

    error OnlyMinter();
    error MinterAlreadySet();
    error ZeroAddress();

    event MinterSet(address indexed minter);

    modifier onlyMinter() {
        if (msg.sender != minter) revert OnlyMinter();
        _;
    }

    constructor(address _owner) ERC20("Ritual", "RITUAL") Ownable(_owner) {}

    /// @notice Set the minter address. Can only be called once by owner.
    /// @param _minter The BondingCurve contract address.
    function setMinter(address _minter) external onlyOwner {
        if (_minter == address(0)) revert ZeroAddress();
        if (minter != address(0)) revert MinterAlreadySet();
        minter = _minter;
        emit MinterSet(_minter);
    }

    /// @notice Mint tokens. Only callable by the BondingCurve.
    /// @param to Recipient address.
    /// @param amount Token amount (18 decimals).
    function mint(address to, uint256 amount) external onlyMinter {
        _mint(to, amount);
    }
}
