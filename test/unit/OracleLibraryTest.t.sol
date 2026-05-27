// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {OracleLibrary} from "../../src/libraries/OracleLibrary.sol";
import {TickMath} from "../../src/libraries/TickMath.sol";

/*//////////////////////////////////////////////////////////////
                        MOCK POOL
//////////////////////////////////////////////////////////////*/

/// @dev Unified mock that satisfies both the array-based observe() API used by
///      OracleLibrary and the index-addressable observations() API used by
///      getBlockStartingTickAndLiquidity / getOldestObservationSecondsAgo.
contract MockUniswapV3Pool {
    struct Observation {
        uint32 blockTimestamp;
        int56 tickCumulative;
        uint160 secondsPerLiquidityCumulativeX128;
        bool initialized;
    }

    // Returned verbatim by observe()
    int56[] internal _tickCumulatives;
    uint160[] internal _secondsPerLiquidityCumulatives;

    // Returned by slot0()
    int24 internal _slot0Tick;
    uint16 internal _slot0ObsIndex;
    uint16 internal _slot0ObsCardinality;

    // Returned by observations(i)
    Observation[] internal _observations;

    // Returned by liquidity()
    uint128 internal _liquidity;

    // ── Setup helpers ──────────────────────────────────────────────────────────

    /// @dev Set the two-element arrays returned by observe().
    function setObserveData(int56[] calldata tcs, uint160[] calldata sps) external {
        delete _tickCumulatives;
        delete _secondsPerLiquidityCumulatives;
        for (uint256 i; i < tcs.length; i++) {
            _tickCumulatives.push(tcs[i]);
        }
        for (uint256 i; i < sps.length; i++) {
            _secondsPerLiquidityCumulatives.push(sps[i]);
        }
    }

    /// @dev Convenience wrapper matching the two-scalar signature used in suite 1.
    function setObserve(int56 a, int56 b, uint160 c, uint160 d) external {
        delete _tickCumulatives;
        delete _secondsPerLiquidityCumulatives;
        _tickCumulatives.push(a);
        _tickCumulatives.push(b);
        _secondsPerLiquidityCumulatives.push(c);
        _secondsPerLiquidityCumulatives.push(d);
    }

    function setSlot0(int24 tick, uint16 obsIndex, uint16 obsCardinality) external {
        _slot0Tick = tick;
        _slot0ObsIndex = obsIndex;
        _slot0ObsCardinality = obsCardinality;
    }

    /// @dev Push one observation; index equals the current array length before the push.
    function pushObservation(uint32 ts, int56 tickCumulative, uint160 spLiq, bool init) external {
        _observations.push(
            Observation({
                blockTimestamp: ts,
                tickCumulative: tickCumulative,
                secondsPerLiquidityCumulativeX128: spLiq,
                initialized: init
            })
        );
    }

    function clearObservations() external {
        delete _observations;
    }

    function setLiquidity(uint128 liq) external {
        _liquidity = liq;
    }

    // ── IUniswapV3Pool stubs ───────────────────────────────────────────────────

    function observe(uint32[] calldata) external view returns (int56[] memory tc, uint160[] memory lc) {
        tc = new int56[](_tickCumulatives.length);
        lc = new uint160[](_secondsPerLiquidityCumulatives.length);
        for (uint256 i; i < tc.length; i++) {
            tc[i] = _tickCumulatives[i];
        }
        for (uint256 i; i < lc.length; i++) {
            lc[i] = _secondsPerLiquidityCumulatives[i];
        }
    }

    function slot0() external view returns (uint160, int24, uint16, uint16, uint16, uint8, bool) {
        return (0, _slot0Tick, _slot0ObsIndex, _slot0ObsCardinality, 0, 0, false);
    }

    function observations(uint256 i) external view returns (uint32, int56, uint160, bool) {
        if (i >= _observations.length) return (0, 0, 0, false);
        Observation memory o = _observations[i];
        return (o.blockTimestamp, o.tickCumulative, o.secondsPerLiquidityCumulativeX128, o.initialized);
    }

    function liquidity() external view returns (uint128) {
        return _liquidity;
    }
}

