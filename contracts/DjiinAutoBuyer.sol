// SPDX-License-Identifier: MIT

pragma solidity 0.8.3;

import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interfaces/IUniswapPool.sol";
import "./interfaces/IWETH.sol";

import "./utils/TransferHelper.sol";

contract DjinnAutoBuyer
{
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    /* ======== DATA STRUCTURES ======== */

    /* ======== CONSTANT VARIABLES ======== */

    // swap contracts
    address public constant lpDjinnBusd = 0x03962E1907B0FA72768Bd865e8cA0C45C7De4937;
    address public constant lpWbnbBusd = 0x1B96B92314C44b159149f7E0303511fB2Fc4774f;
    address public constant wbnbToken = 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;

    // factor for swap fees
    uint256 public constant SWAP_PERMILLE = 998;

    /* ======== STATE VARIABLES ======== */

    // governance
    address public operator;

    constructor()
    {
        operator = msg.sender;
    }

    /* ======== MODIFIER ======== */

    modifier onlyOperator()
    {
        require(operator == msg.sender, "Crossroad: Caller is not the operator");
        _;
    }

    /* ======== PUBLIC VIEW FUNCTIONS ======== */

    function costInBnb(
        uint256 _amountOut
        ) public view returns (uint256)
    {
        uint256 _amountInBusd = amountIn(lpDjinnBusd, false, _amountOut);
        uint256 _amountInWbnb = amountIn(lpWbnbBusd, true, _amountInBusd);
        return _amountInWbnb;
    }

    function amountIn(
        address _pool, bool _forward, uint256 _amountOut
        ) public view returns (uint256)
    {
        uint256 _initReserveIn;
        uint256 _initReserveOut;
        if (_forward)
        {
            (_initReserveIn,_initReserveOut,) = IUniswapPool(_pool).getReserves();
        }
        else
        {
            (_initReserveOut,_initReserveIn,) = IUniswapPool(_pool).getReserves();
        }

        uint256 _initBalanceIn = _initReserveIn.mul(1000);
        uint256 _initBalanceOut = _initReserveOut.mul(1000);

        uint256 _initProduct = _initBalanceIn.mul(_initBalanceOut);

        uint256 _finiBalanceOut = _initBalanceOut.sub(_amountOut.mul(1000));
        uint256 _finiBalanceIn = _initProduct.div(_finiBalanceOut);

        return _finiBalanceIn.sub(_initBalanceIn).div(SWAP_PERMILLE).add(1); // add 1 to account for rounding
    }

    /* ======== USER FUNCTIONS ======== */

    function buyDjinn(
        uint256 _amountOut,
        address _outTarget,
        address _refundTarget
        ) external payable returns (uint256)
    {
        uint256 _amountInBusd = amountIn(lpDjinnBusd, false, _amountOut);
        uint256 _amountInWbnb = amountIn(lpWbnbBusd, true, _amountInBusd);

        require(_amountInWbnb <= msg.value, "DjinnAutoBuyer: Insufficient BNB");

        uint256 _amountRefund = msg.value.sub(_amountInWbnb);

        // execute swap and transfer djinn to sender
        IWETH(wbnbToken).deposit{value: _amountInWbnb}();
        IWETH(wbnbToken).transfer(lpWbnbBusd, _amountInWbnb);
        IUniswapPool(lpWbnbBusd).swap(0, _amountInBusd, lpDjinnBusd, new bytes(0));
        IUniswapPool(lpDjinnBusd).swap(_amountOut, 0, _outTarget, new bytes(0));

        // refund excess BNB
        TransferHelper.safeTransferETH(_refundTarget,_amountRefund);

        return _amountRefund;
    }

    /* ======== PROXY FUNCTIONS ======== */

    function pancakeCall(address sender, uint amount0, uint amount1, bytes calldata data) external
    {
        /* do nothing */
    }

    /* ======== OPERATOR FUNCTIONS ======== */

    function recoverUnsupported(IERC20 _token, uint256 _amount, address _to) external onlyOperator
    {
        // do not allow to drain core tokens
        _token.safeTransfer(_to, _amount);
    }
}
