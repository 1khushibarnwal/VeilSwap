// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {MockRouter} from "../test/unit/Mocks.sol";

contract DeployMockRouter is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerKey);

        MockRouter router = new MockRouter();
        console.log("MockRouter deployed:", address(router));

        vm.stopBroadcast();
    }
}
