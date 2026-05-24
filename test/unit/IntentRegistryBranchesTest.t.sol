// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IntentRegistry} from "../../src/IntentRegistry.sol";
import {IntentRegistryBase} from "./IntentRegistryBase.sol";

// ─────────────────────────────────────────────────────────────────────────────
// FailingERC20
//
// An ERC-20 whose transferFrom and transfer always RETURN false (instead of
// reverting). This is the only way to hit the two `if (!res)` branches in
// IntentRegistry because MockERC20 uses custom errors (always reverts).
//
// Placed here rather than Mocks.sol so we do not alter the existing file.
// ─────────────────────────────────────────────────────────────────────────────
contract FailingERC20 {
    // Minimal state so IntentRegistry can call it
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    /// @dev Always returns false — triggers IntentRegistry__TransferInDepositIntentFailed
    function transferFrom(address, address, uint256) external pure returns (bool) {
        return false;
    }

    /// @dev Always returns false — triggers IntentRegistry__CancelTransferFailed
    function transfer(address, uint256) external pure returns (bool) {
        return false;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// IntentRegistryBranchTest
//
// Covers only the branches that are RED in the coverage report:
//
//   depositIntentFunds:
//     BR-1  transferFrom returns false  →  IntentRegistry__TransferInDepositIntentFailed
//
//   cancelIntent:
//     BR-2  deposited == false          →  no token transfer, just flag + event
//     BR-3  transfer returns false      →  IntentRegistry__CancelTransferFailed
//
// All tests inherit IntentRegistryBase for setUp() / helpers.
// ─────────────────────────────────────────────────────────────────────────────
contract IntentRegistryBranchTest is IntentRegistryBase {
    FailingERC20 internal failToken;

    function setUp() public override {
        super.setUp();
        failToken = new FailingERC20();
    }

    // ── helper: submit + reveal an intent whose tokenIn is failToken ──────────
    function _setupFailTokenIntent(bool greaterThan, uint256 expiry) internal returns (uint256 intentId) {
        bytes32 secret = keccak256("fail_secret");
        bytes32 hash = keccak256(
            abi.encodePacked(
                USER,
                address(failToken),
                address(tokenOut),
                AMOUNT_IN,
                TARGET_PRICE,
                MIN_AMOUNT_OUT,
                greaterThan,
                expiry,
                secret
            )
        );

        vm.prank(USER);
        registry.submitIntent(hash, expiry);
        intentId = registry.nextIntentId() - 1;

        vm.prank(USER);
        registry.revealIntent(
            intentId,
            address(failToken),
            address(tokenOut),
            AMOUNT_IN,
            TARGET_PRICE,
            MIN_AMOUNT_OUT,
            greaterThan,
            secret
        );

        // Give USER enough failToken and approve the registry
        failToken.mint(USER, AMOUNT_IN);
        vm.prank(USER);
        failToken.approve(address(registry), type(uint256).max);
    }

    // =========================================================================
    // BR-1: depositIntentFunds — transferFrom returns false
    //       Hits: if (!res) revert IntentRegistry__TransferInDepositIntentFailed()
    // =========================================================================

    function test_deposit_transferReturnsFalse_reverts() public {
        uint256 expiry = block.timestamp + 1 days;
        uint256 intentId = _setupFailTokenIntent(true, expiry);

        // FailingERC20.transferFrom returns false → registry must revert
        vm.expectRevert(IntentRegistry.IntentRegistry__TransferInDepositIntentFailed.selector);
        vm.prank(USER);
        registry.depositIntentFunds(intentId);
    }

    function test_deposit_transferReturnsFalse_depositedFlagNotSet() public {
        uint256 expiry = block.timestamp + 1 days;
        uint256 intentId = _setupFailTokenIntent(true, expiry);

        vm.prank(USER);
        try registry.depositIntentFunds(intentId) {} catch {}

        // deposited must remain false — the flag is set before the call but
        // the whole tx reverts so the state change is rolled back
        assertFalse(registry.getIntent(intentId).deposited);
    }

    // =========================================================================
    // BR-2: cancelIntent — deposited == false  (no-deposit path)
    //       Hits: if (intent.deposited) { transfer... } — the FALSE branch
    //       i.e. cancel without ever depositing: no token movement, just flag
    // =========================================================================

    function test_cancel_notDeposited_noTokenTransfer() public {
        uint256 expiry = block.timestamp + 1 days;
        // Submit only — no reveal, no deposit
        vm.prank(USER);
        registry.submitIntent(keccak256("nd"), expiry);
        uint256 intentId = registry.nextIntentId() - 1;

        uint256 userBalBefore = tokenIn.balanceOf(USER);
        uint256 registryBalBefore = tokenIn.balanceOf(address(registry));

        vm.prank(USER);
        registry.cancelIntent(intentId);

        // No tokens should have moved
        assertEq(tokenIn.balanceOf(USER), userBalBefore);
        assertEq(tokenIn.balanceOf(address(registry)), registryBalBefore);
        assertTrue(registry.getIntent(intentId).cancelled);
    }

    function test_cancel_notDeposited_emitsCancelledEvent() public {
        uint256 expiry = block.timestamp + 1 days;
        vm.prank(USER);
        registry.submitIntent(keccak256("nd2"), expiry);
        uint256 intentId = registry.nextIntentId() - 1;

        vm.expectEmit(true, false, false, false);
        emit IntentRegistry.IntentCancelled(intentId);

        vm.prank(USER);
        registry.cancelIntent(intentId);
    }

    function test_cancel_revealedButNotDeposited_succeeds() public {
        uint256 expiry = block.timestamp + 1 days;
        uint256 intentId = _submitAndReveal(USER, AMOUNT_IN, TARGET_PRICE, MIN_AMOUNT_OUT, true, expiry, SECRET);
        // revealed but NOT deposited — cancel allowed anytime

        vm.prank(USER);
        registry.cancelIntent(intentId);

        assertTrue(registry.getIntent(intentId).cancelled);
        assertFalse(registry.getIntent(intentId).deposited);
    }

    // =========================================================================
    // BR-3: cancelIntent — transfer returns false
    //       Hits: if (!res) revert IntentRegistry__CancelTransferFailed()
    //
    // To reach this branch we need:
    //   - intent.deposited == true
    //   - intent.expiry    <  block.timestamp  (past expiry)
    //   - transfer()       returns false
    //
    // We manually set deposited=true via a custom harness that bypasses the
    // normal deposit flow (which would call transferFrom on failToken, also
    // returning false). We use vm.store to flip the deposited slot directly.
    // =========================================================================

    function test_cancel_transferReturnsFalse_reverts() public {
        uint256 expiry = block.timestamp + 1 hours;

        // Manually mark the intent as deposited using vm.store so we bypass
        // the deposit call (which would revert on the failing transferFrom).
        // The TradeIntent struct slot layout for intentId=intentId:
        //   intents mapping is at slot 5 (after 4 immutables/state vars + nextIntentId)
        //   We use getIntent to confirm the flag, then flip it via store.
        //
        // Simpler approach: use a DepositBypass harness.
        // We inherit HarnessIntentRegistry which already exposes intents[] storage.
        // Cast registry to HarnessIntentRegistry and call a bypass helper.
        //
        // Since we cannot modify existing files, we use a local bypass registry.
        BypassRegistry bypass = new BypassRegistry(address(router));
        bypass.registerPool(address(failToken), address(tokenOut), POOL);

        failToken.mint(USER, AMOUNT_IN);
        vm.prank(USER);
        failToken.approve(address(bypass), type(uint256).max);

        // Submit + reveal via bypass
        bytes32 secret = keccak256("bypass_secret");
        bytes32 hash = keccak256(
            abi.encodePacked(
                USER,
                address(failToken),
                address(tokenOut),
                AMOUNT_IN,
                TARGET_PRICE,
                MIN_AMOUNT_OUT,
                true,
                expiry,
                secret
            )
        );

        vm.prank(USER);
        bypass.submitIntent(hash, expiry);

        vm.prank(USER);
        bypass.revealIntent(
            0, address(failToken), address(tokenOut), AMOUNT_IN, TARGET_PRICE, MIN_AMOUNT_OUT, true, secret
        );

        // Force deposited = true without calling the real deposit
        bypass.forceDeposited(0);

        // Warp past expiry so cancel is allowed
        vm.warp(expiry + 1);

        // Now cancel — transfer() on failToken returns false → CancelTransferFailed
        vm.expectRevert(IntentRegistry.IntentRegistry__CancelTransferFailed.selector);
        vm.prank(USER);
        bypass.cancelIntent(0);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// BypassRegistry
//
// Thin subclass of IntentRegistry that exposes one extra function:
//   forceDeposited(intentId) — sets deposited=true without calling transferFrom
//
// Used ONLY in test_cancel_transferReturnsFalse_reverts to reach the
// CancelTransferFailed branch. Never deployed in production.
// ─────────────────────────────────────────────────────────────────────────────
contract BypassRegistry is IntentRegistry {
    constructor(address _router) IntentRegistry(_router) {}

    /// @dev Sets intent.deposited = true directly, bypassing transferFrom.
    function forceDeposited(uint256 intentId) external {
        intents[intentId].deposited = true;
    }
}
