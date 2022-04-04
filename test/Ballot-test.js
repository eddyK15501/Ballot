const chai = require('chai');
const { utils } = require('ethers');
const { ethers } = require('hardhat');
const { solidity } = require('ethereum-waffle');

chai.use(solidity);
const { expect } = chai;

let ballot;

beforeEach(async () => {
  [account0, account1, account2, account3, account4, account5] = await ethers.getSigners();

  const cand1 = utils.formatBytes32String("Person1");
  const cand2 = utils.formatBytes32String("Person2");
  const cand3 = utils.formatBytes32String("Person3");

  console.log("Candidate 1: ", cand1);
  console.log("Candidate 2: ", cand2);
  console.log("Candidate 3: ", cand3);
  
  const Ballot = await ethers.getContractFactory("Ballot");
  ballot = await Ballot.deploy([cand1, cand2, cand3]);
  await ballot.deployed();

  console.log("\nBallot contract deployed to:", ballot.address);
});

describe("Ballot", () => {
  it('starts the contract with a chairperson who gets a vote count weight of one', async () => {
    expect(await ballot.chairperson()).to.eq(account0.address);
    expect((await ballot.voters(account0.address)).weight).to.eq(1);
  });

  it('pushes a new proposal into the array', async () => {
    expect((await ballot.proposals(0)).name).to.eq(utils.formatBytes32String("Person1"));
    expect((await ballot.proposals(0)).voteCount).to.eq(0);
    expect((await ballot.proposals(1)).name).to.eq(utils.formatBytes32String("Person2"));
    expect((await ballot.proposals(1)).voteCount).to.eq(0);
    expect((await ballot.proposals(2)).name).to.eq(utils.formatBytes32String("Person3"));
    expect((await ballot.proposals(2)).voteCount).to.eq(0);
  });
});

describe("giveRightToVote", () => {
  it('only the chairperson can call the giveRightToVote function', async () => {
    await expect(ballot.connect(account1).giveRightToVote(account3.address))
      .to.be.revertedWith("You are not the chairperson. Not allowed");
  });

  it('cannot give right to vote to someone who has already voted', async () => {
    await ballot.connect(account0).giveRightToVote(account3.address);
    await ballot.connect(account3).vote(2);
    await expect(ballot.connect(account0).giveRightToVote(account3.address))
      .to.be.revertedWith("The voter already voted.");
  });

  it('requires the voter to have a weight of 0 before receiving a right to vote', async () => {
    await expect(ballot.giveRightToVote(account0.address)).to.be.reverted;
  });

  it('gives the right to vote with a weight of one to the voter', async () => {
    await ballot.connect(account0).giveRightToVote(account3.address);
    expect((await ballot.voters(account3.address)).weight).to.eq(1);
  });
});

