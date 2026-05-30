// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "forge-std/Script.sol";

contract ComputeHash is Script {
    function run() external pure {
        bytes32 hash = keccak256(abi.encodePacked(
            address(0x78c1A68087CfD34A781eb7ef7D7fd8b3cd7C965b),
            address(0x121872eFfbcEDdD41d1E9Ae25Dcf16dc0C8b6650),
            address(0xB8101132fa8a75d996476327EF56F5e5d7be40A0),
            uint256(1000),
            uint256(2000),
            uint256(0),
            false,
            uint256(1780036332),
            bytes32(uint256(0x1234))
        ));
        console.logBytes32(hash);
    }
}
