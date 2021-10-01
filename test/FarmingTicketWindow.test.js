const { assert } = require("chai");

const AliumToken = artifacts.require('AliumToken');
const FarmingTicketToken = artifacts.require('FarmingTicketToken');
const FarmingTicketWindow = artifacts.require('FarmingTicketWindow');

contract('FarmingTicketWindow', ([alice, bob, founder, deployer]) => {
    beforeEach(async () => {
        this.aliumToken = await AliumToken.new({ from: deployer });
        this.nft = await FarmingTicketToken.new({ from: deployer });
        this.ticketWindow = await FarmingTicketWindow.new(this.aliumToken.address, this.nft.address, founder, { from: deployer });

        await this.nft.transferOwnership(this.ticketWindow.address, { from: deployer })
        await this.aliumToken.mint(alice, '1000000000000000000000000', { from: deployer });
    });

    describe('general', async () => {
        it('#buyTicket', async () => {
            await this.aliumToken.approve(this.ticketWindow.address, '1000000000000000000000000');
            await this.ticketWindow.buyTicket({ from: alice });
            assert.equal(Boolean(await this.ticketWindow.hasTicket(alice)), true);
            assert.equal(String(await this.aliumToken.balanceOf(founder)), '1500000000000000000000');
        })

        it('#passFree', async () => {
            await this.ticketWindow.passFree(bob, { from: deployer });
            assert.equal(Boolean(await this.ticketWindow.hasTicket(bob)), true);
        })
    })
});
