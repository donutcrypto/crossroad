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
// Post Pay Fee
//

contract("TestCrossroad_PostWithdrawTokenPayFee", accounts => {
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

    // checks
    const orderCount_ = await crossroad.orderCount();
    assertEqBigInt(orderCount_, 1n, "Mismatch: orderCount");

    const posterBalanceA_ = await testTokenA.balanceOf(accounts[0]);
    const crossroadBalanceA_ = await testTokenA.balanceOf(crossroad.address);
    assertEqBigInt(posterBalanceA_, SHARE_SUPPLY, "Mismatch: posterBalanceA");
    assertEqBigInt(crossroadBalanceA_, 0n, "Mismatch: crossroadBalanceA");

    const posterBalanceFee_ = await feeToken.balanceOf(accounts[0]);
    const crossroadBalanceFee_ = await feeToken.balanceOf(crossroad.address);
    const projectBalanceFee_ = await feeToken.balanceOf(projectAddress);
    assertEqBigInt(posterBalanceFee_, 0n, "Mismatch: posterBalanceFee");
    assertEqBigInt(crossroadBalanceFee_, inputAmountReward, "Mismatch: crossroadBalanceFee");
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
      inputAmountIn,
      inputAmountOut,
      inputAmountReward
      );

    const orderCanBeFilled_ = await crossroad.orderCanBeFilled(1n);
    const orderCanBeFilledCompleteCheckAllowanceAndBalance_ = await crossroad.orderCanBeFilledCompleteCheckAllowanceAndBalance(1n);
    const orderRemainingInCheckAllowanceAndBalance_ = await crossroad.orderRemainingInCheckAllowanceAndBalance(1n);
    const orderAmountInFromAmountOut_ = await crossroad.orderAmountInFromAmountOut(1n, 1000000000000000000n);
    const orderAmountRewardFromAmountOut_ = await crossroad.orderAmountRewardFromAmountOut(1n, 1000000000000000000n);

    assert.equal(orderCanBeFilled_, true, "Mismatch: orderCanBeFilled");
    assert.equal(orderCanBeFilledCompleteCheckAllowanceAndBalance_, true, "Mismatch: orderCanBeFilledCompleteCheckAllowanceAndBalance");
    assertEqBigInt(orderRemainingInCheckAllowanceAndBalance_, inputAmountIn, "Mismatch: orderRemainingInCheckAllowanceAndBalance");
    assertEqBigInt(orderAmountInFromAmountOut_, 500000000000000000n, "Mismatch: orderAmountInFromAmountOut");
    assertEqBigInt(orderAmountRewardFromAmountOut_, 25000000000000000n, "Mismatch: orderAmountRewardFromAmountOut");
  });
});

//
// Post Buy Fee
//

contract("TestCrossroad_PostWithdrawTokenBuyFee", accounts => {
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

    // buy fee and reward
    const inputAmountIn = 1000000000000000000n;
    const inputAmountOut = 2000000000000000000n;
    const inputAmountReward = 50000000000000000n;

    // post order
    const postTx = await crossroad.postOrderBuyFee(
      testTokenA.address, // _tokenIn,
      testTokenB.address, // _tokenOut,
      inputAmountIn, // _amountIn,
      inputAmountOut, // _amountOut,
      now+1200n, // _expiryTime,
      false, // _deposit,
      inputAmountReward, // _rewardAmount
      {from: accounts[0], value: (feeAmount+inputAmountReward).toString()}
      );
    const postGasUsed = BigInt(postTx.receipt.gasUsed);
    console.log('post gas: '+postGasUsed.toString());

    // checks
    const orderCount_ = await crossroad.orderCount();
    assertEqBigInt(orderCount_, 1n, "Mismatch: orderCount");

    const posterBalanceA_ = await testTokenA.balanceOf(accounts[0]);
    const crossroadBalanceA_ = await testTokenA.balanceOf(crossroad.address);
    assertEqBigInt(posterBalanceA_, SHARE_SUPPLY, "Mismatch: posterBalanceA");
    assertEqBigInt(crossroadBalanceA_, 0n, "Mismatch: crossroadBalanceA");

    const posterBalanceFee_ = await feeToken.balanceOf(accounts[0]);
    const crossroadBalanceFee_ = await feeToken.balanceOf(crossroad.address);
    const projectBalanceFee_ = await feeToken.balanceOf(projectAddress);
    assertEqBigInt(posterBalanceFee_, 0n, "Mismatch: posterBalanceFee");
    assertEqBigInt(crossroadBalanceFee_, inputAmountReward, "Mismatch: crossroadBalanceFee");
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
      inputAmountIn,
      inputAmountOut,
      inputAmountReward
      );

    const orderCanBeFilled_ = await crossroad.orderCanBeFilled(1n);
    const orderCanBeFilledCompleteCheckAllowanceAndBalance_ = await crossroad.orderCanBeFilledCompleteCheckAllowanceAndBalance(1n);
    const orderRemainingInCheckAllowanceAndBalance_ = await crossroad.orderRemainingInCheckAllowanceAndBalance(1n);
    const orderAmountInFromAmountOut_ = await crossroad.orderAmountInFromAmountOut(1n, 1000000000000000000n);
    const orderAmountRewardFromAmountOut_ = await crossroad.orderAmountRewardFromAmountOut(1n, 1000000000000000000n);

    assert.equal(orderCanBeFilled_, true, "Mismatch: orderCanBeFilled");
    assert.equal(orderCanBeFilledCompleteCheckAllowanceAndBalance_, true, "Mismatch: orderCanBeFilledCompleteCheckAllowanceAndBalance");
    assertEqBigInt(orderRemainingInCheckAllowanceAndBalance_, inputAmountIn, "Mismatch: orderRemainingInCheckAllowanceAndBalance");
    assertEqBigInt(orderAmountInFromAmountOut_, 500000000000000000n, "Mismatch: orderAmountInFromAmountOut");
    assertEqBigInt(orderAmountRewardFromAmountOut_, 25000000000000000n, "Mismatch: orderAmountRewardFromAmountOut");
  });
});

