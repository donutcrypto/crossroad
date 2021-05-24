const path = require("path");
const os = require("os");

const HDWalletProvider = require("@truffle/hdwallet-provider");
devkey = process.env.DJINN_DEV_PRIVATE_KEY

module.exports = {
  compilers: {
    solc: {
      version: "0.8.3",
    },
  },
  "optimizer": {
    "enabled": true,
    "runs": 9999
  },
  // See <http://truffleframework.com/docs/advanced/configuration>
  // to customize your Truffle configuration!
  // contracts_build_directory: path.join(__dirname, "app/src/contracts"),
  networks: {
    develop: { // default with truffle unbox is 7545, but we can use develop to test changes, ex. truffle migrate --network develop
      host: "127.0.0.1",
      port: 8545,
      network_id: "*"
    },
    bsc: {
      provider: new HDWalletProvider({privateKeys: [devkey], providerOrUrl: "https://bsc-dataseed1.binance.org"}),
      network_id: 56,
      confirmations: 10,
      timeoutBlocks: 200,
      skipDryRun: true
    }
  },
  plugins: [
    'truffle-plugin-verify'
  ],
  api_keys: {
    bscscan: process.env.BSCSCAN_API_KEY
  }
};
