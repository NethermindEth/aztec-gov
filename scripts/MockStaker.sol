// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.27;

interface IGovernance {
    function vote(uint256 _proposalId, uint256 _amount, bool _support) external;
}

/// @notice Local-anvil stand-in for ATPWithdrawableAndClaimableStaker.
///         Exposes the same `voteInGovernance` signature the aztec-gov UI calls,
///         and proxies the call to Governance.vote from its own address — so
///         `Governance.powerNow(mockStaker)` (seeded via direct deposit by the
///         deployer) counts as the voting power.
contract MockStaker {
    address public immutable beneficiary;
    IGovernance public immutable governance;

    error NotBeneficiary();

    constructor(address _beneficiary, address _governance) {
        beneficiary = _beneficiary;
        governance = IGovernance(_governance);
    }

    function voteInGovernance(
        uint256 _proposalId,
        uint256 _amount,
        bool _support
    ) external {
        if (msg.sender != beneficiary) revert NotBeneficiary();
        governance.vote(_proposalId, _amount, _support);
    }
}
