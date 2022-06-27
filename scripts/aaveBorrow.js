const { getWeth, Amount } = require("../scripts/getWeth")
const { getNamedAccounts, ethers } = require("hardhat")

// main function //
async function main() {
    await getWeth()
    const { deployer } = await getNamedAccounts()
    const lendingPool = await getLendingPool(deployer)

    console.log(`Lending pool address is ${lendingPool.address}`)

    const wethTokenAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
    // approving //
    await approveERC20(wethTokenAddress, lendingPool.address, Amount, deployer)
    console.log("depositing")
    // deposit //
    await lendingPool.deposit(wethTokenAddress, Amount, deployer, 0)
    console.log("deposited...")
    // get user data //
    let { availableBorrowsETH, totalDebtETH } = await getUserBorrowData(lendingPool, deployer)
    // Borrow //
    const daiPrice = await getDaiPrice()
    const amountDaiBorrow = availableBorrowsETH.toString() * 0.95 * (1 / daiPrice.toNumber())
    console.log(`You can borrow ${amountDaiBorrow} dai`)
    const amountDaiToBorrowWei = ethers.utils.parseEther(amountDaiBorrow.toString())
    const daiTokenAddress = "0x6b175474e89094c44da98b954eedeac495271d0f"

    await borrowDai(daiTokenAddress, lendingPool, amountDaiToBorrowWei, deployer)

    // looking our data after we borrow //
    await getUserBorrowData(lendingPool, deployer)

    // repay //
    await repay(amountDaiToBorrowWei, daiTokenAddress, lendingPool, deployer)
    // looking our data after we repay //
    await getUserBorrowData(lendingPool, deployer)
}

// functions //

async function getUserBorrowData(lendingPool, account) {
    const { totalCollateralETH, totalDebtETH, availableBorrowsETH } =
        await lendingPool.getUserAccountData(account)

    console.log(`You have ${totalCollateralETH} eth collateral`)
    console.log(`You have ${totalDebtETH} eth debt`)
    console.log(`You can ${availableBorrowsETH} eth borrow`)

    return { totalDebtETH, availableBorrowsETH }
}

async function getLendingPool(account) {
    const lendingPoolAddressesProvider = await ethers.getContractAt(
        "ILendingPoolAddressesProvider",
        "0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5",
        account // we are sending tx so we need to connect deployer(account)
    )
    const lendingPoolAddress = await lendingPoolAddressesProvider.getLendingPool()
    const lendingPool = await ethers.getContractAt("ILendingPool", lendingPoolAddress, account)
    return lendingPool
}

// Approve //
async function approveERC20(erc20Address, spenderAddress, amountToSpend, account) {
    const erc20Token = await ethers.getContractAt("IERC20", erc20Address, account)
    const tx = await erc20Token.approve(spenderAddress, amountToSpend)
    await tx.wait(1)
    console.log("approved!")
}

async function getDaiPrice() {
    const daiPrice = await ethers.getContractAt(
        "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol:AggregatorV3Interface",
        "0x773616E4d11A78F511299002da57A0a94577F1f4" // we are just reading so we don't need to connect deployer.
    )
    const price = (await daiPrice.latestRoundData())[1] // [1] for return answer
    console.log(`Dai price is ${price}`)
    return price
}

async function borrowDai(daiAddress, lendingPool, amountDaiBorrow, account) {
    const borrowTx = await lendingPool.borrow(daiAddress, amountDaiBorrow, 1, 0, account) // look at borrow function docs for 1 and 0 //
    await borrowTx.wait(1)
    console.log("Borrowed!")
}

async function repay(amount, daiAddress, lendingPool, account) {
    await approveERC20(daiAddress, lendingPool.address, amount, account)
    const repayTx = await lendingPool.repay(daiAddress, amount, 1, account)
    await repayTx.wait(1)
    console.log("Repaid!")
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
