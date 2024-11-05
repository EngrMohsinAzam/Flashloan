require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [
      { version: "0.8.27" },  // Primary Solidity version
      { version: "0.6.6" },   // Version for UniswapV2Library.sol
      { version: "0.5.5" },   // Additional version if needed for other dependencies
      { version: "0.8.8" },   // Additional version if needed for other dependencies
    ],
  },
  networks: {
    hardhat: {
      forking: {
        url: "https://bsc-dataseed1.binance.org/",
        // It's recommended to use a specific block number for consistent testing
        // blockNumber: 10000000, // Replace with a recent block number
      },
      gas: 12000000,
      blockGasLimit: 0x1fffffffffffff,
      allowUnlimitedContractSize: true,
      timeout: 1800000
    },
  },
  mocha: {
    timeout: 100000
  },
};