const FeeToken = artifacts.require("FeeToken");
const FeeAutoBuyer = artifacts.require("FeeAutoBuyer");
const TestTokenA = artifacts.require("TestTokenA");
const TestTokenB = artifacts.require("TestTokenB");
const TestTokenC = artifacts.require("TestTokenC");
const TestTokenD = artifacts.require("TestTokenD");
const TestCrossroadCallee = artifacts.require("TestCrossroadCallee");

const Crossroad = artifacts.require("Crossroad");

module.exports = function(deployer) {
  deployer.deploy(TestTokenA);
  deployer.deploy(TestTokenB);
  deployer.deploy(TestTokenC);
  deployer.deploy(TestTokenD);
  deployer.deploy(FeeToken).then(() => {
    return deployer.deploy(FeeAutoBuyer,
      FeeToken.address
      ).then(() => {
      return FeeToken.deployed().then(result => {
        return result.transferOperator(FeeAutoBuyer.address).then(() => {
          return deployer.deploy(Crossroad,
            '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
            FeeToken.address,
            FeeAutoBuyer.address
            );
        });
      });
    });
  });
  deployer.deploy(TestCrossroadCallee);
};
