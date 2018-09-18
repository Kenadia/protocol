const chai = require('chai');
const expect = chai.expect;
chai.use(require('chai-bignumber')());

const ProductionDutchAuctionCloser = artifacts.require("ProductionDutchAuctionCloser");
const ERC721MarginPosition = artifacts.require("ERC721MarginPosition");
const OwedToken = artifacts.require("TokenB");
const Margin = artifacts.require("Margin");
const TokenProxy = artifacts.require("TokenProxy");

const {
  callClosePositionDirectly,
  getMaxInterestFee
} = require('../../../helpers/MarginHelper');
const { expectThrow } = require('../../../helpers/ExpectHelper');
const {
  doOpenPosition
} = require('../../../helpers/MarginHelper');
const { wait } = require('@digix/tempo')(web3);

contract('ProductionDutchAuctionCloser', accounts => {
  let dydxMargin, ERC721MarginPositionContract;
  let OwedTokenContract;
  let openTx;
  const dutchBidder = accounts[9];

  before('retrieve deployed contracts', async () => {
    [
      dydxMargin,
      ERC721MarginPositionContract,
      OwedTokenContract,
    ] = await Promise.all([
      Margin.deployed(),
      ERC721MarginPosition.deployed(),
      OwedToken.deployed(),
    ]);
  });

  describe('Constructor', () => {
    it('sets constants correctly', async () => {
      const contract = await ProductionDutchAuctionCloser.new(Margin.address, 1, 2);
      const [ssAddress, num, den] = await Promise.all([
        contract.DYDX_MARGIN.call(),
        contract.CALL_TIMELIMIT_NUMERATOR.call(),
        contract.CALL_TIMELIMIT_DENOMINATOR.call(),
      ]);
      expect(ssAddress).to.equal(Margin.address);
      expect(num).to.be.bignumber.equal(1);
      expect(den).to.be.bignumber.equal(2);
    });

    it('fails for bad constants', async () => {
      await expectThrow(ProductionDutchAuctionCloser.new(Margin.address, 0, 2));
      await expectThrow(ProductionDutchAuctionCloser.new(Margin.address, 3, 2));
    });
  });

  describe('#closePositionDirectly', () => {
    let salt = 1111;
    let callTimeLimit;
    let productionDutchAuctionCloser;

    beforeEach('approve ProductionDutchAuctionCloser for token transfers from bidder', async () => {
      // set up auction that starts halfway through
      productionDutchAuctionCloser = await ProductionDutchAuctionCloser.new(Margin.address, 1, 2);

      openTx = await doOpenPosition(
        accounts,
        {
          salt: salt++,
          positionOwner: ERC721MarginPosition.address
        }
      );

      await ERC721MarginPositionContract.approveRecipient(
        productionDutchAuctionCloser.address,
        true,
        { from: openTx.trader }
      );
      await dydxMargin.marginCall(
        openTx.id,
        0 /*requiredDeposit*/,
        { from: openTx.loanOffering.owner }
      );
      callTimeLimit = openTx.loanOffering.callTimeLimit;

      // grant tokens and set permissions for bidder
      const numTokens = await OwedTokenContract.balanceOf.call(dutchBidder);
      const maxInterest = await getMaxInterestFee(openTx);
      const targetTokens = openTx.principal.plus(maxInterest);

      if (numTokens < targetTokens) {
        await OwedTokenContract.issueTo(dutchBidder, targetTokens.minus(numTokens));
        await OwedTokenContract.approve(
          TokenProxy.address,
          targetTokens,
          { from: dutchBidder });
      }
    });

    it('fails if bid too early', async () => {
      await wait(1);
      await expectThrow(callClosePositionDirectly(
        dydxMargin,
        openTx,
        openTx.principal.div(2),
        {
          from: dutchBidder,
          recipient: productionDutchAuctionCloser.address
        }
      ));
    });

    it('succeeds if bids after callTimeLimit', async () => {
      await wait(callTimeLimit + 1);
      await callClosePositionDirectly(
        dydxMargin,
        openTx,
        openTx.principal.div(2),
        {
          from: dutchBidder,
          recipient: productionDutchAuctionCloser.address
        }
      );
    });

    it('succeeds if bids during the auction', async () => {
      await wait(callTimeLimit * 3 / 4);
      await callClosePositionDirectly(
        dydxMargin,
        openTx,
        openTx.principal.div(2),
        {
          from: dutchBidder,
          recipient: productionDutchAuctionCloser.address
        }
      );
    });
  });
});