//
// Post Pay Fee, Renew
//

contract("TestCrossroad_PostWithdrawTokenPayFee_Renew", accounts => {
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

    // renew order
    const renewTx = await crossroad.renewOrder(
      1n, // _orderId
      now+3600n,
      {from: accounts[0]}
      );
    const renewGasUsed = BigInt(renewTx.receipt.gasUsed);
    console.log('renew gas: '+renewGasUsed.toString());

    // checks
    const orderCount_ = await crossroad.orderCount();
    assertEqBigInt(orderCount_, 1n, "Mismatch: orderCount");

    const posterBalanceA_ = await testTokenA.balanceOf(accounts[0]);
    const crossroadBalanceA_ = await testTokenA.balanceOf(crossroad.address);
    assertEqBigInt(posterBalanceA_, SHARE_SUPPLY, "Mismatch: posterBalanceA");
    assertEqBigInt(crossroadBalanceA_, 0n, "Mismatch: crossroadBalanceA");

    const posterBalanceFee_ = await feeToken.balanceOf(accounts[0]);
    const crossroadBalanceFee_ = await feeToken.balanceOf(crossroad.address);
    const projectBalanceFee_ = await feeToken.balanceOf(projectAddress);
    assertEqBigInt(posterBalanceFee_, 0n, "Mismatch: posterBalanceFee");
    assertEqBigInt(crossroadBalanceFee_, inputAmountReward, "Mismatch: crossroadBalanceFee");
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
      now+3600n,
      false
      );

    await checkOrderState(
      crossroad,
      1n,
      1n,
      inputAmountIn,
      inputAmountOut,
      inputAmountReward
      );

    const orderCanBeFilled_ = await crossroad.orderCanBeFilled(1n);
    const orderCanBeFilledCompleteCheckAllowanceAndBalance_ = await crossroad.orderCanBeFilledCompleteCheckAllowanceAndBalance(1n);
    const orderRemainingInCheckAllowanceAndBalance_ = await crossroad.orderRemainingInCheckAllowanceAndBalance(1n);
    const orderAmountInFromAmountOut_ = await crossroad.orderAmountInFromAmountOut(1n, 1000000000000000000n);
    const orderAmountRewardFromAmountOut_ = await crossroad.orderAmountRewardFromAmountOut(1n, 1000000000000000000n);

    assert.equal(orderCanBeFilled_, true, "Mismatch: orderCanBeFilled");
    assert.equal(orderCanBeFilledCompleteCheckAllowanceAndBalance_, true, "Mismatch: orderCanBeFilledCompleteCheckAllowanceAndBalance");
    assertEqBigInt(orderRemainingInCheckAllowanceAndBalance_, inputAmountIn, "Mismatch: orderRemainingInCheckAllowanceAndBalance");
    assertEqBigInt(orderAmountInFromAmountOut_, 500000000000000000n, "Mismatch: orderAmountInFromAmountOut");
    assertEqBigInt(orderAmountRewardFromAmountOut_, 25000000000000000n, "Mismatch: orderAmountRewardFromAmountOut");
  });
});

//
// Post Pay Fee, Cancel
//

contract("TestCrossroad_PostWithdrawTokenPayFee_Cancel", accounts => {
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

    // cancel order
    const cancelTx = await crossroad.cancelOrder(
      1n, // _orderId
      {from: accounts[0]}
      );
    const cancelGasUsed = BigInt(cancelTx.receipt.gasUsed);
    console.log('cancel gas: '+cancelGasUsed.toString());

    // checks
    const orderCount_ = await crossroad.orderCount();
    assertEqBigInt(orderCount_, 1n, "Mismatch: orderCount");

    const posterBalanceA_ = await testTokenA.balanceOf(accounts[0]);
    const crossroadBalanceA_ = await testTokenA.balanceOf(crossroad.address);
    assertEqBigInt(posterBalanceA_, SHARE_SUPPLY, "Mismatch: posterBalanceA");
    assertEqBigInt(crossroadBalanceA_, 0n, "Mismatch: crossroadBalanceA");

    const posterBalanceFee_ = await feeToken.balanceOf(accounts[0]);
    const crossroadBalanceFee_ = await feeToken.balanceOf(crossroad.address);
    const projectBalanceFee_ = await feeToken.balanceOf(projectAddress);
    assertEqBigInt(posterBalanceFee_, inputAmountReward, "Mismatch: posterBalanceFee");
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
      2n,
      0n,
      0n,
      0n
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
