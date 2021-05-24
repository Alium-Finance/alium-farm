pragma solidity 0.6.12;

import '@alium-official/alium-swap-lib/contracts/math/SafeMath.sol';
import '@alium-official/alium-swap-lib/contracts/token/BEP20/IBEP20.sol';
import '@alium-official/alium-swap-lib/contracts/token/BEP20/SafeBEP20.sol';
import '@alium-official/alium-swap-lib/contracts/access/Ownable.sol';

interface IAliumToken is IBEP20 {
    function mint(address _to, uint256 _amount) external;
    function burn(uint256 _amount) external;
}

interface IMigratorChef {
    // Perform LP token migration from legacy PancakeSwap to AliumSwap.
    // Take the current LP token address and return the new LP token address.
    // Migrator should have full access to the caller's LP token.
    // Return the new LP token address.
    //
    // XXX Migrator must have allowance access to PancakeSwap LP tokens.
    // AliumSwap must mint EXACTLY the same amount of AliumSwap LP tokens or
    // else something bad will happen. Traditional PancakeSwap does not
    // do that so be careful!
    function migrate(IBEP20 token) external returns (IBEP20);
}

// MasterChef is the master of Alium. He can make Alium and he is a fair guy.
//
// Note that it's ownable and the owner wields tremendous power. The ownership
// will be transferred to a governance smart contract once ALM is sufficiently
// distributed and the community can show to govern itself.
//
// Have fun reading it. Hopefully it's bug-free. God bless.
contract MasterChef is Ownable {
    using SafeMath for uint256;
    using SafeBEP20 for IBEP20;

    // Info of each user.
    struct UserInfo {
        uint256 amount;     // How many LP tokens the user has provided.
        uint256 rewardDebt; // Reward debt. See explanation below.
        //
        // We do some fancy math here. Basically, any point in time, the amount of ALMs
        // entitled to a user but is pending to be distributed is:
        //
        //   pending reward = (user.amount * pool.accALMPerShare) - user.rewardDebt
        //
        // Whenever a user deposits or withdraws LP tokens to a pool. Here's what happens:
        //   1. The pool's `accALMPerShare` (and `lastRewardBlock`) gets updated.
        //   2. User receives the pending reward sent to his/her address.
        //   3. User's `amount` gets updated.
        //   4. User's `rewardDebt` gets updated.
    }

    // Info of each pool.
    struct PoolInfo {
        IBEP20 lpToken;           // Address of LP token contract.
        uint256 allocPoint;       // How many allocation points assigned to this pool. ALMs to distribute per block.
        uint256 lastRewardBlock;  // Last block number that ALMs distribution occurs.
        uint256 accALMPerShare; // Accumulated ALMs per share, times 1e12. See below.
    }

    // The ALM TOKEN!
    IAliumToken public alm;
    // Dev address.
    address public devaddr;
    // ALM tokens created per block.
    uint256 public immutable almPerBlock;
    // Bonus muliplier for early alm makers.
    uint256 public BONUS_MULTIPLIER = 1;
    // The migrator contract. It has a lot of power. Can only be set through governance (owner).
    IMigratorChef public migrator;

    // Info of each pool.
    PoolInfo[] public poolInfo;
    // Info of each user that stakes LP tokens.
    mapping (uint256 => mapping (address => UserInfo)) public userInfo;
    // Total allocation points. Must be the sum of all allocation points in all pools.
    uint256 public totalAllocPoint = 0;
    // The block number when ALM mining starts.
    uint256 public startBlock;

    uint256 public mintedTokens;
    uint256 public mintingLimit;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);

    constructor(
        IAliumToken _alm,
        address _devaddr,
        uint256 _almPerBlock,
        uint256 _startBlock,
        uint256 _farmingLimit
    ) public {
        require(_devaddr != address(0), "MasterChef: set wrong dev");
        require(_almPerBlock != 0, "MasterChef: set wrong reward");

        alm = _alm;
        devaddr = _devaddr;
        almPerBlock = _almPerBlock;
        startBlock = _startBlock;
        mintingLimit = _farmingLimit;

        // staking pool
        poolInfo.push(PoolInfo({
            lpToken: _alm,
            allocPoint: 1000,
            lastRewardBlock: startBlock,
            accALMPerShare: 0
        }));

        totalAllocPoint = 1000;
    }

    // Deposit LP tokens to MasterChef for ALM allocation.
    function deposit(uint256 _pid, uint256 _amount) external {
        require (_pid != 0, "MasterChef: withdraw CAKE by unstaking");

        _deposit(_pid, _amount);
    }

    // Withdraw LP tokens from MasterChef.
    function withdraw(uint256 _pid, uint256 _amount) external {
        require (_pid != 0, "MasterChef: withdraw CAKE by unstaking");

        _withdraw(_pid, _amount);
    }

    // Stake ALM tokens to MasterChef
    function stake(uint256 _amount) external {
        _deposit(0, _amount);
    }

    // Withdraw ALM tokens from STAKING.
    function unstake(uint256 _amount) external {
        _withdraw(0, _amount);
    }

    // Withdraw without caring about rewards. EMERGENCY ONLY.
    function emergencyWithdraw(uint256 _pid) external {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        pool.lpToken.safeTransfer(address(msg.sender), user.amount);
        emit EmergencyWithdraw(msg.sender, _pid, user.amount);
        user.amount = 0;
        user.rewardDebt = 0;
    }

    function updateMultiplier(uint256 multiplierNumber) external onlyOwner {
        BONUS_MULTIPLIER = multiplierNumber;
    }

    // Set the migrator contract. Can only be called by the owner.
    function setMigrator(IMigratorChef _migrator) external onlyOwner {
        migrator = _migrator;
    }

    // Add a new lp to the pool. Can only be called by the owner.
    // XXX DO NOT add the same LP token more than once. Rewards will be messed up if you do.
    function addPool(uint256 _allocPoint, IBEP20 _lpToken, bool _withUpdate) external onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }

        uint256 lastRewardBlock = block.number > startBlock ? block.number : startBlock;
        totalAllocPoint = totalAllocPoint.add(_allocPoint);
        poolInfo.push(PoolInfo({
            lpToken: _lpToken,
            allocPoint: _allocPoint,
            lastRewardBlock: lastRewardBlock,
            accALMPerShare: 0
        }));
        _updateStakingPool();
    }

    // Update the given pool's ALM allocation point. Can only be called by the owner.
    function setPool(uint256 _pid, uint256 _allocPoint, bool _withUpdate) external onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }

        uint256 prevAllocPoint = poolInfo[_pid].allocPoint;
        poolInfo[_pid].allocPoint = _allocPoint;
        if (prevAllocPoint != _allocPoint) {
            totalAllocPoint = totalAllocPoint.sub(prevAllocPoint).add(_allocPoint);
            _updateStakingPool();
        }
    }

    // Update dev address by the previous dev.
    function dev(address _devaddr) external {
        require(msg.sender == devaddr, "MasterChef: dev wut?");

        devaddr = _devaddr;
    }

    // Migrate lp token to another lp contract. Can be called by anyone. We trust that migrator contract is good.
    function migrate(uint256 _pid) external {
        require(address(migrator) != address(0), "migrate: no migrator");

        PoolInfo storage pool = poolInfo[_pid];
        IBEP20 lpToken = pool.lpToken;
        uint256 bal = lpToken.balanceOf(address(this));
        lpToken.safeApprove(address(migrator), bal);
        IBEP20 newLpToken = migrator.migrate(lpToken);

        require(bal == newLpToken.balanceOf(address(this)), "migrate: bad");

        pool.lpToken = newLpToken;
    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    // View function to see pending ALMs on frontend.
    function pendingAlium(uint256 _pid, address _user) external view returns (uint256) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accALMPerShare = pool.accALMPerShare;
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
            uint256 almReward = multiplier.mul(almPerBlock).mul(pool.allocPoint).div(totalAllocPoint);
            accALMPerShare = accALMPerShare.add(almReward.mul(1e12).div(lpSupply));
        }
        return user.amount.mul(accALMPerShare).div(1e12).sub(user.rewardDebt);
    }

    // Update reward variables for all pools. Be careful of gas spending!
    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    // Update reward variables of the given pool to be up-to-date.
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        if (block.number <= pool.lastRewardBlock) {
            return;
        }

        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (lpSupply == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }

        uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);

        uint256 almReward = multiplier.mul(almPerBlock).mul(pool.allocPoint).div(totalAllocPoint);
        if (almReward + almReward.div(10) + mintedTokens <= mintingLimit) {
            alm.mint(devaddr, almReward.div(10));
            alm.mint(address(this), almReward);
            mintedTokens += almReward + almReward.div(10);
        } else {
            almReward = mintingLimit - mintedTokens;
            alm.mint(address(this), almReward);
            mintedTokens += almReward;
            // @dev
            if (BONUS_MULTIPLIER != 0) {
                BONUS_MULTIPLIER = 0;
            }
        }
        pool.accALMPerShare = pool.accALMPerShare.add(almReward.mul(1e12).div(lpSupply));
        pool.lastRewardBlock = block.number;
    }

    // Return reward multiplier over the given _from to _to block.
    function getMultiplier(uint256 _from, uint256 _to) public view returns (uint256) {
        return _to.sub(_from).mul(BONUS_MULTIPLIER);
    }

    // Safe alm transfer function, just in case if rounding error causes pool to not have enough ALMs.
    function _safeAlmTransfer(address _to, uint256 _amount) internal {
        uint256 cakeBal = alm.balanceOf(address(this));
        if (_amount > cakeBal) {
            alm.transfer(_to, cakeBal);
        } else {
            alm.transfer(_to, _amount);
        }
    }

    function _updateStakingPool() internal {
        uint256 length = poolInfo.length;
        uint256 points = 0;
        for (uint256 pid = 1; pid < length; ++pid) {
            points = points.add(poolInfo[pid].allocPoint);
        }
        if (points != 0) {
            points = points.div(3);
            totalAllocPoint = totalAllocPoint.sub(poolInfo[0].allocPoint).add(points);
            poolInfo[0].allocPoint = points;
        }
    }

    function _deposit(uint256 _pid, uint256 _amount) internal {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        updatePool(_pid);
        if (user.amount > 0) {
            uint256 pending = user.amount.mul(pool.accALMPerShare).div(1e12).sub(user.rewardDebt);
            if (pending > 0) {
                _safeAlmTransfer(msg.sender, pending);
            }
        }
        if (_amount > 0) {
            pool.lpToken.safeTransferFrom(address(msg.sender), address(this), _amount);
            user.amount = user.amount.add(_amount);
        }
        user.rewardDebt = user.amount.mul(pool.accALMPerShare).div(1e12);
        emit Deposit(msg.sender, _pid, _amount);
    }

    // Withdraw LP tokens from MasterChef.
    function _withdraw(uint256 _pid, uint256 _amount) internal {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];

        require(user.amount >= _amount, "MasterChef: user balance not enough");

        updatePool(_pid);
        uint256 pending = user.amount.mul(pool.accALMPerShare).div(1e12).sub(user.rewardDebt);
        if (pending > 0) {
            _safeAlmTransfer(msg.sender, pending);
        }
        if (_amount > 0) {
            user.amount = user.amount.sub(_amount);
            pool.lpToken.safeTransfer(address(msg.sender), _amount);
        }

        user.rewardDebt = user.amount.mul(pool.accALMPerShare).div(1e12);
        emit Withdraw(msg.sender, _pid, _amount);
    }
}
