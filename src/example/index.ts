import { ethers } from "ethers"
import Safe, { EthersAdapter } from "@safe-global/protocol-kit"
import { SafeFactory } from "@safe-global/protocol-kit"
import { SafeAccountConfig } from "@safe-global/protocol-kit"
import dotenv from "dotenv"
import { GelatoRelayPack } from "@safe-global/relay-kit"
import {
  MetaTransactionData,
  MetaTransactionOptions,
} from "@safe-global/safe-core-sdk-types"
import { randomHex } from "web3-utils"

dotenv.config()

export async function CreateAndSend() {
  const RPC_URL = process.env.VITE_MUMBAI_ALCHEMY_URL!
  const RANDOM_SALT = randomHex(32)
  const provider = new ethers.JsonRpcProvider(RPC_URL)

  // Initialize owner & receiver
  // Owner has zero balance

  const safeOwner = new ethers.Wallet(
    process.env.OWNER_2_PRIVATE_KEY!,
    provider
  )

  const ethAdapterSafeOwner = new EthersAdapter({
    ethers,
    signerOrProvider: safeOwner,
  })

  console.log("owner and adapter initialized")

  // 1. Set up SafeFactory for 1/1 Safe
  // Notes: 1 voting needed for a transaction to be executed among 1 owner

  const safeFactory = await SafeFactory.create({
    ethAdapter: ethAdapterSafeOwner,
  })
  const safeAccountConfig: SafeAccountConfig = {
    owners: [await safeOwner.getAddress()],
    threshold: 1,
  }

  // predict safe address based on configs
  const predictedSafeAddress = await safeFactory.predictSafeAddress(
    safeAccountConfig,
    RANDOM_SALT
  )

  console.log("predictedSafeAddress:", predictedSafeAddress)

  // 2. Set up Relay Kit for deploying Safe

  /* At first glance, it seems like you can't get a Safe class without a deployed Safe,
    according to this Error: SafeProxy contract is not deployed on the current network.
    It turns out that you could create a Safe class without a deployed Safe, but you 
    have to give predictedSafe (config) to Safe.create, without the safeAddress.
    This behavior is not documented in the protocol-kit docs, but can be inferred from
    the source code of Safe.create. */

  const protocolKit = await Safe.create({
    ethAdapter: ethAdapterSafeOwner,
    predictedSafe: {
      safeAccountConfig: safeAccountConfig,
      safeDeploymentConfig: {
        saltNonce: RANDOM_SALT,
      },
    },
  })

  console.log("protocolKit created")

  const relayKit = new GelatoRelayPack({
    apiKey: process.env.GELATO_RELAY_API_KEY!,
    protocolKit,
  })

  const transactions: MetaTransactionData[] = [
    {
      to: process.env.RECEIVER_ADDRESS!,
      value: "0",
      data: "0x",
    },
  ]

  const options: MetaTransactionOptions = {
    isSponsored: true,
  }

  const safeTransaction = await relayKit.createRelayedTransaction({
    transactions,
    options,
  })

  const signedSafeTransaction = await protocolKit.signTransaction(
    safeTransaction
  )

  const response = await relayKit.executeRelayTransaction(
    signedSafeTransaction,
    options
  )

  console.log(
    `Relay Transaction Task ID: https://relay.gelato.digital/tasks/status/${response.taskId}`
  )
}

// main()
//   .then(() => process.exit(0))
//   .catch((error) => {
//     console.error(error)
//     process.exit(1)
//   })
