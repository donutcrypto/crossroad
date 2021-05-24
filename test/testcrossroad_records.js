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

const assertEqBigIntList = (
  left,
  right,
  message
  ) =>
{
  const toBigIntStr = v => BigInt(v).toString();
  assert.equal(left.map(toBigIntStr).toString(),right.map(toBigIntStr).toString(),message);
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
// Records single poster
//

contract("TestCrossroad_Records_SinglePoster", accounts => {
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

  it("should have proper records", async () => {
    now = getCurrentTime();

    await feeToken.approve(crossroad.address,MAX_VALUE,{from: accounts[0]});
    await testTokenA.approve(crossroad.address,MAX_VALUE,{from: accounts[0]});
    await testTokenB.approve(crossroad.address,MAX_VALUE,{from: accounts[1]});

    // buy fee and reward
    const inputAmountReward = 50000000000000000n;

    await feeAutoBuyer.buyTokenFixed((feeAmount+inputAmountReward)*5n,accounts[0],accounts[0],
      {from: accounts[0], value: ((feeAmount+inputAmountReward)*5n).toString()});

    // post orders
    await crossroad.postOrderPayFee(
      testTokenA.address, // _tokenIn,
      testTokenB.address, // _tokenOut,
      1000000000000000000n, // _amountIn,
      1500000000000000000n, // _amountOut,
      now+1200n, // _expiryTime,
      true, // _deposit,
      inputAmountReward, // _rewardAmount
      {from: accounts[0]}
      );
    await crossroad.postOrderPayFee(
      testTokenA.address, // _tokenIn,
      testTokenB.address, // _tokenOut,
      2000000000000000000n, // _amountIn,
      2500000000000000000n, // _amountOut,
      now+1200n, // _expiryTime,
      true, // _deposit,
      inputAmountReward, // _rewardAmount
      {from: accounts[0]}
      );
    await crossroad.postOrderPayFee(
      testTokenA.address, // _tokenIn,
      testTokenB.address, // _tokenOut,
      3000000000000000000n, // _amountIn,
      3500000000000000000n, // _amountOut,
      now+1200n, // _expiryTime,
      true, // _deposit,
      inputAmountReward, // _rewardAmount
      {from: accounts[0]}
      );
    await crossroad.postOrderPayFee(
      testTokenA.address, // _tokenIn,
      testTokenB.address, // _tokenOut,
      4000000000000000000n, // _amountIn,
      4500000000000000000n, // _amountOut,
      now+1200n, // _expiryTime,
      true, // _deposit,
      inputAmountReward, // _rewardAmount
      {from: accounts[0]}
      );
    await crossroad.postOrderPayFee(
      testTokenA.address, // _tokenIn,
      testTokenB.address, // _tokenOut,
      5000000000000000000n, // _amountIn,
      5500000000000000000n, // _amountOut,
      now+1200n, // _expiryTime,
      true, // _deposit,
      inputAmountReward, // _rewardAmount
      {from: accounts[0]}
      );

    // check order 1
    await checkOrder(
      crossroad,
      1n,
      accounts[0],
      testTokenA.address,
      testTokenB.address,
      feeToken.address,
      1000000000000000000n,
      1500000000000000000n,
      now+1200n,
      true
      );
    await checkOrderState(
      crossroad,
      1n,
      1n,
      1000000000000000000n,
      1500000000000000000n,
      inputAmountReward
      );

    // check order 2
    await checkOrder(
      crossroad,
      2n,
      accounts[0],
      testTokenA.address,
      testTokenB.address,
      feeToken.address,
      2000000000000000000n,
      2500000000000000000n,
      now+1200n,
      true
      );
    await checkOrderState(
      crossroad,
      2n,
      1n,
      2000000000000000000n,
      2500000000000000000n,
      inputAmountReward
      );

    // check order 3
    await checkOrder(
      crossroad,
      3n,
      accounts[0],
      testTokenA.address,
      testTokenB.address,
      feeToken.address,
      3000000000000000000n,
      3500000000000000000n,
      now+1200n,
      true
      );
    await checkOrderState(
      crossroad,
      3n,
      1n,
      3000000000000000000n,
      3500000000000000000n,
      inputAmountReward
      );

    // check order 4
    await checkOrder(
      crossroad,
      4n,
      accounts[0],
      testTokenA.address,
      testTokenB.address,
      feeToken.address,
      4000000000000000000n,
      4500000000000000000n,
      now+1200n,
      true
      );
    await checkOrderState(
      crossroad,
      4n,
      1n,
      4000000000000000000n,
      4500000000000000000n,
      inputAmountReward
      );

    // check order 5
    await checkOrder(
      crossroad,
      5n,
      accounts[0],
      testTokenA.address,
      testTokenB.address,
      feeToken.address,
      5000000000000000000n,
      5500000000000000000n,
      now+1200n,
      true
      );
    await checkOrderState(
      crossroad,
      5n,
      1n,
      5000000000000000000n,
      5500000000000000000n,
      inputAmountReward
      );

    // check
    assertEqBigInt(await crossroad.orderCount(), 5n, "Mismatch: orderCount");

    assertEqBigInt(
      await crossroad.openOrderCount(),
      5n,
      "Mismatch: openOrderCount"
      );
    assertEqBigIntList(
      await crossroad.allOpenOrders(),
      [1n,2n,3n,4n,5n],
      "Mismatch: allOpenOrders"
      );

    assertEqBigInt(
      await crossroad.posterOrderCounts(accounts[0]),
      5n,
      "Mismatch: posterOrderCounts"
      );
    assertEqBigIntList(
      await crossroad.posterOrders(accounts[0]),
      [1n,2n,3n,4n,5n],
      "Mismatch: posterOrders"
      );

    assertEqBigInt(
      await crossroad.posterOpenOrderCounts(accounts[0]),
      5n,
      "Mismatch: posterOpenOrderCounts"
      );
    assertEqBigIntList(
      await crossroad.posterOpenOrders(accounts[0]),
      [1n,2n,3n,4n,5n],
      "Mismatch: posterOpenOrders"
      );

    // cancel some
    await crossroad.cancelOrder(
      1n, // _orderId
      {from: accounts[0]}
      );
    await crossroad.cancelOrder(
      4n, // _orderId
      {from: accounts[0]}
      );

    // fill others
    await crossroad.fillOrderOutToken(
      3n, // _orderId
      3500000000000000000n, // _amountOut
      accounts[1], // _to
      false, // _callback
      '0x', // _callbackData
      {from: accounts[1]}
      );

    // check
    assertEqBigInt(await crossroad.orderCount(), 5n, "Mismatch: orderCount");

    assertEqBigInt(
      await crossroad.openOrderCount(),
      2n,
      "Mismatch: openOrderCount"
      );
    assertEqBigIntList(
      await crossroad.allOpenOrders(),
      [2n,5n],
      "Mismatch: allOpenOrders"
      );

    assertEqBigInt(
      await crossroad.posterOrderCounts(accounts[0]),
      5n,
      "Mismatch: posterOrderCounts"
      );
    assertEqBigIntList(
      await crossroad.posterOrders(accounts[0]),
      [1n,2n,3n,4n,5n],
      "Mismatch: posterOrders"
      );

    assertEqBigInt(
      await crossroad.posterOpenOrderCounts(accounts[0]),
      2n,
      "Mismatch: posterOpenOrderCounts"
      );
    assertEqBigIntList(
      await crossroad.posterOpenOrders(accounts[0]),
      [2n,5n],
      "Mismatch: posterOpenOrders"
      );

    // post more orders
    await feeAutoBuyer.buyTokenFixed((feeAmount)*2n,accounts[0],accounts[0],
      {from: accounts[0], value: ((feeAmount)*2n).toString()});

    await crossroad.postOrderPayFee(
      testTokenA.address, // _tokenIn,
      testTokenB.address, // _tokenOut,
      1100000000000000000n, // _amountIn,
      1200000000000000000n, // _amountOut,
      now+1200n, // _expiryTime,
      true, // _deposit,
      inputAmountReward, // _rewardAmount
      {from: accounts[0]}
      );
    await crossroad.postOrderPayFee(
      testTokenA.address, // _tokenIn,
      testTokenB.address, // _tokenOut,
      1300000000000000000n, // _amountIn,
      1400000000000000000n, // _amountOut,
      now+1200n, // _expiryTime,
      true, // _deposit,
      inputAmountReward, // _rewardAmount
      {from: accounts[0]}
      );

    // check
    assertEqBigInt(await crossroad.orderCount(), 7n, "Mismatch: orderCount");

    assertEqBigInt(
      await crossroad.openOrderCount(),
      4n,
      "Mismatch: openOrderCount"
      );
    assertEqBigIntList(
      await crossroad.allOpenOrders(),
      [2n,5n,6n,7n],
      "Mismatch: allOpenOrders"
      );

    assertEqBigInt(
      await crossroad.posterOrderCounts(accounts[0]),
      7n,
      "Mismatch: posterOrderCounts"
      );
    assertEqBigIntList(
      await crossroad.posterOrders(accounts[0]),
      [1n,2n,3n,4n,5n,6n,7n],
      "Mismatch: posterOrders"
      );

    assertEqBigInt(
      await crossroad.posterOpenOrderCounts(accounts[0]),
      4n,
      "Mismatch: posterOpenOrderCounts"
      );
    assertEqBigIntList(
      await crossroad.posterOpenOrders(accounts[0]),
      [2n,5n,6n,7n],
      "Mismatch: posterOpenOrders"
      );
  });
});

//
// Records multi poster
//

contract("TestCrossroad_Records_MultiPoster", accounts => {
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

  it("should have proper records", async () => {
    now = getCurrentTime();

    for (var i = 0; i <= 4; ++i) {
      await feeToken.approve(crossroad.address,MAX_VALUE,{from: accounts[i]});
      await testTokenA.approve(crossroad.address,MAX_VALUE,{from: accounts[i]});
      await testTokenB.approve(crossroad.address,MAX_VALUE,{from: accounts[i]});
      await testTokenC.approve(crossroad.address,MAX_VALUE,{from: accounts[i]});
      await testTokenD.approve(crossroad.address,MAX_VALUE,{from: accounts[i]});
    }

    // buy fee and reward
    const inputAmountReward = 50000000000000000n;

    for (var i = 0; i <= 4; ++i)
    {
      await feeAutoBuyer.buyTokenFixed((feeAmount+inputAmountReward)*BigInt(i+2),accounts[i],accounts[i],
        {from: accounts[i], value: ((feeAmount+inputAmountReward)*BigInt(i+2)).toString()});
    }

    // post orders
    const postOrder = async (i,tokenIn,tokenOut) => {
      await crossroad.postOrderPayFee(
        tokenIn.address, // _tokenIn,
        tokenOut.address, // _tokenOut,
        1000000000000000000n, // _amountIn,
        1000000000000000000n, // _amountOut,
        now+1200n, // _expiryTime,
        true, // _deposit,
        inputAmountReward, // _rewardAmount
        {from: accounts[i]}
        );
    };

    postOrder(3,testTokenA,testTokenD); // 01
    postOrder(1,testTokenB,testTokenA); // 02
    postOrder(4,testTokenB,testTokenC); // 03
    postOrder(0,testTokenA,testTokenD); // 04
    postOrder(2,testTokenC,testTokenD); // 05
    postOrder(4,testTokenA,testTokenC); // 06
    postOrder(4,testTokenA,testTokenC); // 07
    postOrder(2,testTokenD,testTokenB); // 08
    postOrder(3,testTokenD,testTokenC); // 09
    postOrder(3,testTokenD,testTokenB); // 10
    postOrder(0,testTokenD,testTokenC); // 11
    postOrder(1,testTokenC,testTokenD); // 12
    postOrder(3,testTokenA,testTokenB); // 13
    postOrder(2,testTokenB,testTokenC); // 14
    postOrder(4,testTokenC,testTokenB); // 15
    postOrder(4,testTokenB,testTokenD); // 16
    postOrder(1,testTokenC,testTokenA); // 17
    postOrder(4,testTokenB,testTokenA); // 18
    postOrder(3,testTokenA,testTokenB); // 19
    postOrder(2,testTokenD,testTokenA); // 20

    // check
    assertEqBigInt(await crossroad.orderCount(), 20n, "Mismatch: orderCount");

    assertEqBigInt(
      await crossroad.openOrderCount(),
      20n,
      "Mismatch: openOrderCount"
      );
    assertEqBigIntList(
      await crossroad.allOpenOrders(),
      [1n,2n,3n,4n,5n,6n,7n,8n,9n,10n,11n,12n,13n,14n,15n,16n,17n,18n,19n,20n],
      "Mismatch: allOpenOrders"
      );

    // check account 0
    assertEqBigInt(
      await crossroad.posterOrderCounts(accounts[0]),
      2n,
      "Mismatch: posterOrderCounts"
      );
    assertEqBigIntList(
      await crossroad.posterOrders(accounts[0]),
      [4n,11n],
      "Mismatch: posterOrders"
      );

    assertEqBigInt(
      await crossroad.posterOpenOrderCounts(accounts[0]),
      2n,
      "Mismatch: posterOpenOrderCounts"
      );
    assertEqBigIntList(
      await crossroad.posterOpenOrders(accounts[0]),
      [4n,11n],
      "Mismatch: posterOpenOrders"
      );

    // check account 1
    assertEqBigInt(
      await crossroad.posterOrderCounts(accounts[1]),
      3n,
      "Mismatch: posterOrderCounts"
      );
    assertEqBigIntList(
      await crossroad.posterOrders(accounts[1]),
      [2n,12n,17n],
      "Mismatch: posterOrders"
      );

    assertEqBigInt(
      await crossroad.posterOpenOrderCounts(accounts[1]),
      3n,
      "Mismatch: posterOpenOrderCounts"
      );
    assertEqBigIntList(
      await crossroad.posterOpenOrders(accounts[1]),
      [2n,12n,17n],
      "Mismatch: posterOpenOrders"
      );

    // check account 2
    assertEqBigInt(
      await crossroad.posterOrderCounts(accounts[2]),
      4n,
      "Mismatch: posterOrderCounts"
      );
    assertEqBigIntList(
      await crossroad.posterOrders(accounts[2]),
      [5n,8n,14n,20n],
      "Mismatch: posterOrders"
      );

    assertEqBigInt(
      await crossroad.posterOpenOrderCounts(accounts[2]),
      4n,
      "Mismatch: posterOpenOrderCounts"
      );
    assertEqBigIntList(
      await crossroad.posterOpenOrders(accounts[2]),
      [5n,8n,14n,20n],
      "Mismatch: posterOpenOrders"
      );

    // check account 3
    assertEqBigInt(
      await crossroad.posterOrderCounts(accounts[3]),
      5n,
      "Mismatch: posterOrderCounts"
      );
    assertEqBigIntList(
      await crossroad.posterOrders(accounts[3]),
      [1n,9n,10n,13n,19n],
      "Mismatch: posterOrders"
      );

    assertEqBigInt(
      await crossroad.posterOpenOrderCounts(accounts[3]),
      5n,
      "Mismatch: posterOpenOrderCounts"
      );
    assertEqBigIntList(
      await crossroad.posterOpenOrders(accounts[3]),
      [1n,9n,10n,13n,19n],
      "Mismatch: posterOpenOrders"
      );

    // check account 4
    assertEqBigInt(
      await crossroad.posterOrderCounts(accounts[4]),
      6n,
      "Mismatch: posterOrderCounts"
      );
    assertEqBigIntList(
      await crossroad.posterOrders(accounts[4]),
      [3n,6n,7n,15n,16n,18n],
      "Mismatch: posterOrders"
      );

    assertEqBigInt(
      await crossroad.posterOpenOrderCounts(accounts[4]),
      6n,
      "Mismatch: posterOpenOrderCounts"
      );
    assertEqBigIntList(
      await crossroad.posterOpenOrders(accounts[4]),
      [3n,6n,7n,15n,16n,18n],
      "Mismatch: posterOpenOrders"
      );

    // cancel some
    await crossroad.cancelOrder(
      2n, // _orderId
      {from: accounts[1]}
      );
    await crossroad.cancelOrder(
      3n, // _orderId
      {from: accounts[4]}
      );
    await crossroad.cancelOrder(
      5n, // _orderId
      {from: accounts[2]}
      );
    await crossroad.cancelOrder(
      7n, // _orderId
      {from: accounts[4]}
      );
    await crossroad.cancelOrder(
      11n, // _orderId
      {from: accounts[0]}
      );
    await crossroad.cancelOrder(
      13n, // _orderId
      {from: accounts[3]}
      );
    await crossroad.cancelOrder(
      17n, // _orderId
      {from: accounts[1]}
      );
    await crossroad.cancelOrder(
      19n, // _orderId
      {from: accounts[3]}
      );

    // check
    assertEqBigInt(await crossroad.orderCount(), 20n, "Mismatch: orderCount");

    assertEqBigInt(
      await crossroad.openOrderCount(),
      12n,
      "Mismatch: openOrderCount"
      );
    assertEqBigIntList(
      await crossroad.allOpenOrders(),
      [1n,4n,6n,8n,9n,10n,12n,14n,15n,16n,18n,20n],
      "Mismatch: allOpenOrders"
      );

    // check account 0
    assertEqBigInt(
      await crossroad.posterOrderCounts(accounts[0]),
      2n,
      "Mismatch: posterOrderCounts"
      );
    assertEqBigIntList(
      await crossroad.posterOrders(accounts[0]),
      [4n,11n],
      "Mismatch: posterOrders"
      );

    assertEqBigInt(
      await crossroad.posterOpenOrderCounts(accounts[0]),
      1n,
      "Mismatch: posterOpenOrderCounts"
      );
    assertEqBigIntList(
      await crossroad.posterOpenOrders(accounts[0]),
      [4n],
      "Mismatch: posterOpenOrders"
      );

    // check account 1
    assertEqBigInt(
      await crossroad.posterOrderCounts(accounts[1]),
      3n,
      "Mismatch: posterOrderCounts"
      );
    assertEqBigIntList(
      await crossroad.posterOrders(accounts[1]),
      [2n,12n,17n],
      "Mismatch: posterOrders"
      );

    assertEqBigInt(
      await crossroad.posterOpenOrderCounts(accounts[1]),
      1n,
      "Mismatch: posterOpenOrderCounts"
      );
    assertEqBigIntList(
      await crossroad.posterOpenOrders(accounts[1]),
      [12n],
      "Mismatch: posterOpenOrders"
      );

    // check account 2
    assertEqBigInt(
      await crossroad.posterOrderCounts(accounts[2]),
      4n,
      "Mismatch: posterOrderCounts"
      );
    assertEqBigIntList(
      await crossroad.posterOrders(accounts[2]),
      [5n,8n,14n,20n],
      "Mismatch: posterOrders"
      );

    assertEqBigInt(
      await crossroad.posterOpenOrderCounts(accounts[2]),
      3n,
      "Mismatch: posterOpenOrderCounts"
      );
    assertEqBigIntList(
      await crossroad.posterOpenOrders(accounts[2]),
      [8n,14n,20n],
      "Mismatch: posterOpenOrders"
      );

    // check account 3
    assertEqBigInt(
      await crossroad.posterOrderCounts(accounts[3]),
      5n,
      "Mismatch: posterOrderCounts"
      );
    assertEqBigIntList(
      await crossroad.posterOrders(accounts[3]),
      [1n,9n,10n,13n,19n],
      "Mismatch: posterOrders"
      );

    assertEqBigInt(
      await crossroad.posterOpenOrderCounts(accounts[3]),
      3n,
      "Mismatch: posterOpenOrderCounts"
      );
    assertEqBigIntList(
      await crossroad.posterOpenOrders(accounts[3]),
      [1n,9n,10n],
      "Mismatch: posterOpenOrders"
      );

    // check account 4
    assertEqBigInt(
      await crossroad.posterOrderCounts(accounts[4]),
      6n,
      "Mismatch: posterOrderCounts"
      );
    assertEqBigIntList(
      await crossroad.posterOrders(accounts[4]),
      [3n,6n,7n,15n,16n,18n],
      "Mismatch: posterOrders"
      );

    assertEqBigInt(
      await crossroad.posterOpenOrderCounts(accounts[4]),
      4n,
      "Mismatch: posterOpenOrderCounts"
      );
    assertEqBigIntList(
      await crossroad.posterOpenOrders(accounts[4]),
      [6n,15n,16n,18n],
      "Mismatch: posterOpenOrders"
      );

  });
});
