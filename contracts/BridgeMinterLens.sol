// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";
import {IERC20MintableBurnable} from "./interfaces/IERC20MintableBurnable.sol";

contract BridgeMinterLens is AccessControl, Pausable {
    IERC20MintableBurnable public token; // tRYF_Lens

    uint16 public constant MAX_BPS = 10_000;

    // ===== Fee config =====
    // fee theo % (basis points), ví dụ: 30 = 0.3%
    uint16 public feeBps;
    // fee tối thiểu theo đơn vị token (wei), ví dụ ~0.1 USD quy đổi sang tRYF_Lens
    uint256 public minFee;
    address public treasury;

    // ===== Limits cho mỗi lần burn (Lens -> BSC) =====
    uint256 public minPerTx; // 0 = không giới hạn
    uint256 public maxPerTx; // 0 = không giới hạn

    // chống double-mint: processed[srcChainId][srcTxHash]
    mapping(uint256 => mapping(bytes32 => bool)) public processed;

    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // optional: nonce tăng dần cho sự kiện Burned
    uint256 public burnNonce;

    // ===== Events =====
    event Minted(address to, uint256 amount, bytes32 srcTxHash, uint256 srcNonce);
    event Burned(address from, uint256 amount, address toOnBsc, uint256 nonce);

    event FeeUpdated(uint16 feeBps, address treasury);  
    event MinFeeUpdated(uint256 minFee);
    event LimitsUpdated(uint256 minPerTx, uint256 maxPerTx);

    constructor(address _token, address admin) {
        require(_token != address(0) && admin != address(0), "zero addr");
        token = IERC20MintableBurnable(_token);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        // BRIDGE_ROLE sẽ cấp cho ví nóng relayer Lens
    }

    // ===== Admin configs =====

    /**
     * @notice Cập nhật fee theo % (bps) và treasury.
     *         feeBps = 30 => 0.3%
     */
    function setFee(uint16 _feeBps, address _treasury)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(_feeBps <= MAX_BPS, "fee>MAX_BPS");
        // Nếu có thu fee (theo % hoặc minFee), treasury phải khác 0
        if (_feeBps > 0 || minFee > 0) {
            require(_treasury != address(0), "treasury=0");
        }
        feeBps = _feeBps;
        treasury = _treasury;

        emit FeeUpdated(_feeBps, _treasury);
    }

    /**
     * @notice Cập nhật minFee theo đơn vị token (wei).
     *         Admin sẽ tự tính 0.1 USD ≈ X tRYF_Lens và set giá trị X.
     */
    function setMinFee(uint256 _minFee)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        minFee = _minFee;
        // nếu có thu fee (theo % hoặc minFee), treasury phải khác 0
        if (feeBps > 0 || _minFee > 0) {
            require(treasury != address(0), "treasury=0");
        }
        emit MinFeeUpdated(_minFee);
    }

    /**
     * @notice Cập nhật hạn mức mỗi lần burn (Lens -> BSC).
     *         0 = bỏ giới hạn.
     */
    function setLimits(uint256 _minPerTx, uint256 _maxPerTx)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(_maxPerTx == 0 || _maxPerTx >= _minPerTx, "max<min");
        minPerTx = _minPerTx;
        maxPerTx = _maxPerTx;
        emit LimitsUpdated(_minPerTx, _maxPerTx);
    }

    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

    // ============== BSC -> Lens (mint) ==============
    function mintTo(
        address to,
        uint256 amount,
        bytes32 srcTxHash,
        uint256 srcChainId,
        uint256 srcNonce
    ) external onlyRole(BRIDGE_ROLE) whenNotPaused {
        require(to != address(0) && amount > 0, "bad params");
        require(!processed[srcChainId][srcTxHash], "processed");
        processed[srcChainId][srcTxHash] = true;

        uint256 fee = 0;

        // fee theo %
        if (feeBps > 0) {
            fee = (amount * feeBps) / MAX_BPS;
        }

        // áp dụng minFee nếu có
        if (minFee > 0 && fee < minFee) {
            fee = minFee;
        }

        // đảm bảo không fee > amount (tránh underflow)
        if (fee > amount) {
            fee = amount;
        }

        uint256 out = amount - fee;

        // YÊU CẦU: tRYF_Lens triển khai mint() với onlyRole(MINTER_ROLE)
        // và đã grant MINTER_ROLE cho BridgeMinterLens
        token.mint(to, out);
        if (fee > 0) {
            require(treasury != address(0), "treasury=0");
            token.mint(treasury, fee);
        }

        emit Minted(to, amount, srcTxHash, srcNonce);
    }

    // ============== Lens -> BSC (burn) ==============
    function burnToBsc(uint256 amount, address toOnBsc) external whenNotPaused {
        require(toOnBsc != address(0) && amount > 0, "bad params");

        // Giới hạn min/max mỗi lần burn (Lens -> BSC)
        if (minPerTx > 0) {
            require(amount >= minPerTx, "amount<min");
        }
        if (maxPerTx > 0) {
            require(amount <= maxPerTx, "amount>max");
        }

        // cần user (hoặc Lens Account) approve trước cho BridgeMinterLens
        token.burnFrom(msg.sender, amount);
        emit Burned(msg.sender, amount, toOnBsc, ++burnNonce);
    }
}
