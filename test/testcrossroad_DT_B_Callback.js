const gasPrice = BigInt('20000000000');

const SafeERC20 = artifacts.require("SafeERC20");

const FeeToken = artifacts.require("FeeToken");
const FeeAutoBuyer = artifacts.require("FeeAutoBuyer");

const TestTokenA = artifacts.require("TestTokenA");
const TestTokenB = artifacts.require("TestTokenB");
const TestTokenC = artifacts.require("TestTokenC");
const TestTokenD = artifacts.require("TestTokenD");

const Crossroad = artifacts.require("Crossroad");
const TestCrossroadCallee = artifacts.require("TestCrossroadCallee");

const getCurrentTime = () => {return BigInt(Math.floor(Date.now() / 1000))};

const MAX_VALUE = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'

const INITIAL_SUPPLY = 100000000000000000000n;
const SHARE_SUPPLY = 20000000000000000000n; // a fifth of initial supply

const assertEqBigInt = (
  left,
  right,
  message
  ) =>
{
  assert.equal(BigInt(left).toString(),BigInt(right).toString(),message);
}

const checkOrder = async (
  crossroad,
  orderId,
  checkPoster,
  checkTokenIn,
  checkTokenOut,
  checkTokenReward,
  checkAmountIn,
  checkAmountOut,
  checkExpiryTime,
  checkDeposit
  ) =>
{
  const orderPoster_ = await crossroad.orderPoster(orderId);
  const orderTokenIn_ = await crossroad.orderTokenIn(orderId);
  const orderTokenOut_ = await crossroad.orderTokenOut(orderId);
  const orderTokenReward_ = await crossroad.orderTokenReward(orderId);
  const orderAmountIn_ = await crossroad.orderAmountIn(orderId);
  const orderAmountOut_ = await crossroad.orderAmountOut(orderId);
  const orderExpiryTime_ = await crossroad.orderExpiryTime(orderId);
  const orderDeposit_ = await crossroad.orderDeposit(orderId);

  assert.equal(checkPoster, orderPoster_, "Mismatch: poster");
  assert.equal(checkTokenIn, orderTokenIn_, "Mismatch: tokenIn");
  assert.equal(checkTokenOut, orderTokenOut_, "Mismatch: tokenOut");
  assert.equal(checkTokenReward, orderTokenReward_, "Mismatch: tokenReward");
  assertEqBigInt(checkAmountIn, orderAmountIn_, "Mismatch: amountIn");
  assertEqBigInt(checkAmountOut, orderAmountOut_, "Mismatch: amountOut");
  assertEqBigInt(checkExpiryTime, orderExpiryTime_, "Mismatch: expiryTime");
  assertEqBigInt(checkDeposit, orderDeposit_, "Mismatch: deposit");
};

const checkOrderState = async (
  crossroad,
  orderId,
  checkStatus,
  checkRemainingIn,
  checkRemainingOut,
  checkRemainingReward
  ) =>
{
  const orderStatus_ = await crossroad.orderStatus(orderId);
  const orderRemainingIn_ = await crossroad.orderRemainingIn(orderId);
  const orderRemainingOut_ = await crossroad.orderRemainingOut(orderId);
  const orderRemainingReward_ = await crossroad.orderRemainingReward(orderId);

  assertEqBigInt(checkStatus, orderStatus_, "Mismatch: status");
  assertEqBigInt(checkRemainingIn, orderRemainingIn_, "Mismatch: remainingIn");
  assertEqBigInt(checkRemainingOut, orderRemainingOut_, "Mismatch: remainingOut");
  assertEqBigInt(checkRemainingReward, orderRemainingReward_, "Mismatch: remainingReward");
}

const padAddress = address => {
  return '0x000000000000000000000000'+address.slice(2,42);
};

//
// Fill Bnb Partial 1
//

