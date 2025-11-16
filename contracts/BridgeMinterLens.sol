// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";
import {IERC20MintableBurnable} from "./interfaces/IERC20MintableBurnable.sol";

contract BridgeMinterLens is AccessControl, Pausable {
    IERC20MintableBurnable public token; // tRYF_Lens
    uint256 public feeBps;
    address public treasury;

    // chống double-mint: processed[srcChainId][srcTxHash]
    mapping(uint256 => mapping(bytes32 => bool)) public processed;

    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // optional: nonce tăng dần cho sự kiện Burned
    uint256 public burnNonce;

    event Minted(address to, uint256 amount, bytes32 srcTxHash, uint256 srcNonce);
    event Burned(address from, uint256 amount, address toOnBsc, uint256 nonce);

    constructor(address _token, address admin) {
        require(_token != address(0) && admin != address(0), "zero addr");
        token = IERC20MintableBurnable(_token);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        // BRIDGE_ROLE sẽ cấp cho ví nóng relayer Lens
    }

    function setFee(uint256 _feeBps, address _treasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_feeBps <= 10_000, "fee>100%");
        if (_feeBps > 0) require(_treasury != address(0), "treasury=0");
        feeBps = _feeBps;
        treasury = _treasury;
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

        uint256 fee = (amount * feeBps) / 10_000;
        uint256 out = amount - fee;

        // YÊU CẦU: tRYF_Lens triển khai mint() với onlyRole(MINTER_ROLE)
        // và đã grant MINTER_ROLE cho BridgeMinterLens
        token.mint(to, out);
        if (fee > 0) token.mint(treasury, fee);

        emit Minted(to, amount, srcTxHash, srcNonce);
    }

    // ============== Lens -> BSC (burn) ==============
    function burnToBsc(uint256 amount, address toOnBsc) external whenNotPaused {
        require(toOnBsc != address(0) && amount > 0, "bad params");
        // cần user approve trước cho BridgeMinterLens
        token.burnFrom(msg.sender, amount);
        emit Burned(msg.sender, amount, toOnBsc, ++burnNonce);
    }
}
