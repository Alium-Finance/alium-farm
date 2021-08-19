const { assert } = require("chai");

const AliumToken = artifacts.require('AliumToken');

contract('AliumToken', ([alice, bob, minter, voting]) => {
    beforeEach(async () => {
        this.alm = await AliumToken.new({ from: minter });
    });

    describe('ALM', async () => {
        it('mint', async () => {
            await this.alm.mint(alice, 1000, { from: minter });
            assert.equal((await this.alm.balanceOf(alice)).toString(), '1000');
        })

        it('transfer', async () => {
            await this.alm.mint(alice, 1000, { from: minter });
            await this.alm.transfer(bob, 500, { from: alice });
            assert.equal((await this.alm.balanceOf(alice)).toString(), '500');
            assert.equal((await this.alm.balanceOf(bob)).toString(), '500');
        })

        it('transfer with delegates', async () => {
            await this.alm.mint(alice, 1000, { from: minter });
            await this.alm.delegate(voting, { from: alice });
            assert.equal((await this.alm.getCurrentVotes(voting)).toString(), '1000');
            await this.alm.transfer(bob, 500, { from: alice });
            assert.equal((await this.alm.getCurrentVotes(voting)).toString(), '500');
            await this.alm.delegate(voting, { from: bob });
            assert.equal((await this.alm.getCurrentVotes(voting)).toString(), '1000');
        })

    })
});
