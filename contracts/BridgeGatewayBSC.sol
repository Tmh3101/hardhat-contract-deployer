// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract BridgeGatewayBSC is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ===== Roles =====
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // ===== Constants =====
    uint16 public constant MAX_BPS = 10_000; // 100%

    // ===== Core state =====
    IERC20  public immutable token;      // RYF trên BSC (token gốc / canonical)
    uint256 public immutable dstChainId; // ví dụ 37111 cho Lens testnet

    // Số thứ tự lock (tăng dần) để client dễ đối chiếu
    uint256 public nonce;

    // Chống double-unlock: processed[srcChainId][srcTxHash] = true
    mapping(uint256 => mapping(bytes32 => bool)) public processed;

    // Cấu hình phí & hạn mức
    uint16  public feeBps;      // basis points (bps)
    address public treasury;    // nơi nhận phí
    uint256 public minPerTx;    // 0 = không giới hạn
    uint256 public maxPerTx;    // 0 = không giới hạn
    uint256 public minFee;      // phí tối thiểu theo đơn vị token (wei)

    // ===== Events =====
    event Locked(
        address indexed from,
        address indexed toOnLens,
        uint256 amount,
        uint256 nonce,
        uint256 dstChainId
    );

    event Unlocked(
        address indexed toOnBsc,
        uint256 amount,           // input amount trước khi trừ phí
        uint256 amountOut,        // amount sau khi trừ phí
        bytes32 indexed srcTxHash,
        uint256 srcChainId,
        uint256 srcNonce
    );

    event FeeUpdated(uint16 feeBps, address treasury);
    event LimitsUpdated(uint256 minPerTx, uint256 maxPerTx);
    event MinFeeUpdated(uint256 minFee);

    // ===== Constructor =====
    /**
     * @param _token       địa chỉ token RYF/tRYF gốc trên BSC (contract Rise_Your_Future của bạn)
     * @param _admin       admin (giữ DEFAULT_ADMIN_ROLE)
     * @param _dstChainId  chain đích (vd: 37111 cho Lens testnet)
     */
    constructor(address _token, address _admin, uint256 _dstChainId) {
        require(_token != address(0), "token=0");
        require(_admin != address(0), "admin=0");
        token = IERC20(_token);
        dstChainId = _dstChainId;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(PAUSER_ROLE, _admin);
        // BRIDGE_ROLE cấp sau cho ví nóng relayer
    }

    // ===== User: LOCK (BSC -> Lens) =====
    /**
     * @notice Người dùng lock token vào pool để bridge sang Lens.
     *         Yêu cầu: đã approve amount cho contract này.
     * @param amount    số token muốn lock
     * @param toOnLens  địa chỉ nhận trên Lens (EVM address)
     */
    function lock(uint256 amount, address toOnLens)
        external
        nonReentrant
        whenNotPaused
    {
        require(toOnLens != address(0), "toOnLens=0");
        require(amount > 0, "amount=0");
        if (minPerTx > 0) require(amount >= minPerTx, "amount<min");
        if (maxPerTx > 0) require(amount <= maxPerTx, "amount>max");

        // Kéo token vào pool
        token.safeTransferFrom(msg.sender, address(this), amount);

        emit Locked(msg.sender, toOnLens, amount, ++nonce, dstChainId);
    }

    // ===== Relayer: UNLOCK (Lens -> BSC) =====
    /**
     * @notice Unlock token từ pool về ví người dùng trên BSC
     * @dev Chỉ caller có BRIDGE_ROLE (relayer). Chống double-unlock bằng processed.
     * @param toOnBsc    người nhận
     * @param amount     lượng gốc (trước phí)
     * @param srcTxHash  tx hash ở chain nguồn (Lens)
     * @param srcChainId chainId nguồn (Lens)
     * @param srcNonce   nonce ở chain nguồn (tuỳ bạn định nghĩa phát event bên Lens)
     */
    function unlock(
        address toOnBsc,
        uint256 amount,
        bytes32 srcTxHash,
        uint256 srcChainId,
        uint256 srcNonce
    ) external nonReentrant whenNotPaused onlyRole(BRIDGE_ROLE) {
        require(toOnBsc != address(0), "toOnBsc=0");
        require(amount > 0, "amount=0");
        require(!processed[srcChainId][srcTxHash], "already-processed");

        processed[srcChainId][srcTxHash] = true;

        uint256 out = amount;
        uint256 fee;
        if (feeBps > 0 || minFee > 0) {
            uint256 percentFee = (amount * feeBps) / MAX_BPS;
            fee = percentFee;

            if (minFee > 0 && fee < minFee) {
                fee = minFee;
                require(fee <= amount, "fee>amount"); // an toàn
            }

            out = amount - fee;

            if (fee > 0) {
                require(treasury != address(0), "treasury=0");
                token.safeTransfer(treasury, fee);
            }
        }

        // Lưu ý: nếu người nhận bị blacklist trong token (ở Lens thì có, BSC của bạn cũng có),
        // transfer có thể revert. Relayer nên try/catch ở off-chain để ghi lỗi và xử lý thủ công.
        token.safeTransfer(toOnBsc, out);

        emit Unlocked(toOnBsc, amount, out, srcTxHash, srcChainId, srcNonce);
    }

    // ===== Admin controls =====
    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

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
        feeBps  = _feeBps;
        treasury = _treasury;
        emit FeeUpdated(_feeBps, _treasury);
    }

    /**
     * @notice Cập nhật hạn mức mỗi lần lock (0 = bỏ giới hạn)
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

    /**
     * @notice Cập nhật minFee theo đơn vị token (wei).
     *         Admin sẽ tự tính 0.1 USD ≈ X RYF và set giá trị X.
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
     * @notice Thu hồi token lạc (không phải token bridge).
     */
    function sweep(address erc20, uint256 amount, address to)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(to != address(0), "to=0");
        require(erc20 != address(token), "no-bridge-token");
        IERC20(erc20).safeTransfer(to, amount);
    }

    // ===== Views =====
    function isProcessed(uint256 _srcChainId, bytes32 _srcTxHash)
        external
        view
        returns (bool)
    {
        return processed[_srcChainId][_srcTxHash];
    }
}
