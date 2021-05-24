const gasPrice = BigInt('20000000000');

const FeeToken = artifacts.require("FeeToken");
const FeeAutoBuyer = artifacts.require("FeeAutoBuyer");

const Crossroad = artifacts.require("Crossroad");

contract("TestAutoBuyer", accounts => {
  let feeToken;
  let feeAutoBuyer;

  before(async () => {
    feeToken = await FeeToken.deployed();
    feeAutoBuyer = await FeeAutoBuyer.deployed();
  });

  it("should buy and refund the excess", async () => {
    amount = BigInt('50000000000000000');
    prevBalance = BigInt(await web3.eth.getBalance(accounts[0]));

    transaction = await feeAutoBuyer.buyTokenFixed(amount,accounts[0],accounts[0],
      {from: accounts[0], value: '1000000000000000000'});

    currBalance = BigInt(await web3.eth.getBalance(accounts[0]));

    assert.equal(
      amount,
      BigInt(await feeToken.balanceOf(accounts[0])),
      "Correct amount wasn't transferred"
      );
    assert.equal(
      prevBalance,
      currBalance + amount + BigInt(transaction.receipt.gasUsed)*gasPrice,
      "Excess wasn't refunded"
      );
  });
});
