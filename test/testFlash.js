const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FlashLoan Contract", function () {
  let flashLoan;
  let owner;
  let BUSD, WBNB, CROX, CAKE;
  let PANCAKE_FACTORY, PANCAKE_ROUTER;

  before(async function () {
    [owner] = await ethers.getSigners();

    // Deploy mock tokens and Pancake contracts
    const MockToken = await ethers.getContractFactory("MockToken");
    BUSD = await MockToken.deploy("Binance USD", "BUSD");
    WBNB = await MockToken.deploy("Wrapped BNB", "WBNB");
    CROX = await MockToken.deploy("CROX Token", "CROX");
    CAKE = await MockToken.deploy("PancakeSwap Token", "CAKE");

    const MockFactory = await ethers.getContractFactory("MockUniswapV2Factory");
    PANCAKE_FACTORY = await MockFactory.deploy(owner.address);

    const MockRouter = await ethers.getContractFactory("MockUniswapV2Router02");
    PANCAKE_ROUTER = await MockRouter.deploy(PANCAKE_FACTORY.address, WBNB.address);

    // Deploy FlashLoan contract
    const FlashLoan = await ethers.getContractFactory("FlashLoan");
    flashLoan = await FlashLoan.deploy();

    // Create liquidity pools
    await PANCAKE_FACTORY.createPair(BUSD.address, WBNB.address);
    await PANCAKE_FACTORY.createPair(BUSD.address, CROX.address);
    await PANCAKE_FACTORY.createPair(CROX.address, CAKE.address);
    await PANCAKE_FACTORY.createPair(CAKE.address, BUSD.address);

    // Add liquidity to pools
    const addLiquidity = async (tokenA, tokenB, amountA, amountB) => {
      await tokenA.approve(PANCAKE_ROUTER.address, amountA);
      await tokenB.approve(PANCAKE_ROUTER.address, amountB);
      await PANCAKE_ROUTER.addLiquidity(
        tokenA.address,
        tokenB.address,
        amountA,
        amountB,
        0,
        0,
        owner.address,
        Math.floor(Date.now() / 1000) + 3600
      );
    };

    await addLiquidity(BUSD, WBNB, ethers.utils.parseEther("1000000"), ethers.utils.parseEther("1000000"));
    await addLiquidity(BUSD, CROX, ethers.utils.parseEther("1000000"), ethers.utils.parseEther("1000000"));
    await addLiquidity(CROX, CAKE, ethers.utils.parseEther("1000000"), ethers.utils.parseEther("1000000"));
    await addLiquidity(CAKE, BUSD, ethers.utils.parseEther("1000000"), ethers.utils.parseEther("1000000"));
  });

  it("should have correct initial setup", async function () {
    expect(await flashLoan.getBalanceOfToken(BUSD.address)).to.equal(0);
    expect(await flashLoan.getBalanceOfToken(CROX.address)).to.equal(0);
    expect(await flashLoan.getBalanceOfToken(CAKE.address)).to.equal(0);
  });

  it("should execute a flash loan and arbitrage", async function () {
    const flashLoanAmount = ethers.utils.parseEther("1000");

    // Mock the prices to ensure a profitable arbitrage
    await PANCAKE_ROUTER.setAmountOut(BUSD.address, CROX.address, flashLoanAmount, flashLoanAmount.mul(2));
    await PANCAKE_ROUTER.setAmountOut(CROX.address, CAKE.address, flashLoanAmount.mul(2), flashLoanAmount.mul(3));
    await PANCAKE_ROUTER.setAmountOut(CAKE.address, BUSD.address, flashLoanAmount.mul(3), flashLoanAmount.mul(4));

    await expect(flashLoan.initateArbitrage(BUSD.address, flashLoanAmount))
      .to.emit(BUSD, "Transfer")
      .withArgs(flashLoan.address, owner.address, flashLoanAmount.mul(4).sub(flashLoanAmount.mul(1003).div(1000)));
  });

  it("should fail if arbitrage is not profitable", async function () {
    const flashLoanAmount = ethers.utils.parseEther("1000");

    // Mock the prices to ensure an unprofitable arbitrage
    await PANCAKE_ROUTER.setAmountOut(BUSD.address, CROX.address, flashLoanAmount, flashLoanAmount.mul(9).div(10));
    await PANCAKE_ROUTER.setAmountOut(CROX.address, CAKE.address, flashLoanAmount.mul(9).div(10), flashLoanAmount.mul(8).div(10));
    await PANCAKE_ROUTER.setAmountOut(CAKE.address, BUSD.address, flashLoanAmount.mul(8).div(10), flashLoanAmount.mul(7).div(10));

    await expect(flashLoan.initateArbitrage(BUSD.address, flashLoanAmount))
      .to.be.revertedWith("Arbitrage not profitable");
  });
});