contract("TestCrossroad_PostDepositBnbPayFee_FillBnbPartial1", accounts => {
  let feeToken;
  let feeAutoBuyer;

  let testTokenA;
  let testTokenB;
  let testTokenC;
  let testTokenD;

  let crossroad;
  let projectAddress;

  let feeAmount;

  let testCallee;

  before(async () => {
    feeToken = await FeeToken.deployed();
    feeAutoBuyer = await FeeAutoBuyer.deployed();

    testTokenA = await TestTokenA.deployed();
    testTokenB = await TestTokenB.deployed();
    testTokenC = await TestTokenC.deployed();
    testTokenD = await TestTokenD.deployed();

    crossroad = await Crossroad.deployed();

    const projectAddress_ = await crossroad.projectAddress();
    projectAddress = projectAddress_;

    const feeAmount_ = await crossroad.feeAmount();
    feeAmount = BigInt(feeAmount_);

    for (var i = 1; i <= 4; ++i) {
      await testTokenA.transfer(accounts[i], SHARE_SUPPLY);
      await testTokenB.transfer(accounts[i], SHARE_SUPPLY);
      await testTokenC.transfer(accounts[i], SHARE_SUPPLY);
      await testTokenD.transfer(accounts[i], SHARE_SUPPLY);
    }

    testCallee = await TestCrossroadCallee.deployed();
  });

  it("should post deposit token", async () => {
    now = getCurrentTime();

    await feeToken.approve(crossroad.address,MAX_VALUE,{from: accounts[0]});
    await testTokenA.approve(crossroad.address,MAX_VALUE,{from: accounts[0]});

    const initPosterBnbAmount = BigInt(await web3.eth.getBalance(accounts[0]));
    const initFillerBnbAmount = BigInt(await web3.eth.getBalance(accounts[1]));

    // buy fee and reward
    const inputAmountIn = 1000000000000000000n;
    const inputAmountOut = 2000000000000000000n;
    const inputAmountReward = 50000000000000000n;

    const feeTx = await feeAutoBuyer.buyTokenFixed(feeAmount+inputAmountReward,accounts[0],accounts[0],
      {from: accounts[0], value: (feeAmount+inputAmountReward).toString()});
    const feeGasUsed = BigInt(feeTx.receipt.gasUsed);

    // post order
    const postTx = await crossroad.postOrderPayFee(
      testTokenA.address, // _tokenIn,
      '0x0000000000000000000000000000000000000000', // _tokenOut,
      inputAmountIn, // _amountIn,
      inputAmountOut, // _amountOut,
      now+1200n, // _expiryTime,
      true, // _deposit,
      inputAmountReward, // _rewardAmount
      {from: accounts[0]}
      );
    const postGasUsed = BigInt(postTx.receipt.gasUsed);
    console.log('post gas: '+postGasUsed.toString());

    // fill order complete
    const fillAmountOut = 500000000000000000n; // 25% of amount out

    const callbackData = web3.utils.bytesToHex(
        web3.utils.hexToBytes(padAddress(testTokenA.address)).concat(
        web3.utils.hexToBytes(padAddress(feeToken.address)))
        );

    const depositTx = await testCallee.deposit(
      {from: accounts[1], value: fillAmountOut.toString()}
      )
    const depositGasUsed = BigInt(depositTx.receipt.gasUsed);
    console.log('deposit gas: '+depositGasUsed.toString());

    const fillTx = await crossroad.fillOrderOutBnb(
      1n, // _orderId
      fillAmountOut, // _amountOut
      testCallee.address, // _to
      true, // _callback
      callbackData, // _callbackData
      {from: accounts[1]}
      );
    const fillGasUsed = BigInt(fillTx.receipt.gasUsed);
    console.log('fill gas: '+fillGasUsed.toString());

    // checks
    const orderCount_ = await crossroad.orderCount();
    assertEqBigInt(orderCount_, 1n, "Mismatch: orderCount");

    const posterBnbAmount = BigInt(await web3.eth.getBalance(accounts[0]));
    const fillerBnbAmount = BigInt(await web3.eth.getBalance(accounts[1]));
    const crossroadBnbAmount = BigInt(await web3.eth.getBalance(crossroad.address));
    assertEqBigInt(posterBnbAmount,initPosterBnbAmount-feeAmount-inputAmountReward+fillAmountOut-(feeGasUsed+postGasUsed)*gasPrice, "Mismatch: posterBnbAmount");
    assertEqBigInt(fillerBnbAmount,initFillerBnbAmount-fillAmountOut-(depositGasUsed+fillGasUsed)*gasPrice, "Mismatch: fillerBnbAmount");
    assertEqBigInt(crossroadBnbAmount,0n, "Mismatch: crossroadBnbAmount");

    const posterBalanceA_ = await testTokenA.balanceOf(accounts[0]);
    const fillerBalanceA_ = await testTokenA.balanceOf(accounts[1]);
    const crossroadBalanceA_ = await testTokenA.balanceOf(crossroad.address);
    assertEqBigInt(posterBalanceA_, SHARE_SUPPLY-inputAmountIn, "Mismatch: posterBalanceA");
    assertEqBigInt(fillerBalanceA_, SHARE_SUPPLY+inputAmountIn*25n/100n, "Mismatch: fillerBalanceA");
    assertEqBigInt(crossroadBalanceA_, inputAmountIn*75n/100n, "Mismatch: crossroadBalanceA");

    const posterBalanceFee_ = await feeToken.balanceOf(accounts[0]);
    const fillerBalanceFee_ = await feeToken.balanceOf(accounts[1]);
    const crossroadBalanceFee_ = await feeToken.balanceOf(crossroad.address);
    const projectBalanceFee_ = await feeToken.balanceOf(projectAddress);
    assertEqBigInt(posterBalanceFee_, 0n, "Mismatch: posterBalanceFee");
    assertEqBigInt(fillerBalanceFee_, inputAmountReward*25n/100n, "Mismatch: fillerBalanceFee");
    assertEqBigInt(crossroadBalanceFee_, inputAmountReward*75n/100n, "Mismatch: crossroadBalanceFee");
    assertEqBigInt(projectBalanceFee_, feeAmount, "Mismatch: projectBalanceFee");

    await checkOrder(
      crossroad,
      1n,
      accounts[0],
      testTokenA.address,
      '0x0000000000000000000000000000000000000000',
      feeToken.address,
      inputAmountIn,
      inputAmountOut,
      now+1200n,
      true
      );

    await checkOrderState(
      crossroad,
      1n,
      1n,
      inputAmountIn*75n/100n,
      inputAmountOut*75n/100n,
      inputAmountReward*75n/100n
      );

    const orderCanBeFilled_ = await crossroad.orderCanBeFilled(1n);
    const orderCanBeFilledCompleteCheckAllowanceAndBalance_ = await crossroad.orderCanBeFilledCompleteCheckAllowanceAndBalance(1n);
    const orderRemainingInCheckAllowanceAndBalance_ = await crossroad.orderRemainingInCheckAllowanceAndBalance(1n);
    const orderAmountInFromAmountOut_ = await crossroad.orderAmountInFromAmountOut(1n, 1000000000000000000n);
    const orderAmountRewardFromAmountOut_ = await crossroad.orderAmountRewardFromAmountOut(1n, 1000000000000000000n);

    assert.equal(orderCanBeFilled_, true, "Mismatch: orderCanBeFilled");
    assert.equal(orderCanBeFilledCompleteCheckAllowanceAndBalance_, true, "Mismatch: orderCanBeFilledCompleteCheckAllowanceAndBalance");
    assertEqBigInt(orderRemainingInCheckAllowanceAndBalance_, inputAmountIn*75n/100n, "Mismatch: orderRemainingInCheckAllowanceAndBalance");
    assertEqBigInt(orderAmountInFromAmountOut_, 500000000000000000n, "Mismatch: orderAmountInFromAmountOut");
    assertEqBigInt(orderAmountRewardFromAmountOut_, 25000000000000000n, "Mismatch: orderAmountRewardFromAmountOut");
  });
});

