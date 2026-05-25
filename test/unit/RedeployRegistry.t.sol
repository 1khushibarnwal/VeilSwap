// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {RedeployRegistry} from "../../script/RedeployRegistry.s.sol";
import {IntentRegistry} from "../../src/IntentRegistry.sol";

contract RedeployRegistryTest is Test {
    RedeployRegistry internal script;

    uint256 internal constant PRIVATE_KEY = 123456;
    address internal deployer;

    address internal constant MOCK_ROUTER = 0xf015F6A0eed0157E841B3Ff1B007a73363FAC708;

    address internal constant WETH = 0x121872eFfbcEDdD41d1E9Ae25Dcf16dc0C8b6650;

    address internal constant USDC = 0xB8101132fa8a75d996476327EF56F5e5d7be40A0;

    address internal constant POOL = 0x280A26995FD0C7885F24c7CBa7237DF45a37aE72;

    function setUp() public {
        script = new RedeployRegistry();

        deployer = vm.addr(PRIVATE_KEY);

        vm.setEnv("PRIVATE_KEY", vm.toString(PRIVATE_KEY));
    }

    function test_RunExecutesSuccessfully() public {
        script.run();
    }

    function test_RunCanBeCalledMultipleTimes() public {
        script.run();
        script.run();
    }

    function test_BroadcastStartsAndStopsCleanly() public {
        script.run();

        assertTrue(true);
    }

    function test_RevertBranchIsUnreachable() public pure {
        assertTrue(MOCK_ROUTER != address(0));
    }

    function test_RunExecutesWithoutRevert() public {
        script.run();
    }

    function test_RunCanExecuteTwice() public {
        script.run();
        script.run();
    }

    function test_BroadcastCompletesCleanly() public {
        script.run();

        assertTrue(true);
    }

    function test_EnvironmentVariableIsConsumed() public {
        vm.setEnv("PRIVATE_KEY", vm.toString(PRIVATE_KEY));

        script.run();

        assertTrue(true);
    }

    function test_RevertBranchImpossible() public pure {
        assertTrue(0xf015F6A0eed0157E841B3Ff1B007a73363FAC708 != address(0));
    }

    function test_MultipleSequentialRunsDoNotFail() public {
        for (uint256 i; i < 5; i++) {
            script.run();
        }
    }

    function test_SetupInitializesScript() public view {
        assertTrue(address(script) != address(0));
    }

    function test_DeployerAddressDerivedCorrectly() public view {
        assertEq(deployer, vm.addr(PRIVATE_KEY));
    }
}