/*//////////////////////////////////////////////////////////////
                     LIBRARY WRAPPER
//////////////////////////////////////////////////////////////*/

/// @dev Foundry cannot call internal library functions from tests directly.
///      This thin wrapper exposes them as external so test contracts can call
///      them like any normal contract method.
contract OracleLibraryWrapper {
    function consult(address pool, uint32 secondsAgo)
        external
        view
        returns (int24 arithmeticMeanTick, uint128 harmonicMeanLiquidity)
    {
        return OracleLibrary.consult(pool, secondsAgo);
    }

    function getQuoteAtTick(int24 tick, uint128 baseAmount, address baseToken, address quoteToken)
        external
        pure
        returns (uint256 quoteAmount)
    {
        return OracleLibrary.getQuoteAtTick(tick, baseAmount, baseToken, quoteToken);
    }

    function getOldestObservationSecondsAgo(address pool) external view returns (uint32 secondsAgo) {
        return OracleLibrary.getOldestObservationSecondsAgo(pool);
    }

    function getBlockStartingTickAndLiquidity(address pool) external view returns (int24 tick, uint128 liq) {
        return OracleLibrary.getBlockStartingTickAndLiquidity(pool);
    }

    function getWeightedArithmeticMeanTick(OracleLibrary.WeightedTickData[] memory weightedTickData)
        external
        pure
        returns (int24 weightedArithmeticMeanTick)
    {
        return OracleLibrary.getWeightedArithmeticMeanTick(weightedTickData);
    }

    function getChainedPrice(address[] memory tokens, int24[] memory ticks)
        external
        pure
        returns (int256 syntheticTick)
    {
        return OracleLibrary.getChainedPrice(tokens, ticks);
    }
}

/*//////////////////////////////////////////////////////////////
                        BASE SETUP
//////////////////////////////////////////////////////////////*/

