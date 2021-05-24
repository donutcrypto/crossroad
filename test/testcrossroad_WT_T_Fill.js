const gasPrice = BigInt('20000000000');

const SafeERC20 = artifacts.require("SafeERC20");

const FeeToken = artifacts.require("FeeToken");
const FeeAutoBuyer = artifacts.require("FeeAutoBuyer");

const TestTokenA = artifacts.require("TestTokenA");
const TestTokenB = artifacts.require("TestTokenB");
const TestTokenC = artifacts.require("TestTokenC");
const TestTokenD = artifacts.require("TestTokenD");

const Crossroad = artifacts.require("Crossroad");

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

//
// Fill Partial 1
//

contract("TestCrossroad_PostWithdrawTokenPayFee_FillPartial1", accounts => {
  let feeToken;
  let feeAutoBuyer;

  let testTokenA;
  let testTokenB;
  let testTokenC;
  let testTokenD;

  let crossroad;
  let projectAddress;

  let feeAmount;

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
  });

  it("should post withdraw token", async () => {
    now = getCurrentTime();

    await feeToken.approve(crossroad.address,MAX_VALUE,{from: accounts[0]});
    await testTokenA.approve(crossroad.address,MAX_VALUE,{from: accounts[0]});
    await testTokenB.approve(crossroad.address,MAX_VALUE,{from: accounts[1]});

    // buy fee and reward
    const inputAmountIn = 1000000000000000000n;
    const inputAmountOut = 2000000000000000000n;
    const inputAmountReward = 50000000000000000n;

    await feeAutoBuyer.buyTokenFixed(feeAmount+inputAmountReward,accounts[0],accounts[0],
      {from: accounts[0], value: (feeAmount+inputAmountReward).toString()});

    // post order
    const postTx = await crossroad.postOrderPayFee(
      testTokenA.address, // _tokenIn,
      testTokenB.address, // _tokenOut,
      inputAmountIn, // _amountIn,
      inputAmountOut, // _amountOut,
      now+1200n, // _expiryTime,
      false, // _deposit,
      inputAmountReward, // _rewardAmount
      {from: accounts[0]}
      );
    const postGasUsed = BigInt(postTx.receipt.gasUsed);
    console.log('post gas: '+postGasUsed.toString());

    // fill order partial
    const fillAmountOut = 500000000000000000n; // 25% of amount out

    const fillTx = await crossroad.fillOrderOutToken(
      1n, // _orderId
      fillAmountOut, // _amountOut
      accounts[1], // _to
      false, // _callback
      '0x', // _callbackData
      {from: accounts[1]}
      );
    const fillGasUsed = BigInt(fillTx.receipt.gasUsed);
    console.log('fill gas: '+fillGasUsed.toString());

    // checks
    const orderCount_ = await crossroad.orderCount();
    assertEqBigInt(orderCount_, 1n, "Mismatch: orderCount");

    const posterBalanceA_ = await testTokenA.balanceOf(accounts[0]);
    const fillerBalanceA_ = await testTokenA.balanceOf(accounts[1]);
    const crossroadBalanceA_ = await testTokenA.balanceOf(crossroad.address);
    assertEqBigInt(posterBalanceA_, SHARE_SUPPLY-inputAmountIn*25n/100n, "Mismatch: posterBalanceA");
    assertEqBigInt(fillerBalanceA_, SHARE_SUPPLY+inputAmountIn*25n/100n, "Mismatch: fillerBalanceA");
    assertEqBigInt(crossroadBalanceA_, 0n, "Mismatch: crossroadBalanceA");

    const posterBalanceB_ = await testTokenB.balanceOf(accounts[0]);
    const fillerBalanceB_ = await testTokenB.balanceOf(accounts[1]);
    const crossroadBalanceB_ = await testTokenB.balanceOf(crossroad.address);
    assertEqBigInt(posterBalanceB_, SHARE_SUPPLY+fillAmountOut, "Mismatch: posterBalanceB");
    assertEqBigInt(fillerBalanceB_, SHARE_SUPPLY-fillAmountOut, "Mismatch: fillerBalanceB");
    assertEqBigInt(crossroadBalanceB_, 0n, "Mismatch: crossroadBalanceB");

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
      testTokenB.address,
      feeToken.address,
      inputAmountIn,
      inputAmountOut,
      now+1200n,
      false
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
// Fill Partial 2
//

contract("TestCrossroad_PostWithdrawTokenPayFee_FillPartial2", accounts => {
  let feeToken;
  let feeAutoBuyer;

  let testTokenA;
  let testTokenB;
  let testTokenC;
  let testTokenD;

  let crossroad;
  let projectAddress;

  let feeAmount;

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
  });

  it("should post withdraw token", async () => {
    now = getCurrentTime();

    await feeToken.approve(crossroad.address,MAX_VALUE,{from: accounts[0]});
    await testTokenA.approve(crossroad.address,MAX_VALUE,{from: accounts[0]});
    await testTokenB.approve(crossroad.address,MAX_VALUE,{from: accounts[1]});
    await testTokenB.approve(crossroad.address,MAX_VALUE,{from: accounts[2]});

    // buy fee and reward
    const inputAmountIn = 1000000000000000000n;
    const inputAmountOut = 2000000000000000000n;
    const inputAmountReward = 50000000000000000n;

    await feeAutoBuyer.buyTokenFixed(feeAmount+inputAmountReward,accounts[0],accounts[0],
      {from: accounts[0], value: (feeAmount+inputAmountReward).toString()});

    // post order
    const postTx = await crossroad.postOrderPayFee(
      testTokenA.address, // _tokenIn,
      testTokenB.address, // _tokenOut,
      inputAmountIn, // _amountIn,
      inputAmountOut, // _amountOut,
      now+1200n, // _expiryTime,
      false, // _deposit,
      inputAmountReward, // _rewardAmount
      {from: accounts[0]}
      );
    const postGasUsed = BigInt(postTx.receipt.gasUsed);
    console.log('post gas: '+postGasUsed.toString());

    // fill order partial
    const fillAmountOut1 = 500000000000000000n; // 25% of amount out
    const fillAmountOut2 = 800000000000000000n; // 40% of amount out

    const fill1Tx = await crossroad.fillOrderOutToken(
      1n, // _orderId
      fillAmountOut1, // _amountOut
      accounts[1], // _to
      false, // _callback
      '0x', // _callbackData
      {from: accounts[1]}
      );
    const fill1GasUsed = BigInt(fill1Tx.receipt.gasUsed);
    console.log('fill1 gas: '+fill1GasUsed.toString());

    const fill2Tx = await crossroad.fillOrderOutToken(
      1n, // _orderId
      fillAmountOut2, // _amountOut
      accounts[2], // _to
      false, // _callback
      '0x', // _callbackData
      {from: accounts[2]}
      );
    const fill2GasUsed = BigInt(fill2Tx.receipt.gasUsed);
    console.log('fill2 gas: '+fill2GasUsed.toString());

    // checks
    const orderCount_ = await crossroad.orderCount();
    assertEqBigInt(orderCount_, 1n, "Mismatch: orderCount");

    const posterBalanceA_ = await testTokenA.balanceOf(accounts[0]);
    const filler1BalanceA_ = await testTokenA.balanceOf(accounts[1]);
    const filler2BalanceA_ = await testTokenA.balanceOf(accounts[2]);
    const crossroadBalanceA_ = await testTokenA.balanceOf(crossroad.address);
    assertEqBigInt(posterBalanceA_, SHARE_SUPPLY-inputAmountIn*65n/100n, "Mismatch: posterBalanceA");
    assertEqBigInt(filler1BalanceA_, SHARE_SUPPLY+inputAmountIn*25n/100n, "Mismatch: filler1BalanceA");
    assertEqBigInt(filler2BalanceA_, SHARE_SUPPLY+inputAmountIn*40n/100n, "Mismatch: filler2BalanceA");
    assertEqBigInt(crossroadBalanceA_, 0n, "Mismatch: crossroadBalanceA");

    const posterBalanceB_ = await testTokenB.balanceOf(accounts[0]);
    const filler1BalanceB_ = await testTokenB.balanceOf(accounts[1]);
    const filler2BalanceB_ = await testTokenB.balanceOf(accounts[2]);
    const crossroadBalanceB_ = await testTokenB.balanceOf(crossroad.address);
    assertEqBigInt(posterBalanceB_, SHARE_SUPPLY+fillAmountOut1+fillAmountOut2, "Mismatch: posterBalanceB");
    assertEqBigInt(filler1BalanceB_, SHARE_SUPPLY-fillAmountOut1, "Mismatch: filler1BalanceB");
    assertEqBigInt(filler2BalanceB_, SHARE_SUPPLY-fillAmountOut2, "Mismatch: filler2BalanceB");
    assertEqBigInt(crossroadBalanceB_, 0n, "Mismatch: crossroadBalanceB");

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
      testTokenB.address,
      feeToken.address,
      inputAmountIn,
      inputAmountOut,
      now+1200n,
      false
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
// Fill All 1
//

contract("TestCrossroad_PostWithdrawTokenPayFee_FillAll1", accounts => {
  let feeToken;
  let feeAutoBuyer;

  let testTokenA;
  let testTokenB;
  let testTokenC;
  let testTokenD;

  let crossroad;
  let projectAddress;

  let feeAmount;

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
  });

  it("should post withdraw token", async () => {
    now = getCurrentTime();

    await feeToken.approve(crossroad.address,MAX_VALUE,{from: accounts[0]});
    await testTokenA.approve(crossroad.address,MAX_VALUE,{from: accounts[0]});
    await testTokenB.approve(crossroad.address,MAX_VALUE,{from: accounts[1]});

    // buy fee and reward
    const inputAmountIn = 1000000000000000000n;
    const inputAmountOut = 2000000000000000000n;
    const inputAmountReward = 50000000000000000n;

    await feeAutoBuyer.buyTokenFixed(feeAmount+inputAmountReward,accounts[0],accounts[0],
      {from: accounts[0], value: (feeAmount+inputAmountReward).toString()});

    // post order
    const postTx = await crossroad.postOrderPayFee(
      testTokenA.address, // _tokenIn,
      testTokenB.address, // _tokenOut,
      inputAmountIn, // _amountIn,
      inputAmountOut, // _amountOut,
      now+1200n, // _expiryTime,
      false, // _deposit,
      inputAmountReward, // _rewardAmount
      {from: accounts[0]}
      );
    const postGasUsed = BigInt(postTx.receipt.gasUsed);
    console.log('post gas: '+postGasUsed.toString());

    // fill order partial
    const fillAmountOut = 2000000000000000000n; // 100% of amount out

    const fillTx = await crossroad.fillOrderOutToken(
      1n, // _orderId
      fillAmountOut, // _amountOut
      accounts[1], // _to
      false, // _callback
      '0x', // _callbackData
      {from: accounts[1]}
      );
    const fillGasUsed = BigInt(fillTx.receipt.gasUsed);
    console.log('fill gas: '+fillGasUsed.toString());

    // checks
    const orderCount_ = await crossroad.orderCount();
    assertEqBigInt(orderCount_, 1n, "Mismatch: orderCount");

    const posterBalanceA_ = await testTokenA.balanceOf(accounts[0]);
    const fillerBalanceA_ = await testTokenA.balanceOf(accounts[1]);
    const crossroadBalanceA_ = await testTokenA.balanceOf(crossroad.address);
    assertEqBigInt(posterBalanceA_, SHARE_SUPPLY-inputAmountIn, "Mismatch: posterBalanceA");
    assertEqBigInt(fillerBalanceA_, SHARE_SUPPLY+inputAmountIn*100n/100n, "Mismatch: fillerBalanceA");
    assertEqBigInt(crossroadBalanceA_, 0n, "Mismatch: crossroadBalanceA");

    const posterBalanceB_ = await testTokenB.balanceOf(accounts[0]);
    const fillerBalanceB_ = await testTokenB.balanceOf(accounts[1]);
    const crossroadBalanceB_ = await testTokenB.balanceOf(crossroad.address);
    assertEqBigInt(posterBalanceB_, SHARE_SUPPLY+inputAmountOut, "Mismatch: posterBalanceB");
    assertEqBigInt(fillerBalanceB_, SHARE_SUPPLY-fillAmountOut, "Mismatch: fillerBalanceB");
    assertEqBigInt(crossroadBalanceB_, 0n, "Mismatch: crossroadBalanceB");

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
      testTokenB.address,
      feeToken.address,
      inputAmountIn,
      inputAmountOut,
      now+1200n,
      false
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
// Fill All 2
//

contract("TestCrossroad_PostWithdrawTokenPayFee_FillAll2", accounts => {
  let feeToken;
  let feeAutoBuyer;

  let testTokenA;
  let testTokenB;
  let testTokenC;
  let testTokenD;

  let crossroad;
  let projectAddress;

  let feeAmount;

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
  });

  it("should post withdraw token", async () => {
    now = getCurrentTime();

    await feeToken.approve(crossroad.address,MAX_VALUE,{from: accounts[0]});
    await testTokenA.approve(crossroad.address,MAX_VALUE,{from: accounts[0]});
    await testTokenB.approve(crossroad.address,MAX_VALUE,{from: accounts[1]});
    await testTokenB.approve(crossroad.address,MAX_VALUE,{from: accounts[2]});
    await testTokenB.approve(crossroad.address,MAX_VALUE,{from: accounts[3]});

    // buy fee and reward
    const inputAmountIn = 1000000000000000000n;
    const inputAmountOut = 2000000000000000000n;
    const inputAmountReward = 50000000000000000n;

    await feeAutoBuyer.buyTokenFixed(feeAmount+inputAmountReward,accounts[0],accounts[0],
      {from: accounts[0], value: (feeAmount+inputAmountReward).toString()});

    // post order
    const postTx = await crossroad.postOrderPayFee(
      testTokenA.address, // _tokenIn,
      testTokenB.address, // _tokenOut,
      inputAmountIn, // _amountIn,
      inputAmountOut, // _amountOut,
      now+1200n, // _expiryTime,
      false, // _deposit,
      inputAmountReward, // _rewardAmount
      {from: accounts[0]}
      );
    const postGasUsed = BigInt(postTx.receipt.gasUsed);
    console.log('post gas: '+postGasUsed.toString());

    // fill order partial
    const fillAmountOut1 = 500000000000000000n; // 25% of amount out
    const fillAmountOut2 = 800000000000000000n; // 40% of amount out
    const fillAmountOut3 = 700000000000000000n; // 35% of amount out

    const fill1Tx = await crossroad.fillOrderOutToken(
      1n, // _orderId
      fillAmountOut1, // _amountOut
      accounts[1], // _to
      false, // _callback
      '0x', // _callbackData
      {from: accounts[1]}
      );
    const fill1GasUsed = BigInt(fill1Tx.receipt.gasUsed);
    console.log('fill1 gas: '+fill1GasUsed.toString());

    const fill2Tx = await crossroad.fillOrderOutToken(
      1n, // _orderId
      fillAmountOut2, // _amountOut
      accounts[2], // _to
      false, // _callback
      '0x', // _callbackData
      {from: accounts[2]}
      );
    const fill2GasUsed = BigInt(fill2Tx.receipt.gasUsed);
    console.log('fill2 gas: '+fill2GasUsed.toString());

    const fill3Tx = await crossroad.fillOrderOutToken(
      1n, // _orderId
      fillAmountOut3, // _amountOut
      accounts[3], // _to
      false, // _callback
      '0x', // _callbackData
      {from: accounts[3]}
      );
    const fill3GasUsed = BigInt(fill3Tx.receipt.gasUsed);
    console.log('fill3 gas: '+fill3GasUsed.toString());

    // checks
    const orderCount_ = await crossroad.orderCount();
    assertEqBigInt(orderCount_, 1n, "Mismatch: orderCount");

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

    const posterBalanceB_ = await testTokenB.balanceOf(accounts[0]);
    const filler1BalanceB_ = await testTokenB.balanceOf(accounts[1]);
    const filler2BalanceB_ = await testTokenB.balanceOf(accounts[2]);
    const filler3BalanceB_ = await testTokenB.balanceOf(accounts[3]);
    const crossroadBalanceB_ = await testTokenB.balanceOf(crossroad.address);
    assertEqBigInt(posterBalanceB_, SHARE_SUPPLY+inputAmountOut, "Mismatch: posterBalanceB");
    assertEqBigInt(filler1BalanceB_, SHARE_SUPPLY-fillAmountOut1, "Mismatch: filler1BalanceB");
    assertEqBigInt(filler2BalanceB_, SHARE_SUPPLY-fillAmountOut2, "Mismatch: filler2BalanceB");
    assertEqBigInt(filler3BalanceB_, SHARE_SUPPLY-fillAmountOut3, "Mismatch: filler3BalanceB");
    assertEqBigInt(crossroadBalanceB_, 0n, "Mismatch: crossroadBalanceB");

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
      testTokenB.address,
      feeToken.address,
      inputAmountIn,
      inputAmountOut,
      now+1200n,
      false
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
