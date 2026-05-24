// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {IntentRegistry} from "../src/IntentRegistry.sol";

// ─────────────────────────────────────────────────────────────────────────────
// Minimal interfaces — only what the deployment needs
// ─────────────────────────────────────────────────────────────────────────────

interface IUniswapV3Factory {
    function createPool(address tokenA, address tokenB, uint24 fee) external returns (address pool);

    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool);
}

interface IUniswapV3Pool {
    function initialize(uint160 sqrtPriceX96) external;
    function token0() external view returns (address);
    function token1() external view returns (address);
}

interface INonfungiblePositionManager {
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

    function mint(MintParams calldata params)
        external
        returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1);
}

interface IMockERC20 {
    function mint(address to, uint256 amount) external;
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

// ─────────────────────────────────────────────────────────────────────────────
// MockERC20
// Deployed fresh by this script — testnet only.
// On mainnet this contract is never deployed; real token addresses are used.
// ─────────────────────────────────────────────────────────────────────────────
contract MockERC20 {
    error ERC20__InsufficientBalance();
    error ERC20__InsufficientAllowance();

    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);

    constructor(string memory _name, string memory _symbol, uint8 _decimals) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
    }

    /// @dev Permissionless mint — testnet only. Never deploy this on mainnet.
    function mint(address to, uint256 amount) external {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        if (balanceOf[msg.sender] < amount) {
            revert ERC20__InsufficientBalance();
        }
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (balanceOf[from] < amount) {
            revert ERC20__InsufficientBalance();
        }
        if (allowance[from][msg.sender] < amount) {
            revert ERC20__InsufficientAllowance();
        }
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// DeployAll
//
// What this script does (in order):
//   1. Deploy MockWETH  (18 decimals — mirrors real WETH)
//   2. Deploy MockUSDC  (6  decimals — mirrors real USDC)
//   3. Deploy IntentRegistry with the real Uniswap V2-compatible SwapRouter
//   4. Create a real Uniswap V3 pool for MockWETH/MockUSDC at 0.3% fee
//   5. Initialize the pool at 1:1 price
//   6. Mint demo tokens to the deployer
//   7. Approve the NonfungiblePositionManager for both tokens
//   8. Add full-range liquidity so the TWAP oracle has data to record
//   9. Register the pool in IntentRegistry
//  10. Print a deployment summary
//
// ⚠️  TWAP WARNING: After this script completes, wait AT LEAST 30 minutes
//     before calling executeIntent. The Uniswap V3 oracle needs 1800 seconds
//     of observation history (TWAP_INTERVAL in IntentRegistry). Calling
//     executeIntent before that will revert with an observation error.
//
// ─────────────────────────────────────────────────────────────────────────────

contract DeployAll is Script {
    // ── Arbitrum Sepolia — Uniswap V3 infrastructure ─────────────────────────
    // These are the REAL Uniswap V3 contracts on Arbitrum Sepolia.
    // No mocks — the oracle and router are the genuine article.
    address internal constant UNISWAP_V3_FACTORY = 0x248AB79Bbb9bC29bB72f7Cd42F17e054Fc40188e;
    address internal constant SWAP_ROUTER = 0x101F443B4d1b059569D643917553c771E1b9663E;
    address internal constant POSITION_MANAGER = 0x6b2937Bde17889EDCf8fbD8dE31C3C2a70Bc4d65;

    // ── Pool parameters ───────────────────────────────────────────────────────
    uint24 internal constant FEE = 3000; // 0.3%

    // sqrtPriceX96 for a 1:1 price ratio = sqrt(1) * 2^96 = 2^96
    // This sets MockWETH and MockUSDC at equal value for the demo.
    // In a real deployment, this would be set to reflect the actual market price.
    uint160 internal constant SQRT_PRICE_1_TO_1 = 79228162514264337593543950336;

    // ── Tick range for full-range liquidity ───────────────────────────────────
    // Uniswap V3 requires tick spacing of 60 for 0.3% pools.
    // TickMath.MIN_TICK = -887272, MAX_TICK = 887272
    // Rounded to nearest 60: -887220 and 887220
    int24 internal constant TICK_LOWER = -887220;
    int24 internal constant TICK_UPPER = 887220;

    // ── Liquidity amounts ─────────────────────────────────────────────────────
    // Mint 1,000,000 of each token to the deployer.
    // Add 100,000 of each as liquidity — enough for a stable TWAP.
    // The remaining 900,000 stays in the deployer wallet for demo transactions.
    uint256 internal constant MINT_AMOUNT_WETH = 1_000_000e18; // 18 decimals
    uint256 internal constant MINT_AMOUNT_USDC = 1_000_000e6; // 6  decimals
    uint256 internal constant LIQUIDITY_AMOUNT_WETH = 100_000e18;
    uint256 internal constant LIQUIDITY_AMOUNT_USDC = 100_000e6;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        console.log("==============================================");
        console.log("  [PROJECT_NAME] Full Deployment");
        console.log("  Network : Arbitrum Sepolia");
        console.log("  Deployer:", deployer);
        console.log("==============================================\n");

        vm.startBroadcast(deployerKey);

        // ── Step 1 & 2: Deploy mock tokens ───────────────────────────────────
        // 18 decimals for WETH mirrors real WETH.
        // 6  decimals for USDC mirrors real USDC.
        // Keeping the decimals authentic makes the demo feel production-like
        // and means targetPrice values make intuitive sense to judges.
        MockERC20 mockWeth = new MockERC20("Mock Wrapped Ether", "mWETH", 18);
        MockERC20 mockUsdc = new MockERC20("Mock USD Coin", "mUSDC", 6);

        console.log("Step 1/9 | MockWETH deployed:    ", address(mockWeth));
        console.log("Step 2/9 | MockUSDC deployed:    ", address(mockUsdc));

        // ── Step 3: Deploy IntentRegistry with the REAL Uniswap swap router ──
        IntentRegistry registry = new IntentRegistry(SWAP_ROUTER);

        console.log("Step 3/9 | IntentRegistry deployed:", address(registry));

        // ── Step 4: Create the Uniswap V3 pool ───────────────────────────────
        // getPool first — if a pool already exists for this pair+fee on this
        // run's fork, createPool would revert. Safe to check.
        address existingPool = IUniswapV3Factory(UNISWAP_V3_FACTORY).getPool(address(mockWeth), address(mockUsdc), FEE);

        address pool;
        if (existingPool == address(0)) {
            pool = IUniswapV3Factory(UNISWAP_V3_FACTORY).createPool(address(mockWeth), address(mockUsdc), FEE);
            console.log("Step 4/9 | Uniswap V3 pool created:", pool);
        } else {
            pool = existingPool;
            console.log("Step 4/9 | Uniswap V3 pool already exists:", pool);
        }

        // ── Step 5: Initialize the pool at 1:1 price ─────────────────────────
        // initialize() reverts if already called, so we wrap it.
        // A pool that is already initialized means we're re-running the script
        // after a partial failure — safe to skip.
        try IUniswapV3Pool(pool).initialize(SQRT_PRICE_1_TO_1) {
            console.log("Step 5/9 | Pool initialized at 1:1 price");
        } catch {
            console.log("Step 5/9 | Pool already initialized skipping");
        }

        // ── Step 6: Mint demo tokens to deployer ─────────────────────────────
        // Testnet only — permissionless mint on MockERC20.
        // This is ethically fine: these are not real assets.
        // On mainnet this step is removed entirely; real tokens are used.
        mockWeth.mint(deployer, MINT_AMOUNT_WETH);
        mockUsdc.mint(deployer, MINT_AMOUNT_USDC);

        console.log("Step 6/9 | Minted to deployer:");
        console.log("         |   mWETH:", MINT_AMOUNT_WETH / 1e18, "tokens");
        console.log("         |   mUSDC:", MINT_AMOUNT_USDC / 1e6, "tokens");

        // ── Step 7: Approve position manager ─────────────────────────────────
        // The NonfungiblePositionManager pulls tokens when adding liquidity.
        mockWeth.approve(POSITION_MANAGER, type(uint256).max);
        mockUsdc.approve(POSITION_MANAGER, type(uint256).max);

        console.log("Step 7/9 | Approved NonfungiblePositionManager");

        // ── Step 8: Add full-range liquidity ─────────────────────────────────
        // Uniswap V3 requires token0 < token1 by address sort order.
        // The position manager handles the sort internally but we must pass
        // amounts in the right order matching token0/token1.
        address token0 = IUniswapV3Pool(pool).token0();
        address token1 = IUniswapV3Pool(pool).token1();

        bool wethIsToken0 = (token0 == address(mockWeth));

        uint256 amount0Desired = wethIsToken0 ? LIQUIDITY_AMOUNT_WETH : LIQUIDITY_AMOUNT_USDC;
        uint256 amount1Desired = wethIsToken0 ? LIQUIDITY_AMOUNT_USDC : LIQUIDITY_AMOUNT_WETH;

        // Mint a full-range position so the TWAP has observation history
        // across the entire tick range — no risk of the price going out of range
        // during the 30-minute warm-up window before the demo.
        INonfungiblePositionManager(POSITION_MANAGER)
            .mint(
                INonfungiblePositionManager.MintParams({
                    token0: token0,
                    token1: token1,
                    fee: FEE,
                    tickLower: TICK_LOWER,
                    tickUpper: TICK_UPPER,
                    amount0Desired: amount0Desired,
                    amount1Desired: amount1Desired,
                    amount0Min: 0, // no slippage protection needed on testnet
                    amount1Min: 0,
                    recipient: deployer,
                    deadline: block.timestamp + 600
                })
            );

        console.log("Step 8/9 | Full-range liquidity added:");
        console.log("         |   token0:", token0);
        console.log("         |   token1:", token1);

        // ── Step 9: Register the pool in IntentRegistry ───────────────────────
        // registerPool stores both directions (A→B and B→A) so revealIntent
        // works regardless of which token the user treats as tokenIn.
        registry.registerPool(address(mockWeth), address(mockUsdc), pool);

        console.log("Step 9/9 | Pool registered in IntentRegistry");

        vm.stopBroadcast();

        // ── Deployment summary ────────────────────────────────────────────────
        console.log("\n==============================================");
        console.log("  DEPLOYMENT SUMMARY");
        console.log("==============================================");
        console.log("  Network:          Arbitrum Sepolia (421614)");
        console.log("  Deployer:        ", deployer);
        console.log("  SwapRouter:      ", SWAP_ROUTER);
        console.log("  IntentRegistry:  ", address(registry));
        console.log("  MockWETH:        ", address(mockWeth));
        console.log("  MockUSDC:        ", address(mockUsdc));
        console.log("  Uniswap V3 Pool: ", pool);
        console.log("==============================================");
        console.log("");
        console.log("  !! IMPORTANT READ BEFORE DEMOING !!");
        console.log("  Wait 30 minutes (1800 seconds) after this");
        console.log("  deployment before calling executeIntent.");
        console.log("  The TWAP oracle needs observation history.");
        console.log("==============================================");
    }
}
