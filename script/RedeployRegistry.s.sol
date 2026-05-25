// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {IntentRegistry} from "../src/IntentRegistry.sol";

contract RedeployRegistry is Script {
    error RedeployRegistry__MockRouterAddressNotSet();

    // ── Fill this in after running DeployMockRouter ───────────────────────────
    address internal constant MOCK_ROUTER = 0xf015F6A0eed0157E841B3Ff1B007a73363FAC708;

    // ── These stay the same — already deployed, no changes needed ────────────
    address internal constant WETH = 0x121872eFfbcEDdD41d1E9Ae25Dcf16dc0C8b6650;
    address internal constant USDC = 0xB8101132fa8a75d996476327EF56F5e5d7be40A0;
    address internal constant POOL = 0x280A26995FD0C7885F24c7CBa7237DF45a37aE72;

    function run() external {
        if (MOCK_ROUTER == address(0)) {
            revert RedeployRegistry__MockRouterAddressNotSet();
        }

        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerKey);

        // Deploy new IntentRegistry pointing to MockRouter
        IntentRegistry registry = new IntentRegistry(MOCK_ROUTER);
        console.log("New IntentRegistry:", address(registry));

        // Re-register the existing pool — same pool, nothing redeployed
        registry.registerPool(WETH, USDC, POOL);
        console.log("Pool registered:   ", POOL);

        vm.stopBroadcast();

        console.log("\n=== GIVE YOUR PARTNER THIS ADDRESS ===");
        console.log("CONTRACT_ADDRESS =", address(registry));
        console.log("Everything else stays the same.");
    }
}
