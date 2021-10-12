const { expectRevert, time, constants, ether, BN } = require('@openzeppelin/test-helpers');
const timeMachine = require('ganache-time-traveler');

const AliumToken = artifacts.require('AliumToken');
const MasterChef = artifacts.require('MasterChef');
const MockBEP20 = artifacts.require('libs/MockBEP20');
const SHPMock = artifacts.require('test/SHPMock');
const MockAliumCashbox = artifacts.require('test/MockAliumCashbox');
const FarmingTicketToken = artifacts.require("FarmingTicketToken");
const FarmingTicketWindow = artifacts.require("FarmingTicketWindow");

const { MAX_UINT256, ZERO_ADDRESS } = constants;

const DEAD_ADDRESS = '0x000000000000000000000000000000000000dead'

contract('MasterChef', ([alice, bob, dev, founder, minter]) => {
    
    let alm,
        chef,
        shp,
        ticketToken,
        ticketWindow,
        cashbox,
        lp1,
        lp2,
        lp3;

    let snapshotId;
    
    beforeEach(async () => {
        alm = await AliumToken.new({ from: minter });
        lp1 = await MockBEP20.new('LPToken', 'LP1', '1000000', { from: minter });
        lp2 = await MockBEP20.new('LPToken', 'LP2', '1000000', { from: minter });
        lp3 = await MockBEP20.new('LPToken', 'LP3', '1000000', { from: minter });
        shp = await SHPMock.new(alm.address, { from: minter });
        ticketToken = await FarmingTicketToken.new({ from: minter });
        ticketWindow = await FarmingTicketWindow.new(alm.address, ticketToken.address, founder, { from: minter });
        cashbox = await MockAliumCashbox.new(alm.address, minter, { from: minter });
        let startBlock = Number(await time.latestBlock())

        console.log(
            alm.address,
            dev,
            shp.address,
            ticketWindow.address,
            cashbox.address,
            startBlock
        )

        chef = await MasterChef.new(
            alm.address,
            dev,
            shp.address,
            ticketWindow.address,
            cashbox.address,
            startBlock,
            [
                {
                    amount: ether("7").toString(),
                    blocks: 100
                },                {
                    amount: ether("5").toString(),
                    blocks: 100
                },                {
                    amount: ether("3").toString(),
                    blocks: 100
                }
            ],
            {
                from: minter
            }
        );

        await alm.mint(cashbox.address, '5000000000000000000000000', { from: minter });
        await alm.mint(alice, '10000', { from: minter });
        await alm.mint(bob, '20000', { from: minter });

        await lp1.transfer(bob, '2000', { from: minter });
        await lp2.transfer(bob, '2000', { from: minter });
        await lp3.transfer(bob, '2000', { from: minter });

        await lp1.transfer(alice, '2000', { from: minter });
        await lp2.transfer(alice, '2000', { from: minter });
        await lp3.transfer(alice, '2000', { from: minter });

        //await alm.transferOwnership(chef.address, { from: minter });
        await cashbox.initialize(alm.address, founder, { from: minter })
        await cashbox.setWalletLimit(chef.address, MAX_UINT256, { from: minter })
        await ticketToken.transferOwnership(cashbox.address, { from: minter });
    });

    beforeEach(async() => {
        let snapshot = await timeMachine.takeSnapshot();
        snapshotId = snapshot['result'];
    });

    afterEach(async() => {
        await timeMachine.revertToSnapshot(snapshotId);
    });
    
    describe('MasterChef', () => {

        it('real case', async () => {
            // await time.advanceBlockTo('100');
            await chef.addPool('100', 0, 0, lp1.address, true, { from: minter });
            await chef.addPool('100', 0, 0, lp2.address, true, { from: minter });
            assert.equal((await chef.poolLength()).toString(), "2");

            await ticketWindow.passFree(alice, { from: minter })
            await ticketWindow.passFree(bob, { from: minter })

            // await time.advanceBlockTo('200');
            await lp1.approve(chef.address, MAX_UINT256, { from: alice });
            assert.equal((await alm.balanceOf(alice)).toString(), '10000');

            // console.log((await lp1.balanceOf(alice)).toString())
            await chef.deposit(0, '1', { from: alice });
            await chef.withdraw(0, '0', { from: alice });
            assert.equal((await alm.balanceOf(alice)).toString(), '3500000000000010000');
            assert.equal((await alm.balanceOf(chef.address)).toString(), '0');
            await chef.withdraw(0, '0', { from: alice });
            assert.equal((await alm.balanceOf(chef.address)).toString(), '0');

            await lp1.approve(chef.address, MAX_UINT256, { from: bob });
            await chef.deposit(0, '1', { from: bob });
            await chef.deposit(0, '0', { from: alice });

            await chef.updateMultiplier(0, { from: minter })
            await chef.deposit(0, '0', { from: bob });

            assert.equal((await alm.balanceOf(chef.address)).toString(), '0');
        })

        it('#blockReward', async () => {
            let blockNow = await time.latestBlock()
            if (blockNow.toNumber() < 100) {
                assert.equal((await chef.blockReward()).toString(), ether('30'), "")
            }

            await time.advanceBlockTo(101)
            assert.equal((await chef.blockReward()).toString(), ether('10'), "")

            await time.advanceBlockTo(201)
            assert.equal((await chef.blockReward()).toString(), ether('3'), "")

            await time.advanceBlockTo(301)
            assert.equal((await chef.blockReward()).toString(), 0, "")
        })

        it('deposit/withdraw', async () => {
            await chef.addPool('1000', 0, 0, lp1.address, true, { from: minter });
            await chef.addPool('1000', 0, 0, lp2.address, true, { from: minter });
            await chef.addPool('1000', 0, 0, lp3.address, true, { from: minter });

            await lp1.approve(chef.address, MAX_UINT256, { from: alice });
            await chef.deposit(1, '20', { from: alice });
            await chef.deposit(1, '0', { from: alice });
            await chef.deposit(1, '40', { from: alice });
            await chef.deposit(1, '0', { from: alice });
            assert.equal((await lp1.balanceOf(alice)).toString(), '1940');
            await chef.withdraw(1, '10', { from: alice });
            assert.equal((await lp1.balanceOf(alice)).toString(), '1950');
            assert.equal((await alm.balanceOf(alice)).toString(), '30000000000000010000');
            assert.equal((await alm.balanceOf(dev)).toString(), '3000000000000000000'); // 1/10 of alice reward
            await lp1.approve(chef.address, MAX_UINT256, { from: bob });
            assert.equal((await lp1.balanceOf(bob)).toString(), '2000');
            await chef.deposit(1, '50', { from: bob });
            assert.equal((await lp1.balanceOf(bob)).toString(), '1950');
            await chef.deposit(1, '0', { from: bob });
            assert.equal((await alm.balanceOf(bob)).toString(), '3750000000000020000');
            await chef.emergencyWithdraw(1, { from: bob });
            assert.equal((await lp1.balanceOf(bob)).toString(), '2000');
        })

        it('staking/unstaking', async () => {
            await chef.addPool('1000', 0, 0, lp1.address, true, { from: minter });
            await chef.addPool('1000', 0, 0, lp2.address, true, { from: minter });
            await chef.addPool('1000', 0, 0, lp3.address, true, { from: minter });

            await lp1.approve(chef.address, MAX_UINT256, { from: alice });
            await chef.deposit(1, '2', { from: alice }); //0
            await chef.withdraw(1, '2', { from: alice }); //1

            // clear alisa balance

            let balanceBefore = await alm.balanceOf(alice)
            await alm.transfer(DEAD_ADDRESS, balanceBefore.sub(new BN(1)), { from: alice })

            balanceBefore = await alm.balanceOf(alice)

            await alm.approve(chef.address, MAX_UINT256, { from: alice });
            await chef.stake('1', { from: alice });
            await chef.unstake('1', { from: alice });

            let balanceAfter = (await alm.balanceOf(alice)).toString()

            assert.equal(balanceAfter, '7500000000000000001');
        });

        it('update multiplier', async () => {
            await chef.addPool('1000', 0, 0, lp1.address, true, { from: minter });
            await chef.addPool('1000', 0, 0, lp2.address, true, { from: minter });
            await chef.addPool('1000', 0, 0, lp3.address, true, { from: minter });

            await lp1.approve(chef.address, MAX_UINT256, { from: alice });
            await lp1.approve(chef.address, MAX_UINT256, { from: bob });
            await chef.deposit(1, '100', { from: alice });
            await chef.deposit(1, '100', { from: bob });
            await chef.deposit(1, '0', { from: alice });
            await chef.deposit(1, '0', { from: bob });

            await alm.approve(chef.address, MAX_UINT256, { from: alice });
            await alm.approve(chef.address, MAX_UINT256, { from: bob });
            await chef.stake('50', { from: alice });
            await chef.stake('100', { from: bob });

            await chef.updateMultiplier('0', { from: minter });

            await chef.stake('0', { from: alice });
            await chef.stake('0', { from: bob });
            await chef.deposit(1, '0', { from: alice });
            await chef.deposit(1, '0', { from: bob });

            assert.equal((await alm.balanceOf(alice)).toString(), '15000000000000009955');
            assert.equal((await alm.balanceOf(bob)).toString(), '7500000000000019900');

            await time.advanceBlockTo('265');

            await chef.stake('0', { from: alice });
            await chef.stake('0', { from: bob });
            await chef.deposit(1, '0', { from: alice });
            await chef.deposit(1, '0', { from: bob });

            assert.equal((await alm.balanceOf(alice)).toString(), '15000000000000009955');
            assert.equal((await alm.balanceOf(bob)).toString(), '7500000000000019900');

            await chef.unstake('50', { from: alice });
            await chef.unstake('100', { from: bob });
            await chef.withdraw(1, '100', { from: alice });
            await chef.withdraw(1, '100', { from: bob });

        });

        it('should allow dev and only dev to update dev', async () => {
            assert.equal((await chef.devaddr()).valueOf(), dev);
            await expectRevert(chef.dev(bob, { from: bob }), 'MasterChef: dev wut?');
            await chef.dev(bob, { from: dev });
            assert.equal((await chef.devaddr()).valueOf(), bob);
            await chef.dev(alice, { from: bob });
            assert.equal((await chef.devaddr()).valueOf(), alice);
        })

        it('should correct update allocation points', async () => {
            assert.equal(Number(await chef.totalAllocPoint()), 0);
            await chef.addPool('1000', 0, 0, lp1.address, true, { from: minter });
            assert.equal(Number(await chef.totalAllocPoint()), 1000);
            let poolId = Number(await chef.poolLength()) - 1
            await chef.setPool(poolId, '500', 0, 0, true, { from: minter });
            assert.equal(Number(await chef.totalAllocPoint()), 500);
            await chef.setPool(0, '1', 0, 0, true, { from: minter });
            assert.equal(Number(await chef.totalAllocPoint()), 501);
        })
    })
});
