const MasterChef = artifacts.require("MasterChef");
const FarmingTicketToken = artifacts.require("FarmingTicketToken");
const FarmingTicketWindow = artifacts.require("FarmingTicketWindow");
const MockAliumCashbox = artifacts.require("MockAliumCashbox");
const AliumToken = artifacts.require("AliumToken");

const { constants } = require('@openzeppelin/test-helpers');
const { MAX_UINT256 } = constants;

async function deploy(deployer, network, accounts) {
    console.log(network)
    console.log(accounts)

    if (network === 'bscTestnet') {
        const ALM = '0xfECb47AFD19d96F6bDa5d5883FcA7230beb6fD70'
        const DEV = '0xaD0E3142A17e06dB27e529Ed82858A6a3Fdf67BD'
        const SHP = '0x65533E342449dcC24062126A3aa17E670f1B762D'

        await deployer.deploy(MockAliumCashbox)
        const aliumCashbox = await MockAliumCashbox.deployed()

        await aliumCashbox.initialize(ALM, (typeof accounts === 'string') ? accounts : accounts[0])
    }


    if (network === 'bscMainnet') {
        const ALM = '0x7C38870e93A1f959cB6c533eB10bBc3e438AaC11' // AliumToken
        const DEV = '0xe5a65aee2E66178432d3f71984761514856D8f6E' // SafeStorage
        const SHP = '0xF33F1636361e23cd3196DeB488a453D8B2ED00Bc' // Strong Holders Pool
        const farmingTicketWindow = '0x9F55e6Aa18647DC6a35b295A236439a7E9933650' // TicketWindow
        const cashbox = '' // Cashbox
        const startBlock = '11364400'
        const rewards = [
            {"amount": "7000000000000000000", "blocks": "428572"},
            {"amount": "5000000000000000000", "blocks": "300000"},
            {"amount": "2000000000000000000", "blocks": "250000"}
        ]

        await deployer.deploy(MasterChef, ALM, DEV, SHP, farmingTicketWindow, startBlock, rewards)
    }
}

module.exports = function(deployer, network, accounts) {
    deploy(deployer, network, accounts)
        .catch(console.error)
};