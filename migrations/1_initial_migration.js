const Migrations = artifacts.require("Migrations");

module.exports = async function (deployer) {
    // Deploy the Migrations contract as our only task
    await deployer.deploy(Migrations);
};