//
// Fill Bnb Partial 2
//

contract("TestCrossroad_PostDepositBnbPayFee_FillBnbPartial2", accounts => {
  let feeToken;
  let feeAutoBuyer;

  let testTokenA;
  let testTokenB;
  let testTokenC;
  let testTokenD;

  let crossroad;
  let projectAddress;

  let feeAmount;

  let testCallee;

  before(async () => {
    feeToken = await FeeToken.deployed();
    feeAutoBuyer = await FeeAutoBuyer.deployed();

    testTokenA = await TestTokenA.deployed();
    testTokenB = await TestTokenB.deployed();
    testTokenC = await TestTokenC.deployed();
    testTokenD = await TestTokenD.deployed();

    crossroad = await Crossroad.deployed();

    const projectAddress_ = await crossroad.projectAddress();
    projectAddress = projectAddress_;

    const feeAmount_ = await crossroad.feeAmount();
    feeAmount = BigInt(feeAmount_);

    for (var i = 1; i <= 4; ++i) {
      await testTokenA.transfer(accounts[i], SHARE_SUPPLY);
      await testTokenB.transfer(accounts[i], SHARE_SUPPLY);
      await testTokenC.transfer(accounts[i], SHARE_SUPPLY);
      await testTokenD.transfer(accounts[i], SHARE_SUPPLY);
    }

    testCallee = await TestCrossroadCallee.deployed();
  });

  it("should post deposit token", async () => {
    now = getCurrentTime();

    await feeToken.approve(crossroad.address,MAX_VALUE,{from: accounts[0]});
    await testTokenA.approve(crossroad.address,MAX_VALUE,{from: accounts[0]});

    const initPosterBnbAmount = BigInt(await web3.eth.getBalance(accounts[0]));
    const initFiller1BnbAmount = BigInt(await web3.eth.getBalance(accounts[1]));
    const initFiller2BnbAmount = BigInt(await web3.eth.getBalance(accounts[2]));

    // buy fee and reward
    const inputAmountIn = 1000000000000000000n;
    const inputAmountOut = 2000000000000000000n;
    const inputAmountReward = 50000000000000000n;

    const feeTx = await feeAutoBuyer.buyTokenFixed(feeAmount+inputAmountReward,accounts[0],accounts[0],
      {from: accounts[0], value: (feeAmount+inputAmountReward).toString()});
    const feeGasUsed = BigInt(feeTx.receipt.gasUsed);

    // post order
    const postTx = await crossroad.postOrderPayFee(
      testTokenA.address, // _tokenIn,
      '0x0000000000000000000000000000000000000000', // _tokenOut,
      inputAmountIn, // _amountIn,
      inputAmountOut, // _amountOut,
      now+1200n, // _expiryTime,
      true, // _deposit,
      inputAmountReward, // _rewardAmount
      {from: accounts[0]}
      );
    const postGasUsed = BigInt(postTx.receipt.gasUsed);
    console.log('post gas: '+postGasUsed.toString());

    // fill order complete
    const fillAmountOut1 = 500000000000000000n; // 25% of amount out
    const fillAmountOut2 = 800000000000000000n; // 40% of amount out

    const callbackData = web3.utils.bytesToHex(
        web3.utils.hexToBytes(padAddress(testTokenA.address)).concat(
        web3.utils.hexToBytes(padAddress(feeToken.address)))
        );

    const deposit1Tx = await testCallee.deposit(
      {from: accounts[1], value: fillAmountOut1.toString()}
      )
    const deposit1GasUsed = BigInt(deposit1Tx.receipt.gasUsed);
    console.log('deposit1 gas: '+deposit1GasUsed.toString());

    const fill1Tx = await crossroad.fillOrderOutBnb(
      1n, // _orderId
      fillAmountOut1, // _amountOut
      testCallee.address, // _to
      true, // _callback
      callbackData, // _callbackData
      {from: accounts[1]}
      );
    const fill1GasUsed = BigInt(fill1Tx.receipt.gasUsed);
    console.log('fill1 gas: '+fill1GasUsed.toString());

    const deposit2Tx = await testCallee.deposit(
      {from: accounts[2], value: fillAmountOut2.toString()}
      )
    const deposit2GasUsed = BigInt(deposit2Tx.receipt.gasUsed);
    console.log('deposit2 gas: '+deposit2GasUsed.toString());

    const fill2Tx = await crossroad.fillOrderOutBnb(
      1n, // _orderId
      fillAmountOut2, // _amountOut
      testCallee.address, // _to
      true, // _callback
      callbackData, // _callbackData
      {from: accounts[2]}
      );
    const fill2GasUsed = BigInt(fill2Tx.receipt.gasUsed);
    console.log('fill2 gas: '+fill2GasUsed.toString());

    // checks
    const orderCount_ = await crossroad.orderCount();
    assertEqBigInt(orderCount_, 1n, "Mismatch: orderCount");

    const posterBnbAmount = BigInt(await web3.eth.getBalance(accounts[0]));
    const filler1BnbAmount = BigInt(await web3.eth.getBalance(accounts[1]));
    const filler2BnbAmount = BigInt(await web3.eth.getBalance(accounts[2]));
    const crossroadBnbAmount = BigInt(await web3.eth.getBalance(crossroad.address));
    assertEqBigInt(posterBnbAmount,initPosterBnbAmount-feeAmount-inputAmountReward+fillAmountOut1+fillAmountOut2-(feeGasUsed+postGasUsed)*gasPrice, "Mismatch: posterBnbAmount");
    assertEqBigInt(filler1BnbAmount,initFiller1BnbAmount-fillAmountOut1-(deposit1GasUsed+fill1GasUsed)*gasPrice, "Mismatch: filler1BnbAmount");
    assertEqBigInt(filler2BnbAmount,initFiller2BnbAmount-fillAmountOut2-(deposit2GasUsed+fill2GasUsed)*gasPrice, "Mismatch: filler2BnbAmount");
    assertEqBigInt(crossroadBnbAmount,0n, "Mismatch: crossroadBnbAmount");

    const posterBalanceA_ = await testTokenA.balanceOf(accounts[0]);
    const filler1BalanceA_ = await testTokenA.balanceOf(accounts[1]);
    const filler2BalanceA_ = await testTokenA.balanceOf(accounts[2]);
    const crossroadBalanceA_ = await testTokenA.balanceOf(crossroad.address);
    assertEqBigInt(posterBalanceA_, SHARE_SUPPLY-inputAmountIn, "Mismatch: posterBalanceA");
    assertEqBigInt(filler1BalanceA_, SHARE_SUPPLY+inputAmountIn*25n/100n, "Mismatch: filler1BalanceA");
    assertEqBigInt(filler2BalanceA_, SHARE_SUPPLY+inputAmountIn*40n/100n, "Mismatch: filler2BalanceA");
    assertEqBigInt(crossroadBalanceA_, inputAmountIn*35n/100n, "Mismatch: crossroadBalanceA");

    const posterBalanceFee_ = await feeToken.balanceOf(accounts[0]);
    const filler1BalanceFee_ = await feeToken.balanceOf(accounts[1]);
    const filler2BalanceFee_ = await feeToken.balanceOf(accounts[2]);
    const crossroadBalanceFee_ = await feeToken.balanceOf(crossroad.address);
    const projectBalanceFee_ = await feeToken.balanceOf(projectAddress);
    assertEqBigInt(posterBalanceFee_, 0n, "Mismatch: posterBalanceFee");
    assertEqBigInt(filler1BalanceFee_, inputAmountReward*25n/100n, "Mismatch: filler1BalanceFee");
    assertEqBigInt(filler2BalanceFee_, inputAmountReward*40n/100n, "Mismatch: filler2BalanceFee");
    assertEqBigInt(crossroadBalanceFee_, inputAmountReward*35n/100n, "Mismatch: crossroadBalanceFee");
    assertEqBigInt(projectBalanceFee_, feeAmount, "Mismatch: projectBalanceFee");

    await checkOrder(
      crossroad,
      1n,
      accounts[0],
      testTokenA.address,
      '0x0000000000000000000000000000000000000000',
      feeToken.address,
      inputAmountIn,
      inputAmountOut,
      now+1200n,
      true
      );

    await checkOrderState(
      crossroad,
      1n,
      1n,
      inputAmountIn*35n/100n,
      inputAmountOut*35n/100n,
      inputAmountReward*35n/100n
      );

    const orderCanBeFilled_ = await crossroad.orderCanBeFilled(1n);
    const orderCanBeFilledCompleteCheckAllowanceAndBalance_ = await crossroad.orderCanBeFilledCompleteCheckAllowanceAndBalance(1n);
    const orderRemainingInCheckAllowanceAndBalance_ = await crossroad.orderRemainingInCheckAllowanceAndBalance(1n);
    const orderAmountInFromAmountOut_ = await crossroad.orderAmountInFromAmountOut(1n, 1000000000000000000n);
    const orderAmountRewardFromAmountOut_ = await crossroad.orderAmountRewardFromAmountOut(1n, 1000000000000000000n);

    assert.equal(orderCanBeFilled_, true, "Mismatch: orderCanBeFilled");
    assert.equal(orderCanBeFilledCompleteCheckAllowanceAndBalance_, true, "Mismatch: orderCanBeFilledCompleteCheckAllowanceAndBalance");
    assertEqBigInt(orderRemainingInCheckAllowanceAndBalance_, inputAmountIn*35n/100n, "Mismatch: orderRemainingInCheckAllowanceAndBalance");
    assertEqBigInt(orderAmountInFromAmountOut_, 350000000000000000n, "Mismatch: orderAmountInFromAmountOut");
    assertEqBigInt(orderAmountRewardFromAmountOut_, 17500000000000000n, "Mismatch: orderAmountRewardFromAmountOut");
  });
});

