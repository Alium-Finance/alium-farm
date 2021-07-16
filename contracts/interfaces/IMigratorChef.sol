pragma solidity 0.6.12;

import '@alium-official/alium-swap-lib/contracts/token/BEP20/IBEP20.sol';

interface IMigratorChef {
    // Perform LP token migration from legacy AliumSwap to AliumSwap.
    // Take the current LP token address and return the new LP token address.
    // Migrator should have full access to the caller's LP token.
    // Return the new LP token address.
    //
    // XXX Migrator must have allowance access to AliumSwap LP tokens.
    // AliumSwap must mint EXACTLY the same amount of AliumSwap LP tokens or
    // else something bad will happen. Traditional AliumSwap does not
    // do that so be careful!
    function migrate(IBEP20 token) external returns (IBEP20);
}