pragma solidity =0.6.12;

import "@alium-official/alium-swap-lib/contracts/math/SafeMath.sol";
import "@alium-official/alium-swap-lib/contracts/token/BEP20/IBEP20.sol";
import "@alium-official/alium-swap-lib/contracts/token/BEP20/SafeBEP20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IAliumCollectible.sol";

contract FarmingTicketWindow is Ownable {
    using SafeMath for uint256;
    using SafeBEP20 for IBEP20;

    uint256 public ticketPrice = 1500e18; // 1500 ALM

    address public alm;
    address public nft;
    address public founder;

    mapping (address => bool) public hasTicket;

    event TicketBought(address);
    event EntranceAllowed(address);

    constructor(address _almToken, address _nft, address _founderWallet) public {
        alm = _almToken;
        nft = _nft;
        founder = _founderWallet;
    }

    function buyTicket() external {
        require(!hasTicket[msg.sender], "Already has ticket");

        IBEP20(alm).safeTransferFrom(msg.sender, founder, ticketPrice);
        hasTicket[msg.sender] = true;
        IAliumCollectible(nft).mint(msg.sender);
        emit TicketBought(msg.sender);
    }

    function passFree(address _account) external onlyOwner {
        require(!hasTicket[msg.sender], "Already has ticket");
        hasTicket[_account] = true;
        emit EntranceAllowed(_account);
    }

    function passFreeBatch(address[] memory _accounts) external onlyOwner {
        uint l = _accounts.length;
        for (uint i; i < l; i++) {
            if (!hasTicket[_accounts[i]]) {
                hasTicket[_accounts[i]] = true;
                emit EntranceAllowed(_accounts[i]);
            }
        }
    }
}