//
// Fill Bnb All 1
//

contract("TestCrossroad_PostDepositBnbPayFee_FillBnbAll1", accounts => {
  let feeToken;
  let feeAutoBuyer;

  let testTokenA;
  let testTokenB;
  let testTokenC;
  let testTokenD;

  let crossroad;
  let projectAddress;

  let feeAmount;

  let testCallee;

  before(async () => {
    feeToken = await FeeToken.deployed();
    feeAutoBuyer = await FeeAutoBuyer.deployed();

    testTokenA = await TestTokenA.deployed();
    testTokenB = await TestTokenB.deployed();
    testTokenC = await TestTokenC.deployed();
    testTokenD = await TestTokenD.deployed();

    crossroad = await Crossroad.deployed();

    const projectAddress_ = await crossroad.projectAddress();
    projectAddress = projectAddress_;

    const feeAmount_ = await crossroad.feeAmount();
    feeAmount = BigInt(feeAmount_);

    for (var i = 1; i <= 4; ++i) {
      await testTokenA.transfer(accounts[i], SHARE_SUPPLY);
      await testTokenB.transfer(accounts[i], SHARE_SUPPLY);
      await testTokenC.transfer(accounts[i], SHARE_SUPPLY);
      await testTokenD.transfer(accounts[i], SHARE_SUPPLY);
    }

    testCallee = await TestCrossroadCallee.deployed();
  });

  it("should post deposit token", async () => {
    now = getCurrentTime();

    await feeToken.approve(crossroad.address,MAX_VALUE,{from: accounts[0]});
    await testTokenA.approve(crossroad.address,MAX_VALUE,{from: accounts[0]});

    const initPosterBnbAmount = BigInt(await web3.eth.getBalance(accounts[0]));
    const initFillerBnbAmount = BigInt(await web3.eth.getBalance(accounts[1]));

    // buy fee and reward
    const inputAmountIn = 1000000000000000000n;
    const inputAmountOut = 2000000000000000000n;
    const inputAmountReward = 50000000000000000n;

    const feeTx = await feeAutoBuyer.buyTokenFixed(feeAmount+inputAmountReward,accounts[0],accounts[0],
      {from: accounts[0], value: (feeAmount+inputAmountReward).toString()});
    const feeGasUsed = BigInt(feeTx.receipt.gasUsed);

    // post order
    const postTx = await crossroad.postOrderPayFee(
      testTokenA.address, // _tokenIn,
      '0x0000000000000000000000000000000000000000', // _tokenOut,
      inputAmountIn, // _amountIn,
      inputAmountOut, // _amountOut,
      now+1200n, // _expiryTime,
      true, // _deposit,
      inputAmountReward, // _rewardAmount
      {from: accounts[0]}
      );
    const postGasUsed = BigInt(postTx.receipt.gasUsed);
    console.log('post gas: '+postGasUsed.toString());

    // fill order complete
    const callbackData = web3.utils.bytesToHex(
        web3.utils.hexToBytes(padAddress(testTokenA.address)).concat(
        web3.utils.hexToBytes(padAddress(feeToken.address)))
        );

    const depositTx = await testCallee.deposit(
      {from: accounts[1], value: inputAmountOut.toString()}
      )
    const depositGasUsed = BigInt(depositTx.receipt.gasUsed);
    console.log('deposit gas: '+depositGasUsed.toString());

    const fillTx = await crossroad.fillOrderOutBnb(
      1n, // _orderId
      inputAmountOut, // _amountOut
      testCallee.address, // _to
      true, // _callback
      callbackData, // _callbackData
      {from: accounts[1]}
      );
    const fillGasUsed = BigInt(fillTx.receipt.gasUsed);
    console.log('fill gas: '+fillGasUsed.toString());

    // checks
    const orderCount_ = await crossroad.orderCount();
    assertEqBigInt(orderCount_, 1n, "Mismatch: orderCount");

    const posterBnbAmount = BigInt(await web3.eth.getBalance(accounts[0]));
    const fillerBnbAmount = BigInt(await web3.eth.getBalance(accounts[1]));
    const crossroadBnbAmount = BigInt(await web3.eth.getBalance(crossroad.address));
    assertEqBigInt(posterBnbAmount,initPosterBnbAmount-feeAmount-inputAmountReward+inputAmountOut-(feeGasUsed+postGasUsed)*gasPrice, "Mismatch: posterBnbAmount");
    assertEqBigInt(fillerBnbAmount,initFillerBnbAmount-inputAmountOut-(depositGasUsed+fillGasUsed)*gasPrice, "Mismatch: fillerBnbAmount");
    assertEqBigInt(crossroadBnbAmount,0n, "Mismatch: crossroadBnbAmount");

    const posterBalanceA_ = await testTokenA.balanceOf(accounts[0]);
    const fillerBalanceA_ = await testTokenA.balanceOf(accounts[1]);
    const crossroadBalanceA_ = await testTokenA.balanceOf(crossroad.address);
    assertEqBigInt(posterBalanceA_, SHARE_SUPPLY-inputAmountIn, "Mismatch: posterBalanceA");
    assertEqBigInt(fillerBalanceA_, SHARE_SUPPLY+inputAmountIn, "Mismatch: fillerBalanceA");
    assertEqBigInt(crossroadBalanceA_, 0n, "Mismatch: crossroadBalanceA");

    const posterBalanceFee_ = await feeToken.balanceOf(accounts[0]);
    const fillerBalanceFee_ = await feeToken.balanceOf(accounts[1]);
    const crossroadBalanceFee_ = await feeToken.balanceOf(crossroad.address);
    const projectBalanceFee_ = await feeToken.balanceOf(projectAddress);
    assertEqBigInt(posterBalanceFee_, 0n, "Mismatch: posterBalanceFee");
    assertEqBigInt(fillerBalanceFee_, inputAmountReward*100n/100n, "Mismatch: fillerBalanceFee");
    assertEqBigInt(crossroadBalanceFee_, inputAmountReward*0n/100n, "Mismatch: crossroadBalanceFee");
    assertEqBigInt(projectBalanceFee_, feeAmount, "Mismatch: projectBalanceFee");

    await checkOrder(
      crossroad,
      1n,
      accounts[0],
      testTokenA.address,
      '0x0000000000000000000000000000000000000000',
      feeToken.address,
      inputAmountIn,
      inputAmountOut,
      now+1200n,
      true
      );

    await checkOrderState(
      crossroad,
      1n,
      3n,
      inputAmountIn*0n/100n,
      inputAmountOut*0n/100n,
      inputAmountReward*0n/100n
      );

    const orderCanBeFilled_ = await crossroad.orderCanBeFilled(1n);
    const orderCanBeFilledCompleteCheckAllowanceAndBalance_ = await crossroad.orderCanBeFilledCompleteCheckAllowanceAndBalance(1n);
    const orderRemainingInCheckAllowanceAndBalance_ = await crossroad.orderRemainingInCheckAllowanceAndBalance(1n);
    const orderAmountInFromAmountOut_ = await crossroad.orderAmountInFromAmountOut(1n, 1000000000000000000n);
    const orderAmountRewardFromAmountOut_ = await crossroad.orderAmountRewardFromAmountOut(1n, 1000000000000000000n);

    assert.equal(orderCanBeFilled_, false, "Mismatch: orderCanBeFilled");
    assert.equal(orderCanBeFilledCompleteCheckAllowanceAndBalance_, false, "Mismatch: orderCanBeFilledCompleteCheckAllowanceAndBalance");
    assertEqBigInt(orderRemainingInCheckAllowanceAndBalance_, 0n, "Mismatch: orderRemainingInCheckAllowanceAndBalance");
    assertEqBigInt(orderAmountInFromAmountOut_, 0n, "Mismatch: orderAmountInFromAmountOut");
    assertEqBigInt(orderAmountRewardFromAmountOut_, 0n, "Mismatch: orderAmountRewardFromAmountOut");
  });
});

