// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

/**
 * Rise_Your_Future_Token (RYF)
 * - Tổng cung khởi tạo: 1,000,000 RYF
 * - Chỉ ADMIN (DEFAULT_ADMIN_ROLE) mới được mint thêm.
 * - Có Burn, Pause, Blacklist, và Recover token gửi nhầm.
 */

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Ruby_Token is ERC20, ERC20Burnable, AccessControl, Pausable {
    using SafeERC20 for IERC20;

    // =============== Roles ===============
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // =============== Blacklist ===============
    mapping(address => bool) public blacklisted;
    event BlacklistUpdated(address indexed account, bool isBlacklisted);

    // =============== Events ===============
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

        // setup roles
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(PAUSER_ROLE, admin_);

        // Mint 1,000,000 token (với 18 decimals)
        _mint(admin_, 1_000_000 * 10 ** decimals());
    }

    // =============== Metadata ===============
    function decimals() public pure override returns (uint8) {
        return 18;
    }

    // =============== Admin Control ===============
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function setBlacklist(address account, bool isBlacklisted)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
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

    // =============== Mint (chỉ admin) ===============
    function mint(address to, uint256 amount)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        whenNotPaused
    {
        _mint(to, amount);
    }

    // =============== Transfer Hook ===============
    function _update(address from, address to, uint256 amount)
        internal
        override
        whenNotPaused
    {
        if (from != address(0) && blacklisted[from]) revert Blacklisted(from, to);
        if (to != address(0) && blacklisted[to]) revert Blacklisted(from, to);
        super._update(from, to, amount);
    }
}
