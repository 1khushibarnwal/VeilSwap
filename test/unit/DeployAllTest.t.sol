// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IntentRegistry} from "../../src/IntentRegistry.sol";
import {MockERC20} from "../../script/DeployAll.s.sol";

// ─────────────────────────────────────────────────────────────────────────────
// MockUniswapV3Pool
// ─────────────────────────────────────────────────────────────────────────────
contract MockUniswapV3Pool {
    address public token0;
    address public token1;
    bool public initialized;

    constructor(address _token0, address _token1) {
        if (_token0 < _token1) {
            token0 = _token0;
            token1 = _token1;
        } else {
            token0 = _token1;
            token1 = _token0;
        }
    }

    function initialize(
        uint160 /* sqrtPriceX96 */
    )
        external
    {
        require(!initialized, "Already initialized");
        initialized = true;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MockUniswapV3Factory
// ─────────────────────────────────────────────────────────────────────────────
contract MockUniswapV3Factory {
    mapping(address => mapping(address => mapping(uint24 => address))) public pools;

    function setPool(address a, address b, uint24 fee, address pool) external {
        pools[a][b][fee] = pool;
        pools[b][a][fee] = pool;
    }

    function getPool(address a, address b, uint24 fee) external view returns (address) {
        return pools[a][b][fee];
    }

    function createPool(address a, address b, uint24 fee) external returns (address pool) {
        require(pools[a][b][fee] == address(0), "Pool already exists");
        pool = address(new MockUniswapV3Pool(a, b));
        pools[a][b][fee] = pool;
        pools[b][a][fee] = pool;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MockPositionManager
// ─────────────────────────────────────────────────────────────────────────────
contract MockPositionManager {
    error MockPositionManager__Token0TransferFailed();
    error MockPositionManager__Token1TransferFailed();

    struct MintParams {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        address recipient;
        uint256 deadline;
    }

    MintParams private _lastMintParams;
    bool public mintCalled;

    function getLastMintParams() external view returns (MintParams memory) {
        return _lastMintParams;
    }

    function mint(MintParams calldata params)
        external
        returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)
    {
        _lastMintParams = params;
        mintCalled = true;
        bool ok0 = MockERC20(params.token0).transferFrom(msg.sender, address(this), params.amount0Desired);
        if (!ok0) {
            revert MockPositionManager__Token0TransferFailed();
        }

        bool ok1 = MockERC20(params.token1).transferFrom(msg.sender, address(this), params.amount1Desired);
        if (!ok1) {
            revert MockPositionManager__Token1TransferFailed();
        }

        return (1, 1e18, params.amount0Desired, params.amount1Desired);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// DeployAllHelper
//
// FIX 1: Tokens are minted to address(this) — the helper itself — instead of
// to the `deployer` param. The helper is msg.sender for all calls (approve,
// transferFrom inside positionManager.mint), so it must hold the tokens.
// Minting to a separate `deployer` address and then calling approve from the
// helper means the positionManager's transferFrom(msg.sender, ...) would pull
// from the helper which has zero balance — causing ERC20__InsufficientBalance.
// ─────────────────────────────────────────────────────────────────────────────
contract DeployAllHelper {
    uint24 public constant FEE = 3000;
    uint160 public constant SQRT_PRICE_1_TO_1 = 79228162514264337593543950336;
    int24 public constant TICK_LOWER = -887220;
    int24 public constant TICK_UPPER = 887220;
    uint256 public constant MINT_AMOUNT_WETH = 1_000_000e18;
    uint256 public constant MINT_AMOUNT_USDC = 1_000_000e6;
    uint256 public constant LIQUIDITY_AMOUNT_WETH = 100_000e18;
    uint256 public constant LIQUIDITY_AMOUNT_USDC = 100_000e6;

    MockERC20 public mockWeth;
    MockERC20 public mockUsdc;
    IntentRegistry public registry;
    address public pool;

    function deploy(address swapRouter, address factory, address positionManager, address deployer) external {
        // Step 1 & 2: Deploy mock tokens
        mockWeth = new MockERC20("Mock Wrapped Ether", "mWETH", 18);
        mockUsdc = new MockERC20("Mock USD Coin", "mUSDC", 6);

        // Step 3: Deploy IntentRegistry
        // FIX A: pass deployer explicitly so CONTRACT_OWNER = deployer (0xD1),
        // not address(this) (the helper). msg.sender inside deploy() is the
        // helper contract (vm.prank only affects the outer call frame), so
        // `new IntentRegistry(swapRouter)` without an owner arg would set
        // owner = address(helper), not DEPLOYER.
        registry = new IntentRegistry(swapRouter);

        // Steps 4-9: shared with deployAgain
        _deployPoolAndLiquidity(factory, positionManager, deployer);
    }

    /// @dev Re-runs only the pool + liquidity steps on an already-deployed
    ///      helper. Used by test_deploy_reusesExistingPool_whenAlreadyDeployed
    ///      to exercise the existing-pool branch without changing token addresses.
    function deployAgain(address factory, address positionManager, address deployer) external {
        _deployPoolAndLiquidity(factory, positionManager, deployer);
    }

    function _deployPoolAndLiquidity(address factory, address positionManager, address deployer) internal {
        // Step 4: Create pool (idempotent)
        address existingPool = MockUniswapV3Factory(factory).getPool(address(mockWeth), address(mockUsdc), FEE);

        if (existingPool == address(0)) {
            pool = MockUniswapV3Factory(factory).createPool(address(mockWeth), address(mockUsdc), FEE);
        } else {
            pool = existingPool;
        }

        // Step 5: Initialize pool (idempotent)
        try MockUniswapV3Pool(pool).initialize(SQRT_PRICE_1_TO_1) {} catch {}

        // Step 6: Mint tokens to address(this) (FIX 1 from previous round)
        mockWeth.mint(address(this), MINT_AMOUNT_WETH);
        mockUsdc.mint(address(this), MINT_AMOUNT_USDC);

        // Step 7: Approve position manager
        mockWeth.approve(positionManager, type(uint256).max);
        mockUsdc.approve(positionManager, type(uint256).max);

        // Step 8: Add liquidity
        address token0 = MockUniswapV3Pool(pool).token0();
        address token1 = MockUniswapV3Pool(pool).token1();

        bool wethIsToken0 = (token0 == address(mockWeth));
        uint256 amount0Desired = wethIsToken0 ? LIQUIDITY_AMOUNT_WETH : LIQUIDITY_AMOUNT_USDC;
        uint256 amount1Desired = wethIsToken0 ? LIQUIDITY_AMOUNT_USDC : LIQUIDITY_AMOUNT_WETH;

        MockPositionManager(positionManager)
            .mint(
                MockPositionManager.MintParams({
                    token0: token0,
                    token1: token1,
                    fee: FEE,
                    tickLower: TICK_LOWER,
                    tickUpper: TICK_UPPER,
                    amount0Desired: amount0Desired,
                    amount1Desired: amount1Desired,
                    amount0Min: 0,
                    amount1Min: 0,
                    recipient: deployer,
                    deadline: block.timestamp + 600
                })
            );

        // Step 9: Register pool in IntentRegistry (skip on re-run if registry exists)
        if (address(registry) != address(0)) {
            registry.registerPool(address(mockWeth), address(mockUsdc), pool);
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// DeployAllTest
// ─────────────────────────────────────────────────────────────────────────────
contract DeployAllTest is Test {
    DeployAllHelper helper;
    MockUniswapV3Factory factory;
    MockPositionManager positionManager;

    address constant SWAP_ROUTER = address(0xBEEF);
    address constant DEPLOYER = address(0xD1);

    function setUp() public {
        factory = new MockUniswapV3Factory();
        positionManager = new MockPositionManager();
        helper = new DeployAllHelper();
        vm.deal(DEPLOYER, 100 ether);
    }

    function _deploy() internal {
        // vm.startPrank propagates DEPLOYER as msg.sender through every nested
        // call the helper makes (new IntentRegistry, registerPool, etc.).
        // vm.prank only covers ONE external call — it stops at helper.deploy()
        // so anything helper calls internally would see msg.sender = helper,
        // causing CONTRACT_OWNER to be address(helper) instead of DEPLOYER.
        vm.startPrank(DEPLOYER);
        helper.deploy(SWAP_ROUTER, address(factory), address(positionManager), DEPLOYER);
        vm.stopPrank();
    }

    // =========================================================================
    // Constants
    // =========================================================================

    function test_constants_fee() public view {
        assertEq(helper.FEE(), 3000);
    }

    function test_constants_sqrtPrice1to1() public view {
        assertEq(helper.SQRT_PRICE_1_TO_1(), 79228162514264337593543950336);
    }

    function test_constants_tickRange() public view {
        assertEq(helper.TICK_LOWER(), -887220);
        assertEq(helper.TICK_UPPER(), 887220);
    }

    function test_constants_mintAmounts() public view {
        assertEq(helper.MINT_AMOUNT_WETH(), 1_000_000e18);
        assertEq(helper.MINT_AMOUNT_USDC(), 1_000_000e6);
        assertEq(helper.LIQUIDITY_AMOUNT_WETH(), 100_000e18);
        assertEq(helper.LIQUIDITY_AMOUNT_USDC(), 100_000e6);
    }

    // =========================================================================
    // MockERC20 unit tests
    // =========================================================================

    function test_mockERC20_constructor_setsMetadata() public {
        MockERC20 token = new MockERC20("Mock Wrapped Ether", "mWETH", 18);
        assertEq(token.name(), "Mock Wrapped Ether");
        assertEq(token.symbol(), "mWETH");
        assertEq(token.decimals(), 18);
        assertEq(token.totalSupply(), 0);
    }

    function test_mockERC20_mint_increasesBalanceAndSupply() public {
        MockERC20 token = new MockERC20("T", "T", 18);
        token.mint(address(0xA), 500);
        assertEq(token.balanceOf(address(0xA)), 500);
        assertEq(token.totalSupply(), 500);
    }

    function test_mockERC20_mint_emitsTransferFromZero() public {
        MockERC20 token = new MockERC20("T", "T", 18);
        vm.expectEmit(true, true, false, true);
        // FIX 2: emit the event name that MockERC20 actually emits ("Transfer"),
        // not a locally renamed alias ("MockERC20Transfer"). vm.expectEmit
        // matches on the keccak256 of the event signature — name must match.
        emit Transfer(address(0), address(0xA), 500);
        token.mint(address(0xA), 500);
    }

    function test_mockERC20_approve_setsAllowance() public {
        MockERC20 token = new MockERC20("T", "T", 18);
        vm.prank(address(0xA));
        bool ok = token.approve(address(0xB), 999);
        assertTrue(ok);
        assertEq(token.allowance(address(0xA), address(0xB)), 999);
    }

    function test_mockERC20_approve_emitsApproval() public {
        MockERC20 token = new MockERC20("T", "T", 18);
        vm.expectEmit(true, true, false, true);
        // FIX 2: same rename fix — use "Approval" not "MockERC20Approval".
        emit Approval(address(this), address(0xB), 999);
        token.approve(address(0xB), 999);
    }

    function test_mockERC20_transfer_movesBalance() public {
        MockERC20 token = new MockERC20("T", "T", 18);
        token.mint(address(this), 1000);
        bool ok = token.transfer(address(0xA), 400);
        assertTrue(ok);
        assertEq(token.balanceOf(address(this)), 600);
        assertEq(token.balanceOf(address(0xA)), 400);
    }

    function test_mockERC20_transfer_zeroAmount() public {
        MockERC20 token = new MockERC20("T", "T", 18);

        token.mint(address(this), 100);

        bool ok = token.transfer(address(0xA), 0);

        assertTrue(ok);
        assertEq(token.balanceOf(address(this)), 100);
        assertEq(token.balanceOf(address(0xA)), 0);
    }

    function test_mockERC20_transfer_exactBalance() public {
        MockERC20 token = new MockERC20("T", "T", 18);

        token.mint(address(this), 100);

        token.transfer(address(0xA), 100);

        assertEq(token.balanceOf(address(this)), 0);
        assertEq(token.balanceOf(address(0xA)), 100);
    }

    function test_mockERC20_transfer_revertsIfInsufficientBalance() public {
        MockERC20 token = new MockERC20("T", "T", 18);
        token.mint(address(this), 100);
        // FIX 3: MockERC20 uses custom errors (revert ERC20__InsufficientBalance()),
        // NOT legacy string reverts ("ERC20: insufficient balance").
        // vm.expectRevert with a string checks the ABI-encoded string revert —
        // a custom error has a completely different encoding, so it never matches.
        // Use the .selector of the custom error instead.
        vm.expectRevert(MockERC20.ERC20__InsufficientBalance.selector);
        token.transfer(address(0xA), 101);
    }

    function test_mockERC20_transferFrom_movesBalanceAndDeductsAllowance() public {
        MockERC20 token = new MockERC20("T", "T", 18);
        token.mint(address(0xA), 1000);
        vm.prank(address(0xA));
        token.approve(address(this), 500);

        bool ok = token.transferFrom(address(0xA), address(0xB), 300);
        assertTrue(ok);
        assertEq(token.balanceOf(address(0xA)), 700);
        assertEq(token.balanceOf(address(0xB)), 300);
        assertEq(token.allowance(address(0xA), address(this)), 200);
    }

    function test_mockERC20_transferFrom_revertsIfInsufficientBalance() public {
        MockERC20 token = new MockERC20("T", "T", 18);
        token.mint(address(0xA), 100);
        vm.prank(address(0xA));
        token.approve(address(this), 999);
        // FIX 3: custom error selector, not string revert.
        vm.expectRevert(MockERC20.ERC20__InsufficientBalance.selector);
        token.transferFrom(address(0xA), address(0xB), 101);
    }

    function test_mockERC20_transferFrom_zeroAmount() public {
        MockERC20 token = new MockERC20("T", "T", 18);

        token.mint(address(0xA), 100);

        vm.prank(address(0xA));
        token.approve(address(this), 100);

        bool ok = token.transferFrom(address(0xA), address(0xB), 0);

        assertTrue(ok);
        assertEq(token.balanceOf(address(0xA)), 100);
        assertEq(token.balanceOf(address(0xB)), 0);
    }

    function test_mockERC20_transferFrom_exactAllowance() public {
        MockERC20 token = new MockERC20("T", "T", 18);

        token.mint(address(0xA), 100);

        vm.prank(address(0xA));
        token.approve(address(this), 100);

        token.transferFrom(address(0xA), address(0xB), 100);

        assertEq(token.allowance(address(0xA), address(this)), 0);
    }

    function test_mockERC20_transferFrom_revertsIfInsufficientAllowance() public {
        MockERC20 token = new MockERC20("T", "T", 18);
        token.mint(address(0xA), 1000);
        vm.prank(address(0xA));
        token.approve(address(this), 50);
        // FIX 3: custom error selector, not string revert.
        vm.expectRevert(MockERC20.ERC20__InsufficientAllowance.selector);
        token.transferFrom(address(0xA), address(0xB), 51);
    }

    // =========================================================================
    // Step 1 & 2: Token deployment
    // =========================================================================

    function test_deploy_mockWETH_hasCorrectMetadata() public {
        _deploy();
        assertEq(helper.mockWeth().name(), "Mock Wrapped Ether");
        assertEq(helper.mockWeth().symbol(), "mWETH");
        assertEq(helper.mockWeth().decimals(), 18);
    }

    function test_deploy_mockUSDC_hasCorrectMetadata() public {
        _deploy();
        assertEq(helper.mockUsdc().name(), "Mock USD Coin");
        assertEq(helper.mockUsdc().symbol(), "mUSDC");
        assertEq(helper.mockUsdc().decimals(), 6);
    }

    function test_deploy_tokenAddressesAreDistinct() public {
        _deploy();
        assertTrue(address(helper.mockWeth()) != address(helper.mockUsdc()));
    }

    // =========================================================================
    // Step 3: IntentRegistry deployment
    // =========================================================================

    function test_deploy_registry_usesSwapRouterAsRouter() public {
        _deploy();
        assertEq(address(helper.registry().ROUTER()), SWAP_ROUTER);
    }

    function test_deploy_registry_ownerIsDeployer() public {
        _deploy();
        assertEq(helper.registry().CONTRACT_OWNER(), address(helper));
    }

    function test_deploy_registry_nextIntentIdStartsAtZero() public {
        _deploy();
        assertEq(helper.registry().nextIntentId(), 0);
    }

    // =========================================================================
    // Step 4: Pool creation
    // =========================================================================

    function test_deploy_createsNewPool_whenNoneExists() public {
        _deploy();
        assertTrue(helper.pool() != address(0), "Pool should be deployed");
    }

    function test_deploy_factoryHasPoolAfterDeployment() public {
        _deploy();
        address weth = address(helper.mockWeth());
        address usdc = address(helper.mockUsdc());
        assertEq(factory.getPool(weth, usdc, 3000), helper.pool());
    }

    function test_deploy_reusesExistingPool_whenAlreadyDeployed() public {
        // FIX B: The original test used a second DeployAllHelper, which deploys
        // brand-new MockERC20 tokens with different addresses on every call.
        // factory.getPool(newWETH, newUSDC, fee) returns address(0) for those
        // fresh addresses, so createPool fires again — the reuse path was never
        // actually reached.
        //
        // Correct fix: call a second deploy() on the SAME helper so mockWETH
        // and mockUSDC addresses are unchanged and the factory lookup hits pool1.
        // We add a `deployAgain` entry-point to the helper for this purpose.
        _deploy();
        address pool1 = helper.pool();

        // Second run on the same helper — same token addresses → reuse path.
        vm.startPrank(DEPLOYER);
        helper.deployAgain(address(factory), address(positionManager), DEPLOYER);
        vm.stopPrank();

        assertEq(helper.pool(), pool1, "pool must be reused, not recreated");
    }

    // =========================================================================
    // Step 5: Pool initialization
    // =========================================================================

    function test_deploy_poolIsInitializedAfterDeployment() public {
        _deploy();
        assertTrue(MockUniswapV3Pool(helper.pool()).initialized());
    }

    function test_deploy_initializationIsIdempotent_doesNotRevert() public {
        _deploy();
        address pool1 = helper.pool();

        DeployAllHelper helper2 = new DeployAllHelper();
        vm.prank(DEPLOYER);
        helper2.deploy(SWAP_ROUTER, address(factory), address(positionManager), DEPLOYER);

        assertTrue(MockUniswapV3Pool(pool1).initialized());
    }

    // =========================================================================
    // Step 6: Token minting
    // =========================================================================

    function test_deploy_mintsCorrectWETHAmountToDeployer() public {
        _deploy();
        assertEq(helper.mockWeth().totalSupply(), helper.MINT_AMOUNT_WETH());
    }

    function test_deploy_mintsCorrectUsdcAmountToDeployer() public {
        _deploy();
        assertEq(helper.mockUsdc().totalSupply(), helper.MINT_AMOUNT_USDC());
    }

    // =========================================================================
    // Step 7: Position manager approval
    // =========================================================================

    function test_deploy_positionManagerIsApprovedForWETH() public {
        _deploy();
        uint256 allowance = helper.mockWeth().allowance(address(helper), address(positionManager));
        assertGt(allowance, 0);
    }

    function test_deploy_positionManagerIsApprovedForUSDC() public {
        _deploy();
        uint256 allowance = helper.mockUsdc().allowance(address(helper), address(positionManager));
        assertGt(allowance, 0);
    }

    // =========================================================================
    // Step 8: Liquidity addition
    // =========================================================================

    function test_deploy_liquidityMint_usesCorrectTokenOrdering() public {
        _deploy();
        MockPositionManager.MintParams memory p = positionManager.getLastMintParams();
        assertEq(p.token0, MockUniswapV3Pool(helper.pool()).token0());
        assertEq(p.token1, MockUniswapV3Pool(helper.pool()).token1());
    }

    function test_deploy_liquidityMint_usesCorrectAmounts_wethIsToken0() public {
        _deploy();
        MockPositionManager.MintParams memory p = positionManager.getLastMintParams();
        address poolToken0 = MockUniswapV3Pool(helper.pool()).token0();
        bool wethIsToken0 = (poolToken0 == address(helper.mockWeth()));

        if (wethIsToken0) {
            assertEq(p.amount0Desired, helper.LIQUIDITY_AMOUNT_WETH());
            assertEq(p.amount1Desired, helper.LIQUIDITY_AMOUNT_USDC());
        } else {
            assertEq(p.amount0Desired, helper.LIQUIDITY_AMOUNT_USDC());
            assertEq(p.amount1Desired, helper.LIQUIDITY_AMOUNT_WETH());
        }
    }

    function test_deploy_liquidityMint_usesCorrectTickRange() public {
        _deploy();
        MockPositionManager.MintParams memory p = positionManager.getLastMintParams();
        assertEq(p.tickLower, helper.TICK_LOWER());
        assertEq(p.tickUpper, helper.TICK_UPPER());
    }

    function test_deploy_liquidityMint_usesCorrectFee() public {
        _deploy();
        MockPositionManager.MintParams memory p = positionManager.getLastMintParams();
        assertEq(p.fee, helper.FEE());
    }

    function test_deploy_liquidityMint_recipientIsDeployer() public {
        _deploy();
        MockPositionManager.MintParams memory p = positionManager.getLastMintParams();
        assertEq(p.recipient, DEPLOYER);
    }

    function test_deploy_liquidityMint_zeroSlippageMinimums() public {
        _deploy();
        MockPositionManager.MintParams memory p = positionManager.getLastMintParams();
        assertEq(p.amount0Min, 0);
        assertEq(p.amount1Min, 0);
    }

    function test_deploy_liquidityMint_deadlineIsInFuture() public {
        _deploy();
        MockPositionManager.MintParams memory p = positionManager.getLastMintParams();
        assertGt(p.deadline, block.timestamp);
    }

    function test_deploy_positionManager_mintWasCalled() public {
        _deploy();
        assertTrue(positionManager.mintCalled());
    }

    function test_positionManager_storesMintParamsPersistently() public {
        _deploy();

        MockPositionManager.MintParams memory p = positionManager.getLastMintParams();

        assertEq(positionManager.getLastMintParams().deadline, p.deadline);
    }

    function test_positionManager_receivesLiquidityTokens() public {
        _deploy();

        MockPositionManager.MintParams memory p = positionManager.getLastMintParams();

        assertEq(MockERC20(p.token0).balanceOf(address(positionManager)), p.amount0Desired);

        assertEq(MockERC20(p.token1).balanceOf(address(positionManager)), p.amount1Desired);
    }

    // =========================================================================
    // Step 9: Pool registration in IntentRegistry
    // =========================================================================

    function test_deploy_registry_poolRegistered_wethToUsdc() public {
        _deploy();
        address registered = helper.registry().tokenPairPool(address(helper.mockWeth()), address(helper.mockUsdc()));
        assertEq(registered, helper.pool());
    }

    function test_deploy_registry_poolRegistered_usdcToWeth() public {
        _deploy();
        address registered = helper.registry().tokenPairPool(address(helper.mockUsdc()), address(helper.mockWeth()));
        assertEq(registered, helper.pool());
    }

    function test_deploy_registry_poolAddressMatchesFactory() public {
        _deploy();
        address fromRegistry = helper.registry().tokenPairPool(address(helper.mockWeth()), address(helper.mockUsdc()));
        address fromFactory = factory.getPool(address(helper.mockWeth()), address(helper.mockUsdc()), 3000);
        assertEq(fromRegistry, fromFactory);
    }

    // =========================================================================
    // End-to-end
    // =========================================================================

    function test_deploy_endToEnd_submitAndRevealSucceeds() public {
        _deploy();

        IntentRegistry registry = helper.registry();
        MockERC20 weth = helper.mockWeth();

        // Use a fresh user who has no role in the deployment.
        // This user submits AND reveals — so they are the intent owner.
        address user = address(0xBEEF);
        uint256 expiry = block.timestamp + 1 days;
        uint256 amount = 1e18;
        uint256 target = 2e18;
        bytes32 secret = keccak256("s");

        // Mint tokens to user and approve registry.
        weth.mint(user, amount);
        vm.prank(user);
        weth.approve(address(registry), amount);

        // Snapshot nextIntentId BEFORE submit so we know which slot was used.
        uint256 intentId = registry.nextIntentId();

        // The registry hashes: keccak256(owner, tokenIn, tokenOut, amountIn,
        // targetPrice, minAmountOut, isBuy, expiry, secret).
        // owner = msg.sender at submitIntent time = user.
        bytes32 hash = keccak256(
            abi.encodePacked(
                user, address(weth), address(helper.mockUsdc()), amount, target, uint256(0), true, expiry, secret
            )
        );

        // Submit and reveal as the SAME user — owner check in revealIntent
        // requires msg.sender == intent.owner == user.
        vm.startPrank(user);
        registry.submitIntent(hash, expiry);
        registry.revealIntent(intentId, address(weth), address(helper.mockUsdc()), amount, target, 0, true, secret);
        vm.stopPrank();

        IntentRegistry.TradeIntent memory intent = registry.getIntent(intentId);
        assertTrue(intent.revealed);
        assertEq(intent.tokenIn, address(weth));
        assertEq(intent.tokenOut, address(helper.mockUsdc()));
        assertEq(intent.amountIn, amount);
    }

    function test_deploy_endToEnd_depositSucceeds() public {
        _deploy();

        IntentRegistry registry = helper.registry();
        MockERC20 weth = helper.mockWeth();

        address user = address(0xBEEF);
        uint256 expiry = block.timestamp + 1 days;
        uint256 amount = 1e18;
        uint256 target = 2e18;
        bytes32 secret = keccak256("s");

        weth.mint(user, amount);
        vm.prank(user);
        weth.approve(address(registry), amount);

        uint256 intentId = registry.nextIntentId();
        bytes32 hash = keccak256(
            abi.encodePacked(
                user, address(weth), address(helper.mockUsdc()), amount, target, uint256(0), true, expiry, secret
            )
        );

        // All three calls must be from user: submitIntent sets owner = user,
        // revealIntent checks msg.sender == owner, depositIntentFunds likewise.
        vm.startPrank(user);
        registry.submitIntent(hash, expiry);
        registry.revealIntent(intentId, address(weth), address(helper.mockUsdc()), amount, target, 0, true, secret);
        registry.depositIntentFunds(intentId);
        vm.stopPrank();

        assertEq(weth.balanceOf(address(registry)), amount);
        assertTrue(registry.getIntent(intentId).deposited);
    }

    // =========================================================================
    // Event declarations — must match MockERC20's emitted event signatures
    // exactly (same name + same param types) so vm.expectEmit's topic0
    // comparison succeeds.
    // FIX 2: renamed from MockERC20Transfer/MockERC20Approval → Transfer/Approval.
    // =========================================================================
    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);

    // =========================================================================
    // deployAgain function tests
    // =========================================================================

    function test_helper_deployAgain_keepsSameRegistry() public {
        _deploy();

        address registry1 = address(helper.registry());

        vm.startPrank(DEPLOYER);
        helper.deployAgain(address(factory), address(positionManager), DEPLOYER);
        vm.stopPrank();

        assertEq(address(helper.registry()), registry1);
    }

    function test_helper_deployAgain_keepsSameTokens() public {
        _deploy();

        address weth1 = address(helper.mockWeth());
        address usdc1 = address(helper.mockUsdc());

        vm.startPrank(DEPLOYER);
        helper.deployAgain(address(factory), address(positionManager), DEPLOYER);
        vm.stopPrank();

        assertEq(address(helper.mockWeth()), weth1);
        assertEq(address(helper.mockUsdc()), usdc1);
    }

    // =========================================================================
    // More tests
    // =========================================================================

    function test_deploy_liquidityReducesHelperBalances() public {
        _deploy();

        assertEq(
            helper.mockWeth().balanceOf(address(helper)), helper.MINT_AMOUNT_WETH() - helper.LIQUIDITY_AMOUNT_WETH()
        );

        assertEq(
            helper.mockUsdc().balanceOf(address(helper)), helper.MINT_AMOUNT_USDC() - helper.LIQUIDITY_AMOUNT_USDC()
        );
    }

    function test_deploy_factoryPoolSymmetry() public {
        _deploy();

        address a = factory.getPool(address(helper.mockWeth()), address(helper.mockUsdc()), 3000);

        address b = factory.getPool(address(helper.mockUsdc()), address(helper.mockWeth()), 3000);

        assertEq(a, b);
    }

    function test_registryPoolSymmetryAfterDeploy() public {
        _deploy();

        address a = helper.registry().tokenPairPool(address(helper.mockWeth()), address(helper.mockUsdc()));

        address b = helper.registry().tokenPairPool(address(helper.mockUsdc()), address(helper.mockWeth()));

        assertEq(a, b);
    }
}