describe("delegate", async () => {
  it('cannot delegate if you have already voted', async () => {
    await ballot.connect(account0).giveRightToVote(account3.address);
    await ballot.connect(account3).vote(2);
    await expect(ballot.connect(account3).delegate(account2.address)).to.be.revertedWith("You already voted.");
  });

  it('cannot self-delgate', async () => {
    await ballot.connect(account0).giveRightToVote(account3.address);
    await expect(ballot.connect(account0).delegate(account0.address)).to.be.revertedWith("Self-delegation is disallowed.");
  });

  it('can consecutively delegate the vote to any address, but not back to the msg.sender', async () => {
    await ballot.connect(account0).giveRightToVote(account1.address);
    await ballot.connect(account0).giveRightToVote(account2.address);
    await ballot.connect(account0).delegate(account1.address);
    await ballot.connect(account1).delegate(account2.address);
    await expect(ballot.connect(account2).delegate(account0.address)).to.be.revertedWith("Found loop in delegation.");
  });

  it('address has the correct weight, and can still vote after being delegated, even if the address does not call the giveRightToVote function', async () => {
    await ballot.connect(account0).giveRightToVote(account1.address);
    await ballot.connect(account0).delegate(account1.address);
    await ballot.connect(account1).delegate(account2.address);
    expect((await ballot.voters(account2.address)).weight).to.eq(2);
    await ballot.connect(account2).vote(0);
    expect((await ballot.proposals(0)).voteCount).to.eq(2);
  });

  it('updates the delegate address, as well as the status of the delegator to voted', async () => {
    await ballot.connect(account0).giveRightToVote(account1.address);
    await ballot.connect(account0).delegate(account1.address);
    expect((await ballot.voters(account0.address)).voted).to.eq(true);
    expect((await ballot.voters(account0.address)).delegate).to.eq(account1.address);
    await ballot.connect(account1).delegate(account2.address);
    expect((await ballot.voters(account1.address)).voted).to.eq(true);
    expect((await ballot.voters(account1.address)).delegate).to.eq(account2.address);

    expect((await ballot.voters(account2.address)).voted).to.eq(false);
    expect((await ballot.voters(account2.address)).delegate).to.eq(ethers.constants.AddressZero);
  });

  it('if the delegate already voted, directly adds the number of votes', async () => {
    await ballot.connect(account0).giveRightToVote(account1.address);
    await ballot.connect(account0).giveRightToVote(account2.address);
    await ballot.connect(account2).vote(0);

    await ballot.connect(account0).delegate(account1.address);
    await ballot.connect(account1).delegate(account2.address);
    expect((await ballot.proposals(0)).voteCount).to.be.equal(3);
  });

  it('if the delegate has not voted yet, then add to the weight', async () => {
    await ballot.connect(account0).giveRightToVote(account1.address);
    await ballot.connect(account0).giveRightToVote(account2.address);
    await ballot.connect(account0).delegate(account1.address);
    await ballot.connect(account1).delegate(account2.address);
    expect((await ballot.voters(account2.address)).weight).to.eq(3);
  });
});

describe("vote", () => {
  it('voter must not have a weight of 0', async () => {
    await expect(ballot.connect(account1).vote(0)).to.be.revertedWith("Has no right to vote");
  });

  it('can vote one time only', async () => {
    await ballot.connect(account0).giveRightToVote(account1.address);
    await ballot.connect(account1).vote(0);
    expect((await ballot.voters(account1.address)).voted).to.eq(true);
    await expect(ballot.connect(account1).vote(1)).to.be.revertedWith("Already voted.");
  });

  it("updates the voter's status, and adds the weight to the total vote count", async() => {
    await ballot.connect(account0).giveRightToVote(account1.address);
    await ballot.connect(account0).vote(0);
    await ballot.connect(account1).vote(0);
    expect((await ballot.voters(account1.address)).voted).to.eq(true);
    expect((await ballot.voters(account1.address)).vote).to.eq(0);
    expect((await ballot.proposals(0)).voteCount).to.eq(2);
  });
});

describe("winnerName", () => {
  it('can only be called by the chairperson', async () => {
    await ballot.connect(account0).giveRightToVote(account1.address);
    await ballot.connect(account0).vote(2);
    await ballot.connect(account1).vote(2);
    await expect(ballot.connect(account3).winnerName()).to.be.revertedWith("You are not the chairperson. Not allowed");
  });

  it('can call the winningProposal function and  pick a winner', async () => {
    await ballot.connect(account0).giveRightToVote(account1.address);
    await ballot.connect(account0).giveRightToVote(account2.address);
    await ballot.connect(account0).giveRightToVote(account3.address);
    await ballot.connect(account0).giveRightToVote(account4.address);
    await ballot.connect(account0).giveRightToVote(account5.address);

    await ballot.connect(account0).delegate(account1.address);
    await ballot.connect(account1).vote(2);
    await ballot.connect(account2).vote(2);
    await ballot.connect(account3).delegate(account4.address);
    await ballot.connect(account4).vote(0);
    await ballot.connect(account5).vote(1);

    expect(await ballot.connect(account0).winnerName()).to.eq(utils.formatBytes32String("Person3"));
  });
});