contract OracleLibraryBase is Test {
    OracleLibraryWrapper internal oracle;
    MockUniswapV3Pool internal pool;

    // Sorted so addrA < addrB for directional tests.
    address internal addrA = address(0x1111);
    address internal addrB = address(0x2222);

    function setUp() public virtual {
        oracle = new OracleLibraryWrapper();
        pool = new MockUniswapV3Pool();
        assertTrue(addrA < addrB, "addrA must be < addrB");
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /// @dev Configure the two-element arrays returned by observe().
    ///      tc0/sp0 = older observation (secondsAgo), tc1/sp1 = current (0).
    function _setObserve(int56 tc0, int56 tc1, uint160 sp0, uint160 sp1) internal {
        int56[] memory tcs = new int56[](2);
        uint160[] memory sps = new uint160[](2);
        tcs[0] = tc0;
        tcs[1] = tc1;
        sps[0] = sp0;
        sps[1] = sp1;
        pool.setObserveData(tcs, sps);
    }

    function _pushObservation(uint32 ts, int56 tickCumulative, uint160 spLiq, bool init) internal {
        pool.pushObservation(ts, tickCumulative, spLiq, init);
    }
}

/*//////////////////////////////////////////////////////////////
                        consult()
//////////////////////////////////////////////////////////////*/

contract ConsultTest is OracleLibraryBase {
    // ── Revert cases ──────────────────────────────────────────────────────────

    function test_revert_secondsAgoZero() public {
        vm.expectRevert(bytes("BP"));
        oracle.consult(address(pool), 0);
    }

    // ── Tick rounding ─────────────────────────────────────────────────────────

    function test_positiveTickDelta_exactDivision() public {
        // tickCumulative went from 0 → 600 over 60 s → mean tick = 10
        _setObserve(0, 600, 0, uint160(1) << 32);
        (int24 meanTick,) = oracle.consult(address(pool), 60);
        assertEq(meanTick, 10);
    }

    function test_positiveTickDelta_truncatesDown() public {
        // 61 / 60 truncates to 1 (positive: truncation == floor)
        _setObserve(0, 61, 0, uint160(1) << 32);
        (int24 meanTick,) = oracle.consult(address(pool), 60);
        assertEq(meanTick, 1);
    }

    /// @dev Ported from suite 1: starts from a negative tickCumulative baseline.
    ///      delta = 0 − (−11) = 11 over 10 s → tick = 1 (positive path, no rounding).
    function test_positiveTickDelta_negativeBaselineCumulative() public {
        pool.setObserve(-11, 0, 1, 2);
        (int24 tick,) = oracle.consult(address(pool), 10);
        assertEq(tick, 1);
    }

    function test_negativeTickDelta_exactDivision() public {
        // −600 / 60 = −10, no rounding needed
        _setObserve(0, -600, 0, uint160(1) << 32);
        (int24 meanTick,) = oracle.consult(address(pool), 60);
        assertEq(meanTick, -10);
    }

    function test_negativeTickDelta_exactDivision_noExtraRound() public {
        // −60 / 60 = −1 exactly
        _setObserve(0, -60, 0, uint160(1) << 32);
        (int24 meanTick,) = oracle.consult(address(pool), 60);
        assertEq(meanTick, -1);
    }

    function test_negativeTickDelta_roundsDownToNegInfinity() public {
        // −61 / 60 = −1.016... → floor = −2
        _setObserve(0, -61, 0, uint160(1) << 32);
        (int24 meanTick,) = oracle.consult(address(pool), 60);
        assertEq(meanTick, -2, "should round toward negative infinity");
    }

    /// @dev Minimum valid secondsAgo.
    function test_secondsAgo_one() public {
        _setObserve(0, 5, 0, uint160(1) << 32);
        (int24 meanTick,) = oracle.consult(address(pool), 1);
        assertEq(meanTick, 5);
    }

    // ── Harmonic mean liquidity ───────────────────────────────────────────────

    function test_harmonicMeanLiquidity_nonZero() public {
        _setObserve(0, 1000, 0, uint160(1) << 32);
        (, uint128 liq) = oracle.consult(address(pool), 100);
        assertGt(liq, 0, "liquidity should be non-zero");
    }

    function test_harmonicMeanLiquidity_largerDeltaGivesLowerLiquidity() public {
        _setObserve(0, 600, 0, uint160(1) << 33);
        (, uint128 liqLarge) = oracle.consult(address(pool), 60);

        _setObserve(0, 600, 0, uint160(1) << 32);
        (, uint128 liqSmall) = oracle.consult(address(pool), 60);

        assertGt(liqSmall, liqLarge, "smaller spLiq delta higher liquidity");
    }
}

/*//////////////////////////////////////////////////////////////
                    consult() FUZZ TESTS
//////////////////////////////////////////////////////////////*/

contract ConsultFuzzTest is OracleLibraryBase {
    function testFuzz_consult_meanTickRoundingIsFloor(int56 tickDelta, uint32 secondsAgo) public {
        secondsAgo = uint32(bound(secondsAgo, 1, 3600));
        tickDelta = int56(bound(tickDelta, -887272 * int56(uint56(secondsAgo)), 887272 * int56(uint56(secondsAgo))));

        _setObserve(0, tickDelta, 0, uint160(1) << 32);
        (int24 meanTick,) = oracle.consult(address(pool), secondsAgo);

        // Manual floor division
        int256 exact = int256(tickDelta) / int256(uint256(secondsAgo));
        bool hasRemainder = tickDelta < 0 && (tickDelta % int56(uint56(secondsAgo)) != 0);
        int256 expected = hasRemainder ? exact - 1 : exact;

        assertEq(int256(meanTick), expected, "meanTick must match floor division");
    }

    function testFuzz_consult_meanTickWithinValidRange(int56 tickDelta, uint32 secondsAgo) public {
        secondsAgo = uint32(bound(secondsAgo, 1, 3600));
        tickDelta = int56(bound(tickDelta, -887272 * int56(uint56(secondsAgo)), 887272 * int56(uint56(secondsAgo))));

        _setObserve(0, tickDelta, 0, uint160(1) << 32);
        (int24 meanTick,) = oracle.consult(address(pool), secondsAgo);

        assertGe(int256(meanTick), int256(TickMath.MIN_TICK) - 1, "tick below MIN");
        assertLe(int256(meanTick), int256(TickMath.MAX_TICK), "tick above MAX");
    }
}

/*//////////////////////////////////////////////////////////////
                    getQuoteAtTick()
//////////////////////////////////////////////////////////////*/

contract GetQuoteAtTickTest is OracleLibraryBase {
    // ── Basic correctness ─────────────────────────────────────────────────────

    function test_tick0_returnsBaseAmount_tokenABase() public view {
        // At tick 0, sqrtRatio = 2^96 → 1:1 price
        uint256 quote = oracle.getQuoteAtTick(0, 1e18, addrA, addrB);
        assertEq(quote, 1e18, "tick 0, addrA<addrB: should be 1:1");
    }

    function test_tick0_returnsBaseAmount_tokenBBase() public view {
        uint256 quote = oracle.getQuoteAtTick(0, 1e18, addrB, addrA);
        assertEq(quote, 1e18, "tick 0, addrB>addrA: should also be 1:1");
    }

    function test_positiveTick_addrABase_higherQuote() public view {
        // Positive tick → token0 (addrA) worth more in terms of token1 (addrB)
        uint256 quoteTick0 = oracle.getQuoteAtTick(0, 1e18, addrA, addrB);
        uint256 quoteTick1 = oracle.getQuoteAtTick(1000, 1e18, addrA, addrB);
        assertGt(quoteTick1, quoteTick0, "higher tick more quoteToken per base");
    }

    // ── Boundary & edge cases ─────────────────────────────────────────────────

    function test_minTick_doesNotRevert() public view {
        oracle.getQuoteAtTick(TickMath.MIN_TICK, 1e18, addrA, addrB);
    }

    function test_maxTick_doesNotRevert() public view {
        oracle.getQuoteAtTick(TickMath.MAX_TICK, 1e18, addrA, addrB);
    }

    function test_largeBaseAmount_doesNotRevert() public view {
        oracle.getQuoteAtTick(0, type(uint128).max, addrA, addrB);
    }

    function test_zeroBaseAmount_returnsZero() public view {
        assertEq(oracle.getQuoteAtTick(0, 0, addrA, addrB), 0);
    }

    /// @dev Exercises both token-ordering branches in a single call sequence.
    function test_bothTokenOrderingBranches() public view {
        oracle.getQuoteAtTick(0, 1e18, addrA, addrB); // addrA < addrB
        oracle.getQuoteAtTick(500000, 1e18, addrB, addrA); // addrB > addrA
    }

    // ── Fuzz ─────────────────────────────────────────────────────────────────

    /// @dev Monotonicity: quote is non-decreasing in tick when baseToken < quoteToken.
    function testFuzz_getQuoteAtTick_monotone_addrABase(int24 tick1, int24 tick2) public view {
        tick1 = int24(bound(tick1, TickMath.MIN_TICK, TickMath.MAX_TICK - 1));
        tick2 = int24(bound(tick2, tick1 + 1, TickMath.MAX_TICK));

        uint256 q1 = oracle.getQuoteAtTick(tick1, 1e18, addrA, addrB);
        uint256 q2 = oracle.getQuoteAtTick(tick2, 1e18, addrA, addrB);
        assertLe(q1, q2, "quote should be non-decreasing in tick");
    }

    /// @dev At tick 0 the ratio is exactly 1:1, so doubling the base doubles the quote.
    function testFuzz_getQuoteAtTick_scaling(uint128 base) public view {
        vm.assume(base > 0 && base <= type(uint128).max / 2);
        uint256 q1 = oracle.getQuoteAtTick(0, base, addrA, addrB);
        uint256 q2 = oracle.getQuoteAtTick(0, base * 2, addrA, addrB);
        assertEq(q2, q1 * 2);
    }
}

/*//////////////////////////////////////////////////////////////
               getOldestObservationSecondsAgo()
//////////////////////////////////////////////////////////////*/

contract GetOldestObservationSecondsAgoTest is OracleLibraryBase {
    // ── Revert cases ──────────────────────────────────────────────────────────

    function test_revert_cardinalityZero() public {
        pool.setSlot0(0, 0, 0);
        vm.expectRevert(bytes("NI"));
        oracle.getOldestObservationSecondsAgo(address(pool));
    }

    // ── Happy paths ───────────────────────────────────────────────────────────

    function test_singleObservation_wrapsToSelf() public {
        // cardinality=1, obsIndex=0 → next = (0+1)%1 = 0 → same slot → initialized
        uint32 oldTs = 1000;
        pool.setSlot0(0, 0, 1);
        _pushObservation(oldTs, 0, 0, true);

        vm.warp(2000);
        assertEq(oracle.getOldestObservationSecondsAgo(address(pool)), 2000 - oldTs);
    }

    function test_multipleObservations_nextInitialized() public {
        // cardinality=2, obsIndex=1 → next = (1+1)%2 = 0 → initialized → oldest
        uint32 oldTs = 500;
        pool.setSlot0(0, 1, 2);
        _pushObservation(oldTs, 0, 0, true); // index 0 (oldest)
        _pushObservation(900, 0, 0, true); // index 1 (current)

        vm.warp(1000);
        assertEq(oracle.getOldestObservationSecondsAgo(address(pool)), 1000 - oldTs);
    }

    function test_multipleObservations_nextUninitialized_fallsBackToIndex0() public {
        // cardinality=2, obsIndex=0 → next = (0+1)%2 = 1 → NOT initialized → fallback to 0
        uint32 ts0 = 300;
        pool.setSlot0(0, 0, 2);
        _pushObservation(ts0, 0, 0, true); // index 0
        _pushObservation(0, 0, 0, false); // index 1 — uninitialized

        vm.warp(1000);
        assertEq(oracle.getOldestObservationSecondsAgo(address(pool)), 1000 - ts0);
    }

    // ── Fuzz ─────────────────────────────────────────────────────────────────

    function testFuzz_secondsAgoMatchesTimeDelta(uint32 oldTimestamp, uint32 currentTimestamp) public {
        vm.assume(currentTimestamp > oldTimestamp);
        vm.assume(currentTimestamp <= type(uint32).max);

        pool.clearObservations();
        pool.setSlot0(0, 0, 1);
        _pushObservation(oldTimestamp, 0, 0, true);

        vm.warp(currentTimestamp);
        assertEq(oracle.getOldestObservationSecondsAgo(address(pool)), currentTimestamp - oldTimestamp);
    }
}

/*//////////////////////////////////////////////////////////////
              getBlockStartingTickAndLiquidity()
//////////////////////////////////////////////////////////////*/

contract GetBlockStartingTickAndLiquidityTest is OracleLibraryBase {
    // ── Revert cases ──────────────────────────────────────────────────────────

    function test_revert_cardinalityOne() public {
        pool.setSlot0(100, 0, 1); // cardinality must be > 1
        _pushObservation(uint32(block.timestamp), 0, 0, true);
        vm.expectRevert(bytes("NEO"));
        oracle.getBlockStartingTickAndLiquidity(address(pool));
    }

    function test_revert_prevObservationUninitialized() public {
        uint32 now32 = uint32(block.timestamp);
        // obsIndex=1, cardinality=2, prev (index 0) is uninitialized
        pool.setSlot0(0, 1, 2);
        _pushObservation(0, 0, 0, false); // index 0 — uninitialized
        _pushObservation(now32, 0, 0, true); // index 1 — current block
        vm.expectRevert(bytes("ONI"));
        oracle.getBlockStartingTickAndLiquidity(address(pool));
    }

    // ── Happy paths ───────────────────────────────────────────────────────────

    /// @dev Ported from suite 1: when the latest observation is from a past block,
    ///      the function returns slot0.tick and pool.liquidity() directly.
    function test_observationInPastBlock_returnsSlot0TickAndPoolLiquidity() public {
        pool.setSlot0(7, 0, 2);
        _pushObservation(uint32(block.timestamp) - 1, 0, 0, true); // index 0 — past block
        pool.setLiquidity(99);

        (int24 tick, uint128 liq) = oracle.getBlockStartingTickAndLiquidity(address(pool));
        assertEq(tick, 7, "should return slot0 tick");
        assertEq(liq, 99, "should return pool liquidity");
    }

    // /// @dev When the latest observation is in the CURRENT block, the starting tick
    // ///      is derived from the tickCumulative delta between this and the previous obs.
    // function test_observationCurrentBlock_computesFromDelta() public {
    //     uint32 now32 = uint32(block.timestamp);
    //     // obsIndex=1, cardinality=2
    //     // Prev (index 0): ts=now-10, tickCumulative=0
    //     // Curr (index 1): ts=now,    tickCumulative=100
    //     // starting tick = 100/10 = 10
    //     pool.setSlot0(99, 1, 2); // slot0 tick = 99 (should be overridden)
    //     pool.setLiquidity(0);
    //     _pushObservation(now32 - 10, 0,   0,               true); // index 0
    //     _pushObservation(now32,      100, uint160(1) << 32, true); // index 1
    //
    //     (int24 tick, uint128 liq) = oracle.getBlockStartingTickAndLiquidity(address(pool));
    //     assertEq(tick, 10, "starting tick = tickCumulativeDelta / delta");
    //     assertGt(liq, 0,   "liquidity should be computed from sp delta");
    // }
}

/*//////////////////////////////////////////////////////////////
              getWeightedArithmeticMeanTick()
//////////////////////////////////////////////////////////////*/

contract GetWeightedArithmeticMeanTickTest is OracleLibraryBase {
    // ── Internal helpers ──────────────────────────────────────────────────────

    function _single(int24 tick, uint128 weight) internal pure returns (OracleLibrary.WeightedTickData[] memory data) {
        data = new OracleLibrary.WeightedTickData[](1);
        data[0] = OracleLibrary.WeightedTickData({tick: tick, weight: weight});
    }

    function _pair(int24 t0, uint128 w0, int24 t1, uint128 w1)
        internal
        pure
        returns (OracleLibrary.WeightedTickData[] memory data)
    {
        data = new OracleLibrary.WeightedTickData[](2);
        data[0] = OracleLibrary.WeightedTickData({tick: t0, weight: w0});
        data[1] = OracleLibrary.WeightedTickData({tick: t1, weight: w1});
    }

    // ── Unit tests ────────────────────────────────────────────────────────────

    function test_singleEntry_returnsItsTick() public view {
        assertEq(oracle.getWeightedArithmeticMeanTick(_single(100, 1)), 100);
        assertEq(oracle.getWeightedArithmeticMeanTick(_single(-50, 999)), -50);
    }

    function test_equalWeights_returnsArithmeticMean() public view {
        // (100 + 200) / 2 = 150
        assertEq(oracle.getWeightedArithmeticMeanTick(_pair(100, 1, 200, 1)), 150);
    }

    function test_unequalWeights() public view {
        // (100*3 + 200*1) / 4 = 500/4 = 125
        assertEq(oracle.getWeightedArithmeticMeanTick(_pair(100, 3, 200, 1)), 125);
    }

    function test_negativeTicks_exactDivision() public view {
        // (−100 + −200) / 2 = −150
        assertEq(oracle.getWeightedArithmeticMeanTick(_pair(-100, 1, -200, 1)), -150);
    }

    function test_negativeTicks_roundsToNegInfinity() public view {
        // (−100 + −201) / 2 = −301/2 = −150.5 → floor = −151
        assertEq(oracle.getWeightedArithmeticMeanTick(_pair(-100, 1, -201, 1)), -151);
    }

    function test_positiveTicks_truncatesDown() public view {
        // (100 + 201) / 2 = 301/2 = 150 (truncation = floor for positive)
        assertEq(oracle.getWeightedArithmeticMeanTick(_pair(100, 1, 201, 1)), 150);
    }

    function test_mixedSignTicks_zeroResult() public view {
        // (−100 + 100) / 2 = 0
        assertEq(oracle.getWeightedArithmeticMeanTick(_pair(-100, 1, 100, 1)), 0);
    }

    function test_dominantWeight_resultNearDominantTick() public view {
        // tick=500 weight=999, tick=0 weight=1 → ≈ 499
        OracleLibrary.WeightedTickData[] memory data = _pair(500, 999, 0, 1);
        int24 result = oracle.getWeightedArithmeticMeanTick(data);
        assertApproxEqAbs(int256(result), 500, 1, "result should be close to dominant tick");
    }

    // ── Fuzz ─────────────────────────────────────────────────────────────────

    function testFuzz_singleEntry_alwaysReturnsTick(int24 tick, uint128 weight) public view {
        vm.assume(weight > 0);
        assertEq(oracle.getWeightedArithmeticMeanTick(_single(tick, weight)), tick);
    }

    function testFuzz_symmetry(int24 tick, uint128 weight) public view {
        vm.assume(weight > 0);
        vm.assume(tick > 0 && tick < 887272);
        OracleLibrary.WeightedTickData[] memory data = _pair(tick, weight, -tick, weight);
        int24 result = oracle.getWeightedArithmeticMeanTick(data);
        assertApproxEqAbs(int256(result), 0, 1, "symmetric ticks should average near 0");
    }

    function testFuzz_resultBoundedByInputRange(int24 tick1, int24 tick2, uint128 weight1, uint128 weight2)
        public
        view
    {
        vm.assume(weight1 > 0 && weight2 > 0);
        tick1 = int24(bound(tick1, -887272, 887272));
        tick2 = int24(bound(tick2, -887272, 887272));

        int24 minTick = tick1 < tick2 ? tick1 : tick2;
        int24 maxTick = tick1 > tick2 ? tick1 : tick2;

        OracleLibrary.WeightedTickData[] memory data = _pair(tick1, weight1, tick2, weight2);
        int24 result = oracle.getWeightedArithmeticMeanTick(data);

        // −1 accounts for floor rounding on the lower bound
        assertGe(int256(result), int256(minTick) - 1, "result below minimum tick");
        assertLe(int256(result), int256(maxTick), "result above maximum tick");
    }
}

/*//////////////////////////////////////////////////////////////
                      getChainedPrice()
//////////////////////////////////////////////////////////////*/

contract GetChainedPriceTest is OracleLibraryBase {
    // ── Revert cases ──────────────────────────────────────────────────────────

    function test_revert_lengthMismatch() public {
        address[] memory tokens = new address[](3);
        int24[] memory ticks = new int24[](1); // needs tokens.length - 1 = 2
        vm.expectRevert(bytes("DL"));
        oracle.getChainedPrice(tokens, ticks);
    }

    function test_revert_twoTokensTwoTicks() public {
        address[] memory tokens = new address[](2);
        int24[] memory ticks = new int24[](2); // needs exactly 1
        vm.expectRevert(bytes("DL"));
        oracle.getChainedPrice(tokens, ticks);
    }

    // ── Single-hop ────────────────────────────────────────────────────────────

    function test_singleHop_sortedOrder_addsTick() public view {
        // tokens[0] < tokens[1] → synthetic += tick
        address[] memory tokens = new address[](2);
        tokens[0] = addrA;
        tokens[1] = addrB;
        int24[] memory ticks = new int24[](1);
        ticks[0] = 500;
        assertEq(oracle.getChainedPrice(tokens, ticks), 500);
    }

    function test_singleHop_reversedOrder_subtractsTick() public view {
        // tokens[0] > tokens[1] → synthetic -= tick
        address[] memory tokens = new address[](2);
        tokens[0] = addrB;
        tokens[1] = addrA;
        int24[] memory ticks = new int24[](1);
        ticks[0] = 500;
        assertEq(oracle.getChainedPrice(tokens, ticks), -500);
    }

    function test_singleHop_negativeTick() public view {
        address[] memory tokens = new address[](2);
        tokens[0] = addrA;
        tokens[1] = addrB;
        int24[] memory ticks = new int24[](1);
        ticks[0] = -1000;
        assertEq(oracle.getChainedPrice(tokens, ticks), -1000);
    }

    function test_singleHop_zeroTick() public view {
        address[] memory tokens = new address[](2);
        tokens[0] = addrA;
        tokens[1] = addrB;
        int24[] memory ticks = new int24[](1);
        ticks[0] = 0;
        assertEq(oracle.getChainedPrice(tokens, ticks), 0);
    }

    // ── Two-hop ───────────────────────────────────────────────────────────────

    function test_twoHop_sameSortOrder_addsBoth() public view {
        address addrC = address(0x3333); // addrA < addrB < addrC
        address[] memory tokens = new address[](3);
        tokens[0] = addrA;
        tokens[1] = addrB;
        tokens[2] = addrC;
        int24[] memory ticks = new int24[](2);
        ticks[0] = 300;
        ticks[1] = 200;
        // A<B → +300; B<C → +200
        assertEq(oracle.getChainedPrice(tokens, ticks), 500);
    }

    function test_twoHop_addThenAdd() public view {
        address addrC = address(0x3333);
        address[] memory tokens = new address[](3);
        tokens[0] = addrA; // 0x1111
        tokens[1] = addrB; // 0x2222
        tokens[2] = addrC; // 0x3333 — addrB < addrC → add
        int24[] memory ticks = new int24[](2);
        ticks[0] = 100;
        ticks[1] = 50;
        assertEq(oracle.getChainedPrice(tokens, ticks), 150);
    }

    /// @dev Ported from suite 1: add then subtract (A→B→A round-trip variant).
    function test_twoHop_addThenSubtract() public view {
        // Three distinct addresses where tokens[2] < tokens[1]
        address addrC = address(0x3333); // addrA < addrB < addrC
        address[] memory tokens = new address[](3);
        tokens[0] = addrA; // 0x1111 < addrB → add
        tokens[1] = addrC; // 0x3333 > addrB → subtract
        tokens[2] = addrB; // 0x2222
        int24[] memory ticks = new int24[](2);
        ticks[0] = 10;
        ticks[1] = 3;
        // A<C → +10; C>B → −3
        assertEq(oracle.getChainedPrice(tokens, ticks), 7);
    }

    // ── Fuzz ─────────────────────────────────────────────────────────────────

    function testFuzz_singleHop_sortOrder(address t0, address t1, int24 tick) public view {
        vm.assume(t0 != t1);
        tick = int24(bound(tick, -887272, 887272));

        address[] memory tokens = new address[](2);
        tokens[0] = t0;
        tokens[1] = t1;
        int24[] memory ticks = new int24[](1);
        ticks[0] = tick;

        int256 result = oracle.getChainedPrice(tokens, ticks);
        if (t0 < t1) {
            assertEq(result, int256(tick), "sorted pair should add tick");
        } else {
            assertEq(result, -int256(tick), "reversed pair should subtract tick");
        }
    }

    function testFuzz_roundTrip_twoHop(int24 tick1, int24 tick2) public view {
        // A→B→A: first hop adds (A<B), second hop subtracts (B>A) → net = tick1 − tick2
        tick1 = int24(bound(tick1, -400000, 400000));
        tick2 = int24(bound(tick2, -400000, 400000));

        address[] memory tokens = new address[](3);
        tokens[0] = addrA;
        tokens[1] = addrB;
        tokens[2] = addrA; // back to A

        int24[] memory ticks = new int24[](2);
        ticks[0] = tick1;
        ticks[1] = tick2;

        // A<B → +tick1; B>A → −tick2
        assertEq(oracle.getChainedPrice(tokens, ticks), int256(tick1) - int256(tick2));
    }
}
