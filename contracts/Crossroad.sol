// SPDX-License-Identifier: MIT

pragma solidity 0.8.3;

import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interfaces/IDjinnAutoBuyer.sol";
import "./interfaces/IWETH.sol";

import "./utils/TransferHelper.sol";

contract Crossroad
{
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    /* ======== DATA STRUCTURES ======== */

    enum OrderStatus
    {
        INVALID,
        OPEN,
        CANCELLED,
        FILLED
    }

    enum ErrorCode
    {
        NONE,
        WITHDRAW_INSUFFICIENT_ALLOWANCE,
        WITHDRAW_INSUFFICIENT_BALANCE
    }

    // to denote BNB, a value of 0x0 will be used for tokenIn and tokenOut
    struct Order
    {
        address poster;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 amountOut;
        uint256 expiryTime;
        bool deposit;
    }

    struct OrderState
    {
        OrderStatus status;
        ErrorCode error;
        uint256 remainingIn;
        uint256 remainingOut;
        uint256 remainingReward;
    }

    /* ======== CONSTANT VARIABLES ======== */

    // unit
    uint256 constant UNIT_ONE = 1e18;

    // tokens
    address public constant wbnbToken = 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;
    address public constant feeToken = 0x24eacCa1086F2904962a32732590F27Ca45D1d99;

    /* ======== STATE VARIABLES ======== */

    // governance
    address public operator;

    // orders
    uint256 public orderCount;
    mapping(uint256 => Order) public orders;
    mapping(uint256 => OrderState) public orderStates;

    uint256 openOrderCount;
    mapping(uint256 => uint256) nextOpenOrderIds;
    mapping(uint256 => uint256) prevOpenOrderIds;

    mapping(address => uint256) posterOrderCounts;
    mapping(address => mapping(uint256 => uint256)) posterNextOrderIds;
    mapping(address => mapping(uint256 => uint256)) posterPrevOrderIds;
    mapping(address => uint256) posterOpenOrderCounts;
    mapping(address => mapping(uint256 => uint256)) posterNextOpenOrderIds;
    mapping(address => mapping(uint256 => uint256)) posterPrevOpenOrderIds;

    // fees
    uint256 public feeAmount = 500e14;
    address public projectAddress = address(0x74031C7504499FD54b42f8e3E90061E5c01C5668);
    address public feeAutobuyer = address(0x348c4eB1a1be165a1E32C3a6f9d187feEA283B3d);

    // the minimum reward required to activate the auto fill feature
    // this value is purely used communicate to the UI and other potential contracts
    // if this value increases, previously submitted transactions which were activated will persist
    uint256 public autoFillReward = 500e14;

    constructor()
    {
        operator = msg.sender;
    }

    /* ======== EVENTS ======== */

    /* ======== MODIFIER ======== */

    modifier onlyOperator()
    {
        require(operator == msg.sender, "Crossroad: Caller is not the operator");
        _;
    }

    /* ======== PUBLIC VIEW FUNCTIONS ======== */

    // orders
    function orderCanBeFilled(
        uint256 _orderId
        ) public view
        returns (bool)
    {
        Order storage order = orders[_orderId];
        OrderState storage state = orderStates[_orderId];
        return state.status == OrderStatus.OPEN && block.timestamp < order.expiryTime;
    }

    function orderCanBeFilledCompleteCheckAllowanceAndBalance(
        uint256 _orderId
        ) external view
        returns (bool)
    {
        Order storage order = orders[_orderId];
        OrderState storage state = orderStates[_orderId];
        if (!orderCanBeFilled(_orderId)) return false;
        if (order.deposit) return true;

        return
            state.remainingIn < IERC20(order.tokenIn).balanceOf(order.poster) &&
            state.remainingIn < IERC20(order.tokenIn).allowance(order.poster,address(this))
            ;
    }

    function orderRemainingIn(
        uint256 _orderId
        ) external view
        returns (uint256)
    {
        OrderState storage state = orderStates[_orderId];
        if (!orderCanBeFilled(_orderId)) return 0;
        return state.remainingIn;
    }

    function orderRemainingOut(
        uint256 _orderId
        ) external view
        returns (uint256)
    {
        OrderState storage state = orderStates[_orderId];
        if (!orderCanBeFilled(_orderId)) return 0;
        return state.remainingOut;
    }

    function orderRemainingReward(
        uint256 _orderId
        ) external view
        returns (uint256)
    {
        OrderState storage state = orderStates[_orderId];
        if (!orderCanBeFilled(_orderId)) return 0;
        return state.remainingReward;
    }

    function orderRemainingInCheckAllowanceAndBalance(
        uint256 _orderId
        ) external view
        returns (uint256)
    {
        Order storage order = orders[_orderId];
        OrderState storage state = orderStates[_orderId];
        if (!orderCanBeFilled(_orderId)) return 0;
        if (order.deposit) return state.remainingIn;

        return Math.min(
            state.remainingIn,
            Math.min(
                IERC20(order.tokenIn).balanceOf(order.poster),
                IERC20(order.tokenIn).allowance(order.poster,address(this))
                )
            );
    }

    function orderAmountInFromAmountOut(
        uint256 _orderId,
        uint256 _amountOut
        ) external view
        returns (uint256)
    {
        OrderState storage state = orderStates[_orderId];
        if (!orderCanBeFilled(_orderId)) return 0;

        return state.remainingIn.mul(_amountOut).div(state.remainingOut);
    }

    function orderAmountRewardFromAmountOut(
        uint256 _orderId,
        uint256 _amountOut
        ) external view
        returns (uint256)
    {
        OrderState storage state = orderStates[_orderId];
        if (!orderCanBeFilled(_orderId)) return 0;

        return state.remainingReward.mul(_amountOut).div(state.remainingOut);
    }

    // records
    function allOpenOrders(
        ) external view
        returns (uint256[] memory)
    {
        uint256[] memory _openOrderIds = new uint256[](openOrderCount);
        uint256 _index = 0;
        for (
            uint256 _currOpenOrderId = nextOpenOrderIds[0];
            _currOpenOrderId != 0;
            _currOpenOrderId = nextOpenOrderIds[_currOpenOrderId]
            )
        {
            _openOrderIds[_index] = _currOpenOrderId;
            _index.add(1);
        }
        return _openOrderIds;
    }

    function posterOrders(
        address _poster
        ) external view
        returns (uint256[] memory)
    {
        mapping(uint256 => uint256) storage _nextOrderIds = posterNextOrderIds[_poster];

        uint256[] memory _openIds;
        uint256 _index = 0;
        for (
            uint256 _currOrderId = _nextOrderIds[0];
            _currOrderId != 0;
            _currOrderId = _nextOrderIds[_currOrderId]
            )
        {
            _openIds[_index] = _currOrderId;
            _index.add(1);
        }
        return _openIds;
    }

    function posterOpenOrders(
        address _poster
        ) external view
        returns (uint256[] memory)
    {
        mapping(uint256 => uint256) storage _nextOpenOrderIds = posterNextOpenOrderIds[_poster];

        uint256[] memory _openOrderIds;
        uint256 _index = 0;
        for (
            uint256 _currOpenOrderId = _nextOpenOrderIds[0];
            _currOpenOrderId != 0;
            _currOpenOrderId = _nextOpenOrderIds[_currOpenOrderId]
            )
        {
            _openOrderIds[_index] = _currOpenOrderId;
            _index.add(1);
        }
        return _openOrderIds;
    }

    /* ======== USER FUNCTIONS ======== */

    function placeOrderPayFee(
        address _tokenIn,
        address _tokenOut,
        uint256 _amountIn,
        uint256 _amountOut,
        uint256 _expiryTime,
        bool _deposit,
        uint256 _rewardAmount
        ) external
    {
        require(_tokenIn != _tokenOut, "Crossroad: Cannot trade a token for itself");

        depositTokenIn(_tokenIn,_amountIn,_deposit);
        payFee(_rewardAmount);

        createOrder(
            _tokenIn,
            _tokenOut,
            _amountIn,
            _amountOut,
            _expiryTime,
            _deposit,
            _rewardAmount
            );
    }

    function placeOrderBuyFee(
        address _tokenIn,
        address _tokenOut,
        uint256 _amountIn,
        uint256 _amountOut,
        uint256 _expiryTime,
        bool _deposit,
        uint256 _rewardAmount
        ) external payable
    {
        require(_tokenIn != _tokenOut, "Crossroad: Cannot trade a token for itself");

        depositTokenIn(_tokenIn,_amountIn,_deposit);
        buyFee(msg.value,_rewardAmount);

        createOrder(
            _tokenIn,
            _tokenOut,
            _amountIn,
            _amountOut,
            _expiryTime,
            _deposit,
            _rewardAmount
            );
    }

    function placeOrderInBnbPayFee(
        address _tokenOut,
        uint256 _amountOut,
        uint256 _expiryTime,
        uint256 _rewardAmount
        ) external payable
    {
        require(address(0) != _tokenOut, "Crossroad: Cannot trade a token for itself");

        payFee(_rewardAmount);

        createOrder(
            address(0),
            _tokenOut,
            msg.value,
            _amountOut,
            _expiryTime,
            true, // bnb transactions must be deposited
            _rewardAmount
            );
    }

    function placeOrderInBnbBuyFee(
        address _tokenOut,
        uint256 _amountIn,
        uint256 _amountOut,
        uint256 _expiryTime,
        uint256 _rewardAmount
        ) external payable
    {
        require(address(0) != _tokenOut, "Crossroad: Cannot trade a token for itself");

        uint256 _feeBnbAmount = msg.value.sub(_amountIn);
        buyFee(_feeBnbAmount,_rewardAmount);

        createOrder(
            address(0),
            _tokenOut,
            _amountIn,
            _amountOut,
            _expiryTime,
            true, // bnb transactions must be deposited
            _rewardAmount
            );
    }

    function renewOrder(
        uint256 _orderId,
        uint256 _expiryTime
        ) external
    {
        Order storage order = orders[_orderId];
        OrderState storage state = orderStates[_orderId];

        require(order.poster == msg.sender, "Crossroad: Can't renew another poster's order");
        require(state.status == OrderStatus.OPEN, "Crossroad: Order is not open");

        order.expiryTime = _expiryTime;
    }

    function cancelOrder(
        uint256 _orderId
        ) external
    {
        Order storage order = orders[_orderId];
        OrderState storage state = orderStates[_orderId];

        require(order.poster == msg.sender, "Crossroad: Can't cancel another poster's order");
        require(state.status == OrderStatus.OPEN, "Crossroad: Order is not open");

        // mark as cancelled
        state.status = OrderStatus.CANCELLED;
        // remove from record keeping
        recordCloseOrder(msg.sender, _orderId);

        // update amounts
        uint256 _amountIn = state.remainingIn;
        uint256 _amountReward = state.remainingReward;

        state.remainingIn = 0;
        state.remainingOut = 0;
        state.remainingReward = 0;

        // refund any remaining deposit
        if (order.deposit)
        {
            if (order.tokenIn == address(0))
            {
                TransferHelper.safeTransferETH(order.poster,_amountIn);
            }
            else
            {
                IERC20(order.tokenIn).safeTransfer(order.poster,_amountIn);
            }
        }

        // refund any remaining reward
        IERC20(feeToken).safeTransfer(order.poster,_amountReward);
    }

    function fillOrderPartial(
        uint256 _orderId,
        uint256 _amountOut
        ) external
    {
        Order storage order = orders[_orderId];
        OrderState storage state = orderStates[_orderId];

        require(address(0) != order.tokenOut, "Crossroad: Wrong function call");
        require(state.status == OrderStatus.OPEN, "Crossroad: Order is not open");
        require(block.timestamp < order.expiryTime, "Crossroad: Order has expired");
        require(_amountOut <= state.remainingOut, "Crossroad: Filling more than remaining amount");

        if (_amountOut == state.remainingOut)
        {
            // mark as filled
            state.status = OrderStatus.FILLED;
            // remove from record keeping
            recordCloseOrder(msg.sender, _orderId);
        }

        // update amounts
        uint256 _amountIn = state.remainingIn.mul(_amountOut).div(state.remainingOut);
        uint256 _amountReward = state.remainingReward.mul(_amountOut).div(state.remainingOut);

        state.remainingIn = state.remainingIn.sub(_amountIn);
        state.remainingOut = state.remainingOut.sub(_amountOut);
        state.remainingReward = state.remainingReward.sub(_amountReward);

        // transfer token in to caller
        transferTokenInToCaller(_orderId,_amountIn);
        
        // transfer token out to poster
        IERC20(order.tokenOut).safeTransferFrom(msg.sender,order.poster,_amountOut);

        // transfer reward to caller
        IERC20(feeToken).safeTransfer(msg.sender,_amountReward);
    }

    function fillOrderComplete(
        uint256 _orderId
        ) external
    {
        Order storage order = orders[_orderId];
        OrderState storage state = orderStates[_orderId];

        require(address(0) != order.tokenOut, "Crossroad: Wrong function call");
        require(state.status == OrderStatus.OPEN, "Crossroad: Order is not open");
        require(block.timestamp < order.expiryTime, "Crossroad: Order has expired");

        // mark as filled
        state.status = OrderStatus.FILLED;
        // remove from record keeping
        recordCloseOrder(msg.sender, _orderId);

        // update amounts
        uint256 _amountIn = state.remainingIn;
        uint256 _amountOut = state.remainingOut;
        uint256 _amountReward = state.remainingReward;

        state.remainingIn = 0;
        state.remainingOut = 0;
        state.remainingReward = 0;

        // transfer token in to caller
        transferTokenInToCaller(_orderId,_amountIn);
        
        // transfer token out to poster
        IERC20(order.tokenOut).safeTransferFrom(msg.sender,order.poster,_amountOut);

        // transfer reward to caller
        IERC20(feeToken).safeTransfer(msg.sender,_amountReward);
    }

    function fillOrderOutBnb(
        uint256 _orderId
        ) external payable
    {
        Order storage order = orders[_orderId];
        OrderState storage state = orderStates[_orderId];

        require(address(0) == order.tokenOut, "Crossroad: Wrong function call");
        require(state.status == OrderStatus.OPEN, "Crossroad: Order is not open");
        require(block.timestamp < order.expiryTime, "Crossroad: Order has expired");
        require(msg.value <= state.remainingOut, "Crossroad: Filling more than remaining amount");

        if (msg.value == state.remainingOut)
        {
            // mark as filled
            state.status = OrderStatus.FILLED;
            // remove from record keeping
            recordCloseOrder(msg.sender, _orderId);
        }

        // update amounts
        uint256 _amountIn = state.remainingIn.mul(msg.value).div(state.remainingOut);
        uint256 _amountReward = state.remainingReward.mul(msg.value).div(state.remainingOut);

        state.remainingIn = state.remainingIn.sub(_amountIn);
        state.remainingOut = state.remainingOut.sub(msg.value);
        state.remainingReward = state.remainingReward.sub(_amountReward);

        // transfer token in to caller
        transferTokenInToCaller(_orderId,_amountIn);
        
        // transfer token out to poster
        TransferHelper.safeTransferETH(order.poster,msg.value);

        // transfer reward to caller
        IERC20(feeToken).safeTransfer(msg.sender,_amountReward);
    }

    /* ======== OPERATOR FUNCTIONS ======== */

    function setFeeAmount(
        uint256 _feeAmount
        ) external onlyOperator
    {
        feeAmount = _feeAmount;
    }

    function setProjectAddress(
        address _projectAddress
        ) external onlyOperator
    {
        projectAddress = _projectAddress;
    }

    function setFeeAutobuyer(
        address _feeAutobuyer
        ) external onlyOperator
    {
        feeAutobuyer = _feeAutobuyer;
    }

    /* ======== INTERNAL VIEW FUNCTIONS ======== */

    /* ======== INTERNAL FUNCTIONS ======== */

    function depositTokenIn(
        address _tokenIn,
        uint256 _amountIn,
        bool _deposit
        ) internal
    {
        if (_deposit)
        {
            // transfer tokens
            // check for transfer fees
            uint256 _prevBalance = IERC20(_tokenIn).balanceOf(address(this));
            IERC20(_tokenIn).safeTransferFrom(msg.sender,address(this),_amountIn);
            uint256 _currBalance = IERC20(_tokenIn).balanceOf(address(this));
            require(_prevBalance.add(_amountIn) == _currBalance, "Crossroad: Transfer fee detected");
        }
    }

    function payFee(
        uint256 _rewardAmount
        ) internal
    {
        IERC20(feeToken).safeTransferFrom(msg.sender,projectAddress,feeAmount);
        IERC20(feeToken).safeTransferFrom(msg.sender,address(this),_rewardAmount);
    }

    function buyFee(
        uint256 _bnbAmount,
        uint256 _rewardAmount
        ) internal
    {
        // buy fee and reward
        // transfer fee to project
        uint256 _feeAndRewardAmount = feeAmount.add(_rewardAmount);
        IDjinnAutoBuyer(feeAutobuyer).buyDjinn{value: _bnbAmount}(_feeAndRewardAmount,address(this),msg.sender);
        IERC20(feeToken).safeTransfer(projectAddress,feeAmount);
    }

    function createOrder(
        address _tokenIn,
        address _tokenOut,
        uint256 _amountIn,
        uint256 _amountOut,
        uint256 _expiryTime,
        bool _deposit,
        uint256 _rewardAmount
        ) internal
    {
        // add order
        orderCount = orderCount.add(1);
        uint256 _orderId = orderCount;

        orders[_orderId] = Order(
        {
            poster: msg.sender,
            tokenIn: _tokenIn,
            tokenOut: _tokenOut,
            amountIn: _amountIn,
            amountOut: _amountOut,
            expiryTime: _expiryTime,
            deposit: _deposit
        });

        orderStates[_orderId] = OrderState(
        {
            status: OrderStatus.OPEN,
            error: ErrorCode.NONE,
            remainingIn: _amountIn,
            remainingOut: _amountOut,
            remainingReward: _rewardAmount
        });

        // add to record keeping
        recordOpenOrder(msg.sender, _orderId);
    }

    function transferTokenInToCaller(
        uint256 _orderId,
        uint256 _amountIn
        ) internal
    {
        Order storage _order = orders[_orderId];

        if (_order.deposit)
        {
            if (_order.tokenIn == address(0))
            {
                TransferHelper.safeTransferETH(msg.sender,_amountIn);
            }
            else
            {
                IERC20(_order.tokenIn).safeTransfer(msg.sender,_amountIn);
            }
        }
        else
        {
            IERC20(_order.tokenIn).safeTransferFrom(_order.poster,msg.sender,_amountIn);
        }
    }

    // record keeping
    function recordOpenOrder(
        address _poster,
        uint256 _orderId
        ) internal
    {
        // update global orders
        {
            openOrderCount = openOrderCount.add(1);

            uint256 _prevNewestOpenOrderId = prevOpenOrderIds[0];

            nextOpenOrderIds[_prevNewestOpenOrderId] = _orderId;
            prevOpenOrderIds[_orderId] = _prevNewestOpenOrderId;
        }

        // update poster orders
        {
            posterOrderCounts[_poster] = posterOrderCounts[_poster].add(1);
            posterOpenOrderCounts[_poster] = posterOpenOrderCounts[_poster].add(1);

            {
                uint256 _prevPosterNewestOrderId = posterPrevOrderIds[_poster][0];

                posterNextOrderIds[_poster][_prevPosterNewestOrderId] = _orderId;
                posterPrevOrderIds[_poster][_orderId] = _prevPosterNewestOrderId;
            }

            {
                uint256 _prevPosterNewestOpenOrderId = posterPrevOpenOrderIds[_poster][0];

                posterNextOpenOrderIds[_poster][_prevPosterNewestOpenOrderId] = _orderId;
                posterPrevOpenOrderIds[_poster][_orderId] = _prevPosterNewestOpenOrderId;
            }
        }
    }

    function recordCloseOrder(
        address _poster,
        uint256 _orderId
        ) internal
    {
        // update global orders
        {
            openOrderCount = openOrderCount.sub(1);

            uint256 _nextOpenOrderId = nextOpenOrderIds[_orderId];
            uint256 _prevOpenOrderId = prevOpenOrderIds[_orderId];

            nextOpenOrderIds[_prevOpenOrderId] = _nextOpenOrderId;
            prevOpenOrderIds[_nextOpenOrderId] = _prevOpenOrderId;
        }

        // update poster orders
        {
            posterOpenOrderCounts[_poster] = posterOpenOrderCounts[_poster].add(1);

            mapping(uint256 => uint256) storage _nextOpenOrderIds = posterNextOpenOrderIds[_poster];
            mapping(uint256 => uint256) storage _prevOpenOrderIds = posterPrevOpenOrderIds[_poster];

            uint256 _nextOpenOrderId = _nextOpenOrderIds[_orderId];
            uint256 _prevOpenOrderId = _prevOpenOrderIds[_orderId];

            _nextOpenOrderIds[_prevOpenOrderId] = _nextOpenOrderId;
            _prevOpenOrderIds[_nextOpenOrderId] = _prevOpenOrderId;
        }
    }
}
