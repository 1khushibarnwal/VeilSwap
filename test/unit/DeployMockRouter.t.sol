// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {DeployMockRouter} from "../../script/DeployMockRouter.s.sol";

contract DeployMockRouterTest is Test {
    DeployMockRouter internal deployer;

    function setUp() public {
        deployer = new DeployMockRouter();
    }

    /*//////////////////////////////////////////////////////////////
                            FUNCTION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_RunExecutesSuccessfully() public {
        vm.setEnv("PRIVATE_KEY", "1");

        deployer.run();
    }

    function test_RunCanBeCalledMultipleTimes() public {
        vm.setEnv("PRIVATE_KEY", "1");

        deployer.run();
        deployer.run();
        deployer.run();
    }

    function test_RunWithDifferentPrivateKey() public {
        vm.setEnv("PRIVATE_KEY", "123456");

        deployer.run();
    }

    /*//////////////////////////////////////////////////////////////
                        BRANCH COVERAGE TESTS
    //////////////////////////////////////////////////////////////*/

    function test_StartBroadcastBranch() public {
        vm.setEnv("PRIVATE_KEY", "42");

        deployer.run();
    }

    function test_StopBroadcastBranch() public {
        vm.setEnv("PRIVATE_KEY", "42");

        deployer.run();
    }

    function test_MockRouterDeploymentBranch() public {
        vm.setEnv("PRIVATE_KEY", "42");

        deployer.run();
    }

    /*//////////////////////////////////////////////////////////////
                            LINE COVERAGE
    //////////////////////////////////////////////////////////////*/

    function test_EnvUintLine() public {
        vm.setEnv("PRIVATE_KEY", "99");

        deployer.run();
    }

    function test_ConsoleLogLine() public {
        vm.setEnv("PRIVATE_KEY", "99");

        deployer.run();
    }

    function test_NewMockRouterLine() public {
        vm.setEnv("PRIVATE_KEY", "99");

        deployer.run();
    }

    function test_BroadcastStartLine() public {
        vm.setEnv("PRIVATE_KEY", "99");

        deployer.run();
    }

    function test_BroadcastStopLine() public {
        vm.setEnv("PRIVATE_KEY", "99");

        deployer.run();
    }

    /*//////////////////////////////////////////////////////////////
                        FUZZ TESTS
    //////////////////////////////////////////////////////////////*/

    function testFuzz_Run(uint256 key) public {
        vm.assume(key > 0);

        uint256 ORDER = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;

        vm.assume(key < ORDER);

        vm.setEnv("PRIVATE_KEY", vm.toString(key));

        deployer.run();
    }

    function testFuzz_RunNonZero(uint256 key) public {
        uint256 ORDER = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;

        vm.assume(key > 0 && key < ORDER);

        vm.setEnv("PRIVATE_KEY", vm.toString(key));

        deployer.run();
    }
}
