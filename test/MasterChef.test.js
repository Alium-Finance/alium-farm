const { expectRevert, time, constants } = require('@openzeppelin/test-helpers');
const AliumToken = artifacts.require('AliumToken');
const MasterChef = artifacts.require('MasterChef');
const MockBEP20 = artifacts.require('libs/MockBEP20');
const SHPMock = artifacts.require('test/SHPMock');

const { MAX_UINT256 } = constants;

contract('MasterChef', ([alice, bob, dev, minter]) => {
    
    let alm, chef, shp,
        lp1, lp2, lp3, lp4, lp5, lp6, lp7, lp8, lp9

    const FARMING_LIMIT = MAX_UINT256;
    
    beforeEach(async () => {
        alm = await AliumToken.new({ from: minter });
        lp1 = await MockBEP20.new('LPToken', 'LP1', '1000000', { from: minter });
        lp2 = await MockBEP20.new('LPToken', 'LP2', '1000000', { from: minter });
        lp3 = await MockBEP20.new('LPToken', 'LP3', '1000000', { from: minter });
        shp = await SHPMock.new(alm.address, { from: minter });
        chef = await MasterChef.new(alm.address, dev, shp.address, '1000', '100', FARMING_LIMIT, { from: minter });
        await alm.transferOwnership(chef.address, { from: minter });

        await lp1.transfer(bob, '2000', { from: minter });
        await lp2.transfer(bob, '2000', { from: minter });
        await lp3.transfer(bob, '2000', { from: minter });

        await lp1.transfer(alice, '2000', { from: minter });
        await lp2.transfer(alice, '2000', { from: minter });
        await lp3.transfer(alice, '2000', { from: minter });
    });
    
    describe('MasterChef', () => {
        it('real case', async () => {
            lp4 = await MockBEP20.new('LPToken', 'LP1', '1000000', { from: minter });
            lp5 = await MockBEP20.new('LPToken', 'LP2', '1000000', { from: minter });
            lp6 = await MockBEP20.new('LPToken', 'LP3', '1000000', { from: minter });
            lp7 = await MockBEP20.new('LPToken', 'LP1', '1000000', { from: minter });
            lp8 = await MockBEP20.new('LPToken', 'LP2', '1000000', { from: minter });
            lp9 = await MockBEP20.new('LPToken', 'LP3', '1000000', { from: minter });
            await chef.addPool('2000', lp1.address, true, { from: minter });
            await chef.addPool('1000', lp2.address, true, { from: minter });
            await chef.addPool('500', lp3.address, true, { from: minter });
            await chef.addPool('500', lp3.address, true, { from: minter });
            await chef.addPool('500', lp3.address, true, { from: minter });
            await chef.addPool('500', lp3.address, true, { from: minter });
            await chef.addPool('500', lp3.address, true, { from: minter });
            await chef.addPool('100', lp3.address, true, { from: minter });
            await chef.addPool('100', lp3.address, true, { from: minter });
            assert.equal((await chef.poolLength()).toString(), "10");

            await time.advanceBlockTo('170');
            await lp1.approve(chef.address, MAX_UINT256, { from: alice });
            assert.equal((await alm.balanceOf(alice)).toString(), '0');
            await chef.deposit(1, '20', { from: alice });
            await chef.withdraw(1, '20', { from: alice });
            assert.equal((await alm.balanceOf(alice)).toString(), '263');

            await alm.approve(chef.address, MAX_UINT256, { from: alice });
            await chef.stake('20', { from: alice });
            await chef.stake('0', { from: alice });
            await chef.stake('0', { from: alice });
            await chef.stake('0', { from: alice });
            assert.equal((await alm.balanceOf(alice)).toString(), '993');
            // assert.equal((await chef.getPoolPoint(0, { from: minter })).toString(), '1900');
        })

        it('deposit/withdraw', async () => {
            await chef.addPool('1000', lp1.address, true, { from: minter });
            await chef.addPool('1000', lp2.address, true, { from: minter });
            await chef.addPool('1000', lp3.address, true, { from: minter });

            await lp1.approve(chef.address, MAX_UINT256, { from: alice });
            await chef.deposit(1, '20', { from: alice });
            await chef.deposit(1, '0', { from: alice });
            await chef.deposit(1, '40', { from: alice });
            await chef.deposit(1, '0', { from: alice });
            assert.equal((await lp1.balanceOf(alice)).toString(), '1940');
            await chef.withdraw(1, '10', { from: alice });
            assert.equal((await lp1.balanceOf(alice)).toString(), '1950');
            assert.equal((await alm.balanceOf(alice)).toString(), '999');
            assert.equal((await alm.balanceOf(dev)).toString(), '100');

            await lp1.approve(chef.address, MAX_UINT256, { from: bob });
            assert.equal((await lp1.balanceOf(bob)).toString(), '2000');
            await chef.deposit(1, '50', { from: bob });
            assert.equal((await lp1.balanceOf(bob)).toString(), '1950');
            await chef.deposit(1, '0', { from: bob });
            assert.equal((await alm.balanceOf(bob)).toString(), '125');
            await chef.emergencyWithdraw(1, { from: bob });
            assert.equal((await lp1.balanceOf(bob)).toString(), '2000');
        })

        it('staking/unstaking', async () => {
            await chef.addPool('1000', lp1.address, true, { from: minter });
            await chef.addPool('1000', lp2.address, true, { from: minter });
            await chef.addPool('1000', lp3.address, true, { from: minter });

            await lp1.approve(chef.address, MAX_UINT256, { from: alice });
            await chef.deposit(1, '2', { from: alice }); //0
            await chef.withdraw(1, '2', { from: alice }); //1

            // clear alisa balance

            let balanceBefore = (await alm.balanceOf(alice)).toString()

            await alm.approve(chef.address, MAX_UINT256, { from: alice });
            await chef.stake('1', { from: alice });
            await chef.unstake('1', { from: alice });

            let balanceAfter = (await alm.balanceOf(alice)).toString()

            assert.equal(balanceAfter, 2 * balanceBefore);
        });

        it('update multiplier', async () => {
            await chef.addPool('1000', lp1.address, true, { from: minter });
            await chef.addPool('1000', lp2.address, true, { from: minter });
            await chef.addPool('1000', lp3.address, true, { from: minter });

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

            assert.equal((await alm.balanceOf(alice)).toString(), '455');
            assert.equal((await alm.balanceOf(bob)).toString(), '150');

            await time.advanceBlockTo('265');

            await chef.stake('0', { from: alice });
            await chef.stake('0', { from: bob });
            await chef.deposit(1, '0', { from: alice });
            await chef.deposit(1, '0', { from: bob });

            assert.equal((await alm.balanceOf(alice)).toString(), '455');
            assert.equal((await alm.balanceOf(bob)).toString(), '150');

            await chef.unstake('50', { from: alice });
            await chef.unstake('100', { from: bob });
            await chef.withdraw(1, '100', { from: alice });
            await chef.withdraw(1, '100', { from: bob });

        });

        // @todo need check
        it('update multiplier with limit', async () => {
            const FARMING_LIMIT_LOCAL = 100;
            const cakeLocal = await AliumToken.new({ from: minter });
            const chefLocal = await MasterChef.new(cakeLocal.address, dev, '1000', '100', FARMING_LIMIT_LOCAL, { from: minter });
            await cakeLocal.mint(alice, 50, { from: minter })
            await cakeLocal.mint(bob, 100, { from: minter })
            await cakeLocal.transferOwnership(chefLocal.address, { from: minter });

            await chefLocal.addPool('1000', lp1.address, true, { from: minter });
            await chefLocal.addPool('1000', lp2.address, true, { from: minter });
            await chefLocal.addPool('1000', lp3.address, true, { from: minter });

            await lp1.approve(chefLocal.address, MAX_UINT256, { from: alice });
            await lp1.approve(chefLocal.address, MAX_UINT256, { from: bob });
            await chefLocal.deposit(1, '100', { from: alice });
            await chefLocal.deposit(1, '100', { from: bob });
            await chefLocal.deposit(1, '0', { from: alice });
            await chefLocal.deposit(1, '0', { from: bob });

            await cakeLocal.approve(chefLocal.address, MAX_UINT256, { from: alice });
            await cakeLocal.approve(chefLocal.address, MAX_UINT256, { from: bob });
            await chefLocal.stake('50', { from: alice });
            await chefLocal.stake('100', { from: bob });

            await chefLocal.updateMultiplier('0', { from: minter });

            await chefLocal.stake('0', { from: alice });
            await chefLocal.stake('0', { from: bob });
            await chefLocal.deposit(1, '0', { from: alice });
            await chefLocal.deposit(1, '0', { from: bob });

            assert.equal((await cakeLocal.balanceOf(alice)).toString(), '100');
            assert.equal((await cakeLocal.balanceOf(bob)).toString(), '0');

            await time.advanceBlockTo('309');

            await chefLocal.stake('0', { from: alice });
            await chefLocal.stake('0', { from: bob });
            await chefLocal.deposit(1, '0', { from: alice });
            await chefLocal.deposit(1, '0', { from: bob });

            assert.equal((await cakeLocal.balanceOf(alice)).toString(), '100');
            assert.equal((await cakeLocal.balanceOf(bob)).toString(), '0');

            await chefLocal.unstake('50', { from: alice });
            await chefLocal.unstake('100', { from: bob });
            await chefLocal.withdraw(1, '100', { from: alice });
            await chefLocal.withdraw(1, '100', { from: bob });
        });

        it('should allow dev and only dev to update dev', async () => {
            assert.equal((await chef.devaddr()).valueOf(), dev);
            await expectRevert(chef.dev(bob, { from: bob }), 'MasterChef: dev wut?');
            await chef.dev(bob, { from: dev });
            assert.equal((await chef.devaddr()).valueOf(), bob);
            await chef.dev(alice, { from: bob });
            assert.equal((await chef.devaddr()).valueOf(), alice);
        })
    })
});
