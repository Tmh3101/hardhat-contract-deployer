// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

/**
 * Testnet_Rise_Your_Future (tRYF) — Wrapped token cho Lens Chain (testnet)
 * - Mintable/Burnable: mint CHỈ bởi MINTER_ROLE (BridgeMinterLens), burn mở cho user.
 * - Pausable + Blacklist.
 * - Initial supply = 0 (peg 1:1 theo pool bên BSC).
 */

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Rise_Your_Future_Token is ERC20, ERC20Burnable, AccessControl, Pausable {
    using SafeERC20 for IERC20;

    // =============== Roles ===============
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // =============== Blacklist ===============
    mapping(address => bool) public blacklisted;
    event BlacklistUpdated(address indexed account, bool isBlacklisted);

    // =============== Events (quản trị) ===============
    event RecoveredForeignERC20(address indexed token, address indexed to, uint256 amount);

    // =============== Errors ===============
    error InvalidToken(address tokenAddress);
    error Blacklisted(address from, address to);

    constructor(
        string memory name_,
        string memory symbol_,
        address admin_
    ) ERC20(name_, symbol_) {
        require(admin_ != address(0), "admin=0");

        // roles setup
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(PAUSER_ROLE, admin_);
        // MINTER_ROLE sẽ được grant cho BridgeMinterLens sau khi deploy

        // initial supply = 0 (wrapped token)
    }

    // =============== Metadata ===============
    function decimals() public pure override returns (uint8) {
        return 18;
    }

    // =============== Admin ===============
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function setBlacklist(address account, bool isBlacklisted) external onlyRole(DEFAULT_ADMIN_ROLE) {
        blacklisted[account] = isBlacklisted;
        emit BlacklistUpdated(account, isBlacklisted);
    }

    /**
     * Thu hồi token ERC20 gửi nhầm vào contract (không phải chính token này).
     */
    function recoverForeignERC20(address tokenAddress, uint256 amount, address to)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (tokenAddress == address(this)) revert InvalidToken(tokenAddress);
        require(to != address(0), "to=0");
        IERC20(tokenAddress).safeTransfer(to, amount);
        emit RecoveredForeignERC20(tokenAddress, to, amount);
    }

    // =============== Mint (chỉ BridgeMinterLens) ===============
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) whenNotPaused {
        _mint(to, amount);
    }

    // =============== Core Transfer Hooks ===============
    function _update(address from, address to, uint256 amount)
        internal
        override
        whenNotPaused
    {
        // chặn chuyển nếu bị blacklist
        if (from != address(0) && blacklisted[from]) revert Blacklisted(from, to);
        if (to != address(0) && blacklisted[to]) revert Blacklisted(from, to);

        super._update(from, to, amount);
    }
}
