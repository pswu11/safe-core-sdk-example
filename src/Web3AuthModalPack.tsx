import {
  SafeAuthConfig,
  SafeAuthInitOptions,
  SafeAuthPack,
} from "@safe-global/auth-kit"
import { useEffect, useState } from "react"
import Safe, {
  EthersAdapter,
  SafeAccountConfig,
  SafeFactory,
} from "@safe-global/protocol-kit"
import {
  MetaTransactionData,
  MetaTransactionOptions,
} from "@safe-global/safe-core-sdk-types"
import { GelatoRelayPack } from "@safe-global/relay-kit"
import { ethers } from "ethers"
import { randomHex } from "web3-utils"

const options: SafeAuthInitOptions = {
  enableLogging: true,
  showWidgetButton: false,
  chainConfig: {
    chainId: "0x5",
    rpcTarget: "https://rpc.ankr.com/eth_goerli",
  },
}

const web3AuthConfig: SafeAuthConfig = {
  // goerli
  txServiceUrl: "https://safe-transaction-goerli.safe.global",
}

export default function AccountManagement() {
  const [safeAuth, setSafeAuth] = useState<SafeAuthPack>()
  const [web3Provider, setWeb3Provider] =
    useState<ethers.BrowserProvider | null>(null)
  const [ownerAddress, setOwnerAddress] = useState<string>("")
  const [ownerSafes, setOwnerSafes] = useState<any>([])
  const [selectedAddress, setSelectedAddress] = useState<string>("")
  // Instantiate and initialize the pack
  const authPack = new SafeAuthPack(web3AuthConfig)

  useEffect(() => {
    if (safeAuth) {
      safeAuth.destroy()
    }

    const init = async () => {
      await authPack.init(options)
      setSafeAuth(authPack)
    }
    init()
  }, [])

  const createAndSendTransaction = async () => {
    if (!web3Provider) {
      console.log("no web3 provider")
      return
    }

    const RANDOM_SALT = randomHex(32)
    const safeOwner = await web3Provider.getSigner()
    const ethAdapter = new EthersAdapter({
      ethers,
      signerOrProvider: safeOwner,
    })

    const safeFactory = await SafeFactory.create({
      ethAdapter: ethAdapter,
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

    const protocolKit = await Safe.create({
      ethAdapter: ethAdapter,
      predictedSafe: {
        safeAccountConfig: safeAccountConfig,
        safeDeploymentConfig: {
          saltNonce: RANDOM_SALT,
        },
      },
    })

    console.log("protocolKit created")

    const relayKit = new GelatoRelayPack({
      apiKey: import.meta.env.VITE_GELATO_RELAY_API_KEY!,
      protocolKit,
    })

    console.log("relayKit created")

    const transactions: MetaTransactionData[] = [
      {
        to: import.meta.env.VITE_RECEIVER_ADDRESS!,
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

    // Error happens here: ENS resolution requires a provider
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

  return (
    <div>
      <button
        onClick={async () => {
          if (safeAuth) {
            console.log("signing in")
            const { safes, eoa } = await safeAuth.signIn()
            if (!safes || safes.length === 0) {
              // create safe
              console.log("no safes")
            }
            // setSelectedAddress(safes[0])
            setOwnerAddress(eoa)
            setOwnerSafes(safes)

            const provider = safeAuth.getProvider()!
            setWeb3Provider(new ethers.BrowserProvider(provider))
          }
        }}
      >
        Connect
      </button>
      {safeAuth && (
        <div>
          <p>Eoa: {ownerAddress}</p>
          <form action="submit">
            <select
              onChange={(e) => {
                setSelectedAddress(e.target.value)
                console.log("selected", e.target.value)
              }}
            >
              {ownerSafes.map((address: string) => {
                return (
                  <option value={address} id={address}>
                    {address}
                  </option>
                )
              })}
            </select>
          </form>
          <button
            onClick={async () => {
              try {
                await createAndSendTransaction()
              } catch (error) {
                console.log(error)
              }
            }}
          >
            Send Transaction
          </button>
        </div>
      )}
    </div>
  )
}
