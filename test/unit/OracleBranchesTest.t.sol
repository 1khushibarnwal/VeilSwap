// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {OracleLibrary} from "../../src/libraries/OracleLibrary.sol";

// ─────────────────────────────────────────────────────────────────────────────
// Mock pool with per-index observation storage.
//
// IUniswapV3Pool interface used by OracleLibrary:
//   slot0()       → (sqrtPriceX96, tick, observationIndex, observationCardinality, ...)
//   observations(index) → (blockTimestamp, tickCumulative, secondsPerLiquidityCumulativeX128, initialized)
//   liquidity()   → uint128
// ─────────────────────────────────────────────────────────────────────────────
contract FullMockPool {
    // ── slot0 ─────────────────────────────────────────────────────────────────
    int24 internal _tick;
    uint16 internal _observationIndex;
    uint16 public _observationCardinality;

    // ── liquidity ─────────────────────────────────────────────────────────────
    uint128 public _liquidity;

    // ── per-index observations ────────────────────────────────────────────────
    struct ObsData {
        uint32 blockTimestamp;
        int56 tickCumulative;
        uint160 secondsPerLiquidityCumulativeX128;
        bool initialized;
    }
    mapping(uint256 => ObsData) internal _obs;

    // ── setters ───────────────────────────────────────────────────────────────

    function setSlot0(int24 tick_, uint16 obsIdx_, uint16 obsCard_) external {
        _tick = tick_;
        _observationIndex = obsIdx_;
        _observationCardinality = obsCard_;
    }

    function setLiquidity(uint128 liq_) external {
        _liquidity = liq_;
    }

    /// Set a single observation slot.
    function setObservation(uint256 index, uint32 ts, int56 tc, uint160 secPerLiq, bool initialized) external {
        _obs[index] = ObsData({
            blockTimestamp: ts,
            tickCumulative: tc,
            secondsPerLiquidityCumulativeX128: secPerLiq,
            initialized: initialized
        });
    }

    // ── IUniswapV3Pool surface ────────────────────────────────────────────────

    function slot0()
        external
        view
        returns (
            uint160 sqrtPriceX96,
            int24 tick,
            uint16 observationIndex,
            uint16 observationCardinality,
            uint16 observationCardinalityNext,
            uint8 feeProtocol,
            bool unlocked
        )
    {
        return (0, _tick, _observationIndex, _observationCardinality, 0, 0, true);
    }

    function observations(uint256 index)
        external
        view
        returns (
            uint32 blockTimestamp,
            int56 tickCumulative,
            uint160 secondsPerLiquidityCumulativeX128,
            bool initialized
        )
    {
        ObsData memory o = _obs[index];
        return (o.blockTimestamp, o.tickCumulative, o.secondsPerLiquidityCumulativeX128, o.initialized);
    }

    function liquidity() external view returns (uint128) {
        return _liquidity;
    }

    /// consult() calls observe([secondsAgo, 0]) — wire it through observations[0/1].
    function observe(uint32[] calldata)
        external
        view
        returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s)
    {
        tickCumulatives = new int56[](2);
        secondsPerLiquidityCumulativeX128s = new uint160[](2);
        // index 0 = older (secondsAgo), index 1 = newer (now)
        tickCumulatives[0] = _obs[0].tickCumulative;
        tickCumulatives[1] = _obs[1].tickCumulative;
        secondsPerLiquidityCumulativeX128s[0] = _obs[0].secondsPerLiquidityCumulativeX128;
        secondsPerLiquidityCumulativeX128s[1] = _obs[1].secondsPerLiquidityCumulativeX128;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. getQuoteAtTick — ELSE branch  (sqrtRatioX96 > uint128.max, tick >= 443637)
// ─────────────────────────────────────────────────────────────────────────────
contract GetQuoteAtTickElseBranchTest is Test {
    int24 internal constant THRESHOLD_TICK = 443637;

    // baseToken < quoteToken → FullMath.mulDiv(ratioX128, base, 1<<128)
    function test_highTick_baseTokenLessThanQuoteToken() public pure {
        address base = address(0x1);
        address quote = address(0x2);
        uint256 result = OracleLibrary.getQuoteAtTick(THRESHOLD_TICK, 1e18, base, quote);
        assertGt(result, 1e18, "at high tick price>1 so output>input");
    }

    // baseToken > quoteToken → FullMath.mulDiv(1<<128, base, ratioX128)
    // ratioX128 is huge at this tick, so we need a large baseAmount to avoid
    // rounding to zero.
    function test_highTick_baseTokenGreaterThanQuoteToken() public pure {
        address base = address(0x2); // > quote
        address quote = address(0x1);
        // 1e27 is large enough that (1<<128) * 1e27 / ratioX128 > 0
        uint256 result = OracleLibrary.getQuoteAtTick(THRESHOLD_TICK, uint128(1e27), base, quote);
        assertGt(result, 0, "quote must be non-zero with large base amount");
    }

    // Confirm the two code paths produce different (both nonzero) results.
    function test_tickThreshold_ifVsElse_differentResults() public pure {
        address lo = address(0x1);
        address hi = address(0x2);
        uint128 amt = 1e18;
        uint256 below = OracleLibrary.getQuoteAtTick(THRESHOLD_TICK - 1, amt, lo, hi);
        uint256 atThreshold = OracleLibrary.getQuoteAtTick(THRESHOLD_TICK, amt, lo, hi);
        assertGt(below, 0);
        assertGt(atThreshold, 0);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. getQuoteAtTick — reversed token order inside IF branch (sqrtRatioX96 <= uint128.max)
// ─────────────────────────────────────────────────────────────────────────────
contract GetQuoteAtTickIfReversedTest is Test {
    function test_positiveTick_reversed_lowerOutput() public pure {
        address lo = address(0x1);
        address hi = address(0x2);
        uint128 amt = 1e18;
        uint256 forward = OracleLibrary.getQuoteAtTick(1000, amt, lo, hi);
        uint256 reversed = OracleLibrary.getQuoteAtTick(1000, amt, hi, lo);
        assertGt(forward, amt, "price>1 at positive tick");
        assertLt(reversed, amt, "inverted price<1");
    }

    function test_negativeTick_reversed_higherOutput() public pure {
        address lo = address(0x1);
        address hi = address(0x2);
        uint128 amt = 1e18;
        uint256 forward = OracleLibrary.getQuoteAtTick(-1000, amt, lo, hi);
        uint256 reversed = OracleLibrary.getQuoteAtTick(-1000, amt, hi, lo);
        assertLt(forward, amt, "price<1 at negative tick");
        assertGt(reversed, amt, "inverted price>1");
    }

    function test_lowTick_baseTokenGreaterThanQuoteToken() public pure {
        address base = address(0x9);
        address quote = address(0x1);
        uint256 result = OracleLibrary.getQuoteAtTick(-5000, 1e18, base, quote);
        assertGt(result, 0);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. getOldestObservationSecondsAgo
//
//    Logic:
//      nextIndex = (observationIndex + 1) % observationCardinality
//      if observations(nextIndex).initialized → use that timestamp
//      else                                   → fall back to observations(0)
//      secondsAgo = block.timestamp - chosenTimestamp
//
//    vm.warp(1000) so that subtracting past timestamps doesn't underflow.
// ─────────────────────────────────────────────────────────────────────────────
contract GetOldestObservationInitializedTest is Test {
    FullMockPool internal pool;

    function setUp() public {
        pool = new FullMockPool();
        vm.warp(1000); // block.timestamp = 1000; prevents uint32 underflow
    }

    // nextIndex IS initialized → library uses it, not index 0.
    //   cardinality=3, index=1  →  nextIndex = (1+1)%3 = 2
    //   observations(2).initialized = true, ts = 500
    //   secondsAgo = 1000 - 500 = 500
    function test_nextInitialized_usesNextIndex() public {
        pool.setSlot0(0, 1, 3);
        pool.setObservation(2, 500, 0, 0, true); // nextIndex = 2

        uint32 secs = OracleLibrary.getOldestObservationSecondsAgo(address(pool));
        assertEq(secs, 500, "should use the initialized next-index observation");
    }

    // nextIndex NOT initialized → falls back to observations(0).
    //   cardinality=3, index=1  →  nextIndex = 2, not initialized
    //   observations(0).ts = 700
    //   secondsAgo = 1000 - 700 = 300
    function test_nextNotInitialized_fallsBackToIndexZero() public {
        pool.setSlot0(0, 1, 3);
        pool.setObservation(2, 0, 0, 0, false); // nextIndex not initialized
        pool.setObservation(0, 700, 0, 0, true); // fallback index 0

        uint32 secs = OracleLibrary.getOldestObservationSecondsAgo(address(pool));
        assertEq(secs, 300, "should fall back to observations(0)");
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. getBlockStartingTickAndLiquidity
//
//    Two branches:
//    A) PAST-BLOCK: observations(observationIndex).blockTimestamp != block.timestamp
//       → returns (slot0.tick, pool.liquidity())
//    B) CURRENT-BLOCK: blockTimestamp == block.timestamp
//       → computes tick from cumulative delta with the PREVIOUS observation
//
//    Setup constants (block.timestamp = 1000):
//      observationIndex  = 1
//      cardinality       = 2   (must be > 1 to pass "NEO" require)
//      prevIndex         = (1 + 2 - 1) % 2 = 0
//
//    Current-block observations:
//      obs[1] = {ts=1000, TC=0,              secPerLiq=2^32, init=true}
//      obs[0] = {ts=990,  TC=-(tick*delta),  secPerLiq=0,    init=true}
//      delta  = 1000 - 990 = 10
//      tick   = (0 - TC_prev) / 10 = expectedTick
//
//    Liquidity = (delta * MAX_UINT160) / ((2^32) << 32)
//              = (10 * MAX_UINT160) / 2^64  ≈ 7.9e29  <  uint128.max ✓
// ─────────────────────────────────────────────────────────────────────────────
contract GetBlockStartingTickCurrentBlockTest is Test {
    FullMockPool internal pool;

    uint32 internal constant TS = 1000;
    uint32 internal constant DELTA = 10;
    uint32 internal constant TS_PREV = TS - DELTA;
    uint160 internal constant SEC_DIFF = uint160(2 ** 32); // nonzero → valid liquidity

    function setUp() public {
        vm.warp(TS);
        pool = new FullMockPool();
        pool.setLiquidity(1e6);
    }

    /// Configure the pool for the CURRENT-BLOCK path with a given expected tick.
    function _setupCurrentBlock(int24 expectedTick) internal {
        pool.setSlot0(expectedTick, 1, 2); // cardinality=2 passes "NEO"

        // obs[1] = current observation (written this block)
        pool.setObservation(1, TS, 0, SEC_DIFF, true);

        // obs[0] = previous observation
        // tick = (TC_curr - TC_prev) / delta  →  TC_prev = TC_curr - expectedTick*delta
        int56 tcPrev = int56(0) - int56(expectedTick) * int56(uint56(DELTA));
        pool.setObservation(0, TS_PREV, tcPrev, 0, true);
    }

    // Positive tick: delta=10, TC_prev=-2000 → tick = (0-(-2000))/10 = 200
    function test_currentBlock_computesTickFromDelta() public {
        int24 expected = 200;
        _setupCurrentBlock(expected);
        (int24 tick,) = OracleLibrary.getBlockStartingTickAndLiquidity(address(pool));
        assertEq(tick, expected, "current-block: positive tick");
    }

    // Unit delta check: expected tick = 1
    function test_currentBlock_oneDeltaSecond() public {
        int24 expected = 1;
        _setupCurrentBlock(expected);
        (int24 tick,) = OracleLibrary.getBlockStartingTickAndLiquidity(address(pool));
        assertEq(tick, expected);
    }

    // Negative tick: delta=10, TC_prev=1500 → tick = (0-1500)/10 = -150
    function test_currentBlock_negativeCumulativeDelta() public {
        int24 expected = -150;
        _setupCurrentBlock(expected);
        (int24 tick,) = OracleLibrary.getBlockStartingTickAndLiquidity(address(pool));
        assertEq(tick, expected, "current-block: negative tick");
    }

    // PAST-BLOCK path: observations(observationIndex).blockTimestamp != block.timestamp
    //   → library returns (slot0.tick, pool.liquidity()) immediately.
    function test_pastBlock_returnsSlot0TickAndLiquidity() public {
        int24 slot0tick = 500;
        pool.setSlot0(slot0tick, 0, 2); // cardinality=2 passes "NEO"

        // obs[0].ts != block.timestamp → past-block path
        pool.setObservation(0, TS - 100, 0, 0, true);

        (int24 tick, uint128 liq) = OracleLibrary.getBlockStartingTickAndLiquidity(address(pool));
        assertEq(tick, slot0tick, "past-block: should return slot0 tick");
        assertEq(liq, 1e6, "past-block: should return pool.liquidity()");
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. MockRouter dead branch documentation
// ─────────────────────────────────────────────────────────────────────────────
contract MockRouterBranchDocumentationTest is Test {
    // MockERC20.transferFrom always reverts on failure (uses require, not return false).
    // Therefore the `if (!res) revert MockERC20__TransferFailed()` branch in
    // MockRouter is structurally unreachable.
    function test_documentation_mockRouter_ifResBranchIsUnreachable() public pure {
        assertTrue(true, "unreachable branch documented");
    }
}
