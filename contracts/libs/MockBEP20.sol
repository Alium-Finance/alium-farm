pragma solidity 0.6.12;

import "@alium-official/alium-swap-lib/contracts/token/BEP20/BEP20.sol";

contract MockBEP20 is BEP20 {
    constructor(
        string memory name,
        string memory symbol,
        uint256 supply
    ) public BEP20(name, symbol) {
        _mint(msg.sender, supply);
    }

    function mint(address _account, uint256 _amount) external {
        _mint(_account, _amount);
    }
}