//
// Fill Bnb All 2
//

contract("TestCrossroad_PostDepositBnbPayFee_FillBnbAll2", accounts => {
  let feeToken;
  let feeAutoBuyer;

  let testTokenA;
  let testTokenB;
  let testTokenC;
  let testTokenD;

  let crossroad;
  let projectAddress;

  let feeAmount;

  let testCallee;

  before(async () => {
    feeToken = await FeeToken.deployed();
    feeAutoBuyer = await FeeAutoBuyer.deployed();

    testTokenA = await TestTokenA.deployed();
    testTokenB = await TestTokenB.deployed();
    testTokenC = await TestTokenC.deployed();
    testTokenD = await TestTokenD.deployed();

    crossroad = await Crossroad.deployed();

    const projectAddress_ = await crossroad.projectAddress();
    projectAddress = projectAddress_;

    const feeAmount_ = await crossroad.feeAmount();
    feeAmount = BigInt(feeAmount_);

    for (var i = 1; i <= 4; ++i) {
      await testTokenA.transfer(accounts[i], SHARE_SUPPLY);
      await testTokenB.transfer(accounts[i], SHARE_SUPPLY);
      await testTokenC.transfer(accounts[i], SHARE_SUPPLY);
      await testTokenD.transfer(accounts[i], SHARE_SUPPLY);
    }

    testCallee = await TestCrossroadCallee.deployed();
  });

  it("should post deposit token", async () => {
    now = getCurrentTime();

    await feeToken.approve(crossroad.address,MAX_VALUE,{from: accounts[0]});
    await testTokenA.approve(crossroad.address,MAX_VALUE,{from: accounts[0]});

    const initPosterBnbAmount = BigInt(await web3.eth.getBalance(accounts[0]));
    const initFiller1BnbAmount = BigInt(await web3.eth.getBalance(accounts[1]));
    const initFiller2BnbAmount = BigInt(await web3.eth.getBalance(accounts[2]));
    const initFiller3BnbAmount = BigInt(await web3.eth.getBalance(accounts[3]));

    // buy fee and reward
    const inputAmountIn = 1000000000000000000n;
    const inputAmountOut = 2000000000000000000n;
    const inputAmountReward = 50000000000000000n;

    const feeTx = await feeAutoBuyer.buyTokenFixed(feeAmount+inputAmountReward,accounts[0],accounts[0],
      {from: accounts[0], value: (feeAmount+inputAmountReward).toString()});
    const feeGasUsed = BigInt(feeTx.receipt.gasUsed);

    // post order
    const postTx = await crossroad.postOrderPayFee(
      testTokenA.address, // _tokenIn,
      '0x0000000000000000000000000000000000000000', // _tokenOut,
      inputAmountIn, // _amountIn,
      inputAmountOut, // _amountOut,
      now+1200n, // _expiryTime,
      true, // _deposit,
      inputAmountReward, // _rewardAmount
      {from: accounts[0]}
      );
    const postGasUsed = BigInt(postTx.receipt.gasUsed);
    console.log('post gas: '+postGasUsed.toString());

    // fill order complete
    const fillAmountOut1 = 500000000000000000n; // 25% of amount out
    const fillAmountOut2 = 800000000000000000n; // 40% of amount out
    const fillAmountOut3 = 700000000000000000n; // 35% of amount out

    const callbackData = web3.utils.bytesToHex(
        web3.utils.hexToBytes(padAddress(testTokenA.address)).concat(
        web3.utils.hexToBytes(padAddress(feeToken.address)))
        );

    const deposit1Tx = await testCallee.deposit(
      {from: accounts[1], value: fillAmountOut1.toString()}
      )
    const deposit1GasUsed = BigInt(deposit1Tx.receipt.gasUsed);
    console.log('deposit1 gas: '+deposit1GasUsed.toString());

    const fill1Tx = await crossroad.fillOrderOutBnb(
      1n, // _orderId
      fillAmountOut1, // _amountOut
      testCallee.address, // _to
      true, // _callback
      callbackData, // _callbackData
      {from: accounts[1], value: fillAmountOut1.toString()}
      );
    const fill1GasUsed = BigInt(fill1Tx.receipt.gasUsed);
    console.log('fill1 gas: '+fill1GasUsed.toString());

    const deposit2Tx = await testCallee.deposit(
      {from: accounts[2], value: fillAmountOut2.toString()}
      )
    const deposit2GasUsed = BigInt(deposit2Tx.receipt.gasUsed);
    console.log('deposit2 gas: '+deposit2GasUsed.toString());

    const fill2Tx = await crossroad.fillOrderOutBnb(
      1n, // _orderId
      fillAmountOut2, // _amountOut
      testCallee.address, // _to
      true, // _callback
      callbackData, // _callbackData
      {from: accounts[2], value: fillAmountOut2.toString()}
      );
    const fill2GasUsed = BigInt(fill2Tx.receipt.gasUsed);
    console.log('fill2 gas: '+fill2GasUsed.toString());

    const deposit3Tx = await testCallee.deposit(
      {from: accounts[3], value: fillAmountOut3.toString()}
      )
    const deposit3GasUsed = BigInt(deposit3Tx.receipt.gasUsed);
    console.log('deposit3 gas: '+deposit3GasUsed.toString());

    const fill3Tx = await crossroad.fillOrderOutBnb(
      1n, // _orderId
      fillAmountOut3, // _amountOut
      testCallee.address, // _to
      true, // _callback
      callbackData, // _callbackData
      {from: accounts[3], value: fillAmountOut3.toString()}
      );
    const fill3GasUsed = BigInt(fill3Tx.receipt.gasUsed);
    console.log('fill3 gas: '+fill3GasUsed.toString());

    // checks
    const orderCount_ = await crossroad.orderCount();
    assertEqBigInt(orderCount_, 1n, "Mismatch: orderCount");

    const posterBnbAmount = BigInt(await web3.eth.getBalance(accounts[0]));
    const filler1BnbAmount = BigInt(await web3.eth.getBalance(accounts[1]));
    const filler2BnbAmount = BigInt(await web3.eth.getBalance(accounts[2]));
    const filler3BnbAmount = BigInt(await web3.eth.getBalance(accounts[3]));
    const crossroadBnbAmount = BigInt(await web3.eth.getBalance(crossroad.address));
    assertEqBigInt(posterBnbAmount,initPosterBnbAmount-feeAmount-inputAmountReward+inputAmountOut-(feeGasUsed+postGasUsed)*gasPrice, "Mismatch: posterBnbAmount");
    assertEqBigInt(filler1BnbAmount,initFiller1BnbAmount-fillAmountOut1-(deposit1GasUsed+fill1GasUsed)*gasPrice, "Mismatch: filler1BnbAmount");
    assertEqBigInt(filler2BnbAmount,initFiller2BnbAmount-fillAmountOut2-(deposit2GasUsed+fill2GasUsed)*gasPrice, "Mismatch: filler2BnbAmount");
    assertEqBigInt(filler3BnbAmount,initFiller3BnbAmount-fillAmountOut3-(deposit3GasUsed+fill3GasUsed)*gasPrice, "Mismatch: filler3BnbAmount");
    assertEqBigInt(crossroadBnbAmount,0n, "Mismatch: crossroadBnbAmount");

    const posterBalanceA_ = await testTokenA.balanceOf(accounts[0]);
    const filler1BalanceA_ = await testTokenA.balanceOf(accounts[1]);
    const filler2BalanceA_ = await testTokenA.balanceOf(accounts[2]);
    const filler3BalanceA_ = await testTokenA.balanceOf(accounts[3]);
    const crossroadBalanceA_ = await testTokenA.balanceOf(crossroad.address);
    assertEqBigInt(posterBalanceA_, SHARE_SUPPLY-inputAmountIn, "Mismatch: posterBalanceA");
    assertEqBigInt(filler1BalanceA_, SHARE_SUPPLY+inputAmountIn*25n/100n, "Mismatch: filler1BalanceA");
    assertEqBigInt(filler2BalanceA_, SHARE_SUPPLY+inputAmountIn*40n/100n, "Mismatch: filler2BalanceA");
    assertEqBigInt(filler3BalanceA_, SHARE_SUPPLY+inputAmountIn*35n/100n, "Mismatch: filler3BalanceA");
    assertEqBigInt(crossroadBalanceA_, 0n, "Mismatch: crossroadBalanceA");

    const posterBalanceFee_ = await feeToken.balanceOf(accounts[0]);
    const filler1BalanceFee_ = await feeToken.balanceOf(accounts[1]);
    const filler2BalanceFee_ = await feeToken.balanceOf(accounts[2]);
    const filler3BalanceFee_ = await feeToken.balanceOf(accounts[3]);
    const crossroadBalanceFee_ = await feeToken.balanceOf(crossroad.address);
    const projectBalanceFee_ = await feeToken.balanceOf(projectAddress);
    assertEqBigInt(posterBalanceFee_, 0n, "Mismatch: posterBalanceFee");
    assertEqBigInt(filler1BalanceFee_, inputAmountReward*25n/100n, "Mismatch: filler1BalanceFee");
    assertEqBigInt(filler2BalanceFee_, inputAmountReward*40n/100n, "Mismatch: filler2BalanceFee");
    assertEqBigInt(filler3BalanceFee_, inputAmountReward*35n/100n, "Mismatch: filler3BalanceFee");
    assertEqBigInt(crossroadBalanceFee_, 0n, "Mismatch: crossroadBalanceFee");
    assertEqBigInt(projectBalanceFee_, feeAmount, "Mismatch: projectBalanceFee");

    await checkOrder(
      crossroad,
      1n,
      accounts[0],
      testTokenA.address,
      '0x0000000000000000000000000000000000000000',
      feeToken.address,
      inputAmountIn,
      inputAmountOut,
      now+1200n,
      true
      );

    await checkOrderState(
      crossroad,
      1n,
      3n,
      inputAmountIn*0n/100n,
      inputAmountOut*0n/100n,
      inputAmountReward*0n/100n
      );

    const orderCanBeFilled_ = await crossroad.orderCanBeFilled(1n);
    const orderCanBeFilledCompleteCheckAllowanceAndBalance_ = await crossroad.orderCanBeFilledCompleteCheckAllowanceAndBalance(1n);
    const orderRemainingInCheckAllowanceAndBalance_ = await crossroad.orderRemainingInCheckAllowanceAndBalance(1n);
    const orderAmountInFromAmountOut_ = await crossroad.orderAmountInFromAmountOut(1n, 1000000000000000000n);
    const orderAmountRewardFromAmountOut_ = await crossroad.orderAmountRewardFromAmountOut(1n, 1000000000000000000n);

    assert.equal(orderCanBeFilled_, false, "Mismatch: orderCanBeFilled");
    assert.equal(orderCanBeFilledCompleteCheckAllowanceAndBalance_, false, "Mismatch: orderCanBeFilledCompleteCheckAllowanceAndBalance");
    assertEqBigInt(orderRemainingInCheckAllowanceAndBalance_, 0n, "Mismatch: orderRemainingInCheckAllowanceAndBalance");
    assertEqBigInt(orderAmountInFromAmountOut_, 0n, "Mismatch: orderAmountInFromAmountOut");
    assertEqBigInt(orderAmountRewardFromAmountOut_, 0n, "Mismatch: orderAmountRewardFromAmountOut");
  });
});
