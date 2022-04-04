const hre = require("hardhat");
const ethers = require('ethers');

async function main() {
  // Must format string into bytes32 data type before deploying the contract
  
  const cand1 = ethers.utils.formatBytes32String("candidate1");
  const cand2 = ethers.utils.formatBytes32String("candidate2");
  const cand3 = ethers.utils.formatBytes32String("candidate3");

  console.log("Candidate 1: ", cand1);
  console.log("Candidate 2: ", cand2);
  console.log("Candidate 3: ", cand3);
  

  const Ballot = await hre.ethers.getContractFactory("Ballot");
  const ballot = await Ballot.deploy([cand1, cand2, cand3]);
      
  await ballot.deployed();

  console.log("\nBallot contract deployed to:", ballot.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
