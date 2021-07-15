import { LinkOutlined } from "@ant-design/icons";
import { StaticJsonRpcProvider, Web3Provider } from "@ethersproject/providers";
import { formatEther, parseEther } from "@ethersproject/units";
import WalletConnectProvider from "@walletconnect/web3-provider";
import AOS from "aos";
import "aos/dist/aos.css";
import { Alert, Col, Input, List, Menu, Row, Divider } from "antd";
// import "antd/dist/antd.css";
import { useUserAddress } from "eth-hooks";
import { utils } from "ethers";
import React, { useCallback, useEffect, useState } from "react";
import ReactJson from "react-json-view";
import { BrowserRouter, Link, Route, Switch } from "react-router-dom";
import StackGrid from "react-stack-grid";
import Web3Modal from "web3modal";
import "./App.scss";
import assets from "./assets.js";
import { Account, Address, AddressInput, Contract, Faucet, GasGauge, Header, Ramp, ThemeSwitch } from "./components";
import { DAI_ABI, DAI_ADDRESS, INFURA_ID, NETWORK, NETWORKS } from "./constants";
import { Transactor } from "./helpers";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import firebase from "./firebase/firebase.utils";
import ReactPlayer from "react-player/lazy";
import { LogoDiscord, LogoReddit, LogoTwitter } from "react-ionicons";
import CircularProgress from "@material-ui/core/CircularProgress";
import {
  useBalance,
  useContractLoader,
  useContractReader,
  useEventListener,
  useExchangePrice,
  useExternalContractLoader,
  useGasPrice,
  useOnBlock,
  useUserProvider,
} from "./hooks";
import { HashLink } from "react-router-hash-link";
import { Card, CardContent, CardTitle, CardSubtitle, CardHeader, CardActions } from "@react-md/card";
import Timeline from "@material-ui/lab/Timeline";
import TimelineItem from "@material-ui/lab/TimelineItem";
import TimelineSeparator from "@material-ui/lab/TimelineSeparator";
import TimelineConnector from "@material-ui/lab/TimelineConnector";
import TimelineContent from "@material-ui/lab/TimelineContent";
import TimelineDot from "@material-ui/lab/TimelineDot";

const { BufferList } = require("bl");
// https://www.npmjs.com/package/ipfs-http-client
const ipfsAPI = require("ipfs-http-client");

const ipfs = ipfsAPI({ host: "ipfs.infura.io", port: "5001", protocol: "https" });

console.log("📦 Assets: ", assets);

/*
    Welcome to 🏗 scaffold-eth !

    Code:
    https://github.com/austintgriffith/scaffold-eth

    Support:
    https://t.me/joinchat/KByvmRe5wkR-8F_zz6AjpA
    or DM @austingriffith on twitter or telegram

    You should get your own Infura.io ID and put it in `constants.js`
    (this is your connection to the main Ethereum network for ENS etc.)


    🌏 EXTERNAL CONTRACTS:
    You can also bring in contract artifacts in `constants.js`
    (and then use the `useExternalContractLoader()` hook!)
*/

/// 📡 What chain are your contracts deployed to?
const targetNetwork = NETWORKS.mainnet;
// NETWORKS.localhost; // <------- select your target frontend network (localhost, rinkeby, xdai, mainnet)

// 😬 Sorry for all the console logging
const DEBUG = true;

// EXAMPLE STARTING JSON:
const STARTING_JSON = {
  description: "It's actually a bison?",
  external_url: "https://austingriffith.com/portfolio/paintings/", // <-- this can link to a page for the specific file too
  image: "https://austingriffith.com/images/paintings/buffalo.jpg",
  name: "Buffalo",
  attributes: [
    {
      trait_type: "BackgroundColor",
      value: "green",
    },
    {
      trait_type: "Eyes",
      value: "googly",
    },
  ],
};

// helper function to "Get" from IPFS
// you usually go content.toString() after this...
const getFromIPFS = async hashToGet => {
  for await (const file of ipfs.get(hashToGet)) {
    console.log(file.path);
    if (!file.content) continue;
    const content = new BufferList();
    for await (const chunk of file.content) {
      content.append(chunk);
    }
    console.log(content);
    return content;
  }
};

// 🛰 providers
if (DEBUG) console.log("📡 Connecting to Mainnet Ethereum");
// const mainnetProvider = getDefaultProvider("mainnet", { infura: INFURA_ID, etherscan: ETHERSCAN_KEY, quorum: 1 });
// const mainnetProvider = new InfuraProvider("mainnet",INFURA_ID);
//
// attempt to connect to our own scaffold eth rpc and if that fails fall back to infura...
// Using StaticJsonRpcProvider as the chainId won't change see https://github.com/ethers-io/ethers.js/issues/901
const scaffoldEthProvider = new StaticJsonRpcProvider("https://rpc.scaffoldeth.io:48544");
const mainnetInfura = new StaticJsonRpcProvider("https://mainnet.infura.io/v3/" + INFURA_ID);
// ( ⚠️ Getting "failed to meet quorum" errors? Check your INFURA_I

// 🏠 Your local provider is usually pointed at your local blockchain
const localProviderUrl = targetNetwork.rpcUrl;
// as you deploy to other networks you can set REACT_APP_PROVIDER=https://dai.poa.network in packages/react-app/.env
const localProviderUrlFromEnv = process.env.REACT_APP_PROVIDER ? process.env.REACT_APP_PROVIDER : localProviderUrl;
if (DEBUG) console.log("🏠 Connecting to provider:", localProviderUrlFromEnv);
const localProvider = new StaticJsonRpcProvider(localProviderUrlFromEnv);

// 🔭 block explorer URL
const blockExplorer = targetNetwork.blockExplorer;

/*
  Web3 modal helps us "connect" external wallets:
*/
const web3Modal = new Web3Modal({
  // network: "mainnet", // optional
  cacheProvider: true, // optional
  providerOptions: {
    walletconnect: {
      package: WalletConnectProvider, // required
      options: {
        infuraId: INFURA_ID,
      },
    },
  },
});

const logoutOfWeb3Modal = async () => {
  await web3Modal.clearCachedProvider();
  setTimeout(() => {
    window.location.reload();
  }, 1);
};

function App(props) {
  AOS.init();
  const mainnetProvider = scaffoldEthProvider && scaffoldEthProvider._network ? scaffoldEthProvider : mainnetInfura;
  const [suggestion, setSuggestion] = useState("");
  const [email, setEmail] = useState("");

  const handleSuggestion = evt => {
    evt.preventDefault();
    const db = firebase.firestore();
    db.collection("suggestions").add({
      suggestion: suggestion,
      timestamp: Date(),
    });
    setSuggestion("");
  };
  const handleEmail = evt => {
    evt.preventDefault();
    const db = firebase.firestore();
    db.collection("email").add({
      email: email,
      timestamp: Date(),
    });
    setEmail("");
  };
  const [injectedProvider, setInjectedProvider] = useState();
  /* 💵 This hook will get the price of ETH from 🦄 Uniswap: */
  const price = useExchangePrice(targetNetwork, mainnetProvider);

  /* 🔥 This hook will get the price of Gas from ⛽️ EtherGasStation */
  const gasPrice = useGasPrice(targetNetwork, "fast");
  // Use your injected provider from 🦊 Metamask or if you don't have it then instantly generate a 🔥 burner wallet.
  const userProvider = useUserProvider(injectedProvider, localProvider);
  const address = useUserAddress(userProvider);

  // You can warn the user if you would like them to be on a specific network
  const localChainId = localProvider && localProvider._network && localProvider._network.chainId;
  const selectedChainId = userProvider && userProvider._network && userProvider._network.chainId;

  // For more hooks, check out 🔗eth-hooks at: https://www.npmjs.com/package/eth-hooks

  // The transactor wraps transactions and provides notificiations
  const tx = Transactor(userProvider, gasPrice);

  // Faucet Tx can be used to send funds from the faucet
  const faucetTx = Transactor(localProvider, gasPrice);

  // 🏗 scaffold-eth is full of handy hooks like this one to get your balance:
  const yourLocalBalance = useBalance(localProvider, address);

  // Just plug in different 🛰 providers to get your balance on different chains:
  const yourMainnetBalance = useBalance(mainnetProvider, address);

  // Load in your local 📝 contract and read a value from it:
  const readContracts = useContractLoader(localProvider);

  // If you want to make 🔐 write transactions to your contracts, use the userProvider:
  const writeContracts = useContractLoader(userProvider);

  // EXTERNAL CONTRACT EXAMPLE:
  //
  // If you want to bring in the mainnet DAI contract it would look like:
  const mainnetDAIContract = useExternalContractLoader(mainnetProvider, DAI_ADDRESS, DAI_ABI);

  // If you want to call a function on a new block
  useOnBlock(mainnetProvider, () => {
    console.log(`⛓ A new mainnet block is here: ${mainnetProvider._lastBlockNumber}`);
  });

  // Then read your DAI balance like:
  const myMainnetDAIBalance = useContractReader({ DAI: mainnetDAIContract }, "DAI", "balanceOf", [
    "0x34aA3F359A9D614239015126635CE7732c18fDF3",
  ]);

  // keep track of a variable from the contract in the local React state:
  const balance = useContractReader(readContracts, "YourCollectible", "balanceOf", [address]);
  console.log("🤗 balance:", balance);

  // 📟 Listen for broadcast events
  const transferEvents = useEventListener(readContracts, "YourCollectible", "Transfer", localProvider, 1);
  console.log("📟 Transfer events:", transferEvents);

  //
  // 🧠 This effect will update yourCollectibles by polling when your balance changes
  //
  const yourBalance = balance && balance.toNumber && balance.toNumber();
  const [yourCollectibles, setYourCollectibles] = useState();

  useEffect(() => {
    const updateYourCollectibles = async () => {
      const collectibleUpdate = [];
      for (let tokenIndex = 0; tokenIndex < balance; tokenIndex++) {
        try {
          console.log("GEtting token index", tokenIndex);
          const tokenId = await readContracts.YourCollectible.tokenOfOwnerByIndex(address, tokenIndex);
          console.log("tokenId", tokenId);
          const tokenURI = await readContracts.YourCollectible.tokenURI(tokenId);
          console.log("tokenURI", tokenURI);

          const ipfsHash = tokenURI.replace("https://ipfs.io/ipfs/", "");
          console.log("ipfsHash", ipfsHash);

          const jsonManifestBuffer = await getFromIPFS(ipfsHash);

          try {
            const jsonManifest = JSON.parse(jsonManifestBuffer.toString());
            console.log("jsonManifest", jsonManifest);
            collectibleUpdate.push({ id: tokenId, uri: tokenURI, owner: address, ...jsonManifest });
          } catch (e) {
            console.log(e);
          }
        } catch (e) {
          console.log(e);
        }
      }
      setYourCollectibles(collectibleUpdate);
    };
    updateYourCollectibles();
  }, [address, yourBalance]);

  /*
  const addressFromENS = useResolveName(mainnetProvider, "austingriffith.eth");
  console.log("🏷 Resolved austingriffith.eth as:",addressFromENS)
  */

  //
  // 🧫 DEBUG 👨🏻‍🔬
  //
  useEffect(() => {
    if (
      DEBUG &&
      mainnetProvider &&
      address &&
      selectedChainId &&
      yourLocalBalance &&
      yourMainnetBalance &&
      readContracts &&
      writeContracts &&
      mainnetDAIContract
    ) {
      console.log("_____________________________________ 🏗 scaffold-eth _____________________________________");
      console.log("🌎 mainnetProvider", mainnetProvider);
      console.log("🏠 localChainId", localChainId);
      console.log("👩‍💼 selected address:", address);
      console.log("🕵🏻‍♂️ selectedChainId:", selectedChainId);
      console.log("💵 yourLocalBalance", yourLocalBalance ? formatEther(yourLocalBalance) : "...");
      console.log("💵 yourMainnetBalance", yourMainnetBalance ? formatEther(yourMainnetBalance) : "...");
      console.log("📝 readContracts", readContracts);
      console.log("🌍 DAI contract on mainnet:", mainnetDAIContract);
      console.log("🔐 writeContracts", writeContracts);
    }
  }, [
    mainnetProvider,
    address,
    selectedChainId,
    yourLocalBalance,
    yourMainnetBalance,
    readContracts,
    writeContracts,
    mainnetDAIContract,
  ]);

  let networkDisplay = "";
  if (localChainId && selectedChainId && localChainId !== selectedChainId) {
    const networkSelected = NETWORK(selectedChainId);
    const networkLocal = NETWORK(localChainId);
    if (selectedChainId === 1337 && localChainId === 31337) {
      networkDisplay = (
        <div style={{ zIndex: 2, position: "fixed", right: 0, top: 60, padding: 16 }}>
          <Alert
            message="⚠️ Wrong Network ID"
            description={
              <div>
                You have <b>chain id 1337</b> for localhost and you need to change it to <b>31337</b> to work with
                HardHat.
                <div>(MetaMask -&gt; Settings -&gt; Networks -&gt; Chain ID -&gt; 31337)</div>
              </div>
            }
            type="error"
            closable={false}
          />
        </div>
      );
    } else {
      networkDisplay = (
        <div style={{ zIndex: 2, position: "fixed", right: 0, top: 60, padding: 16 }}>
          <Alert
            message="⚠️ Wrong Network"
            description={
              <div>
                You have <b>{networkSelected && networkSelected.name}</b> selected and you need to be on{" "}
                <b>{networkLocal && networkLocal.name}</b>.
              </div>
            }
            type="error"
            closable={false}
          />
        </div>
      );
    }
  } else {
    // networkDisplay = (
    //   <div style={{ zIndex: -1, position: "absolute", right: 154, top: 28, padding: 16, color: targetNetwork.color }}>
    //     {targetNetwork.name}
    //   </div>
    // );
  }

  const loadWeb3Modal = useCallback(async () => {
    const provider = await web3Modal.connect();
    setInjectedProvider(new Web3Provider(provider));
  }, [setInjectedProvider]);

  useEffect(() => {
    if (web3Modal.cachedProvider) {
      loadWeb3Modal();
    }
  }, [loadWeb3Modal]);

  const [route, setRoute] = useState();
  useEffect(() => {
    setRoute(window.location.pathname);
  }, [setRoute]);

  let faucetHint = "";
  const faucetAvailable = localProvider && localProvider.connection && targetNetwork.name === "localhost";

  const [faucetClicked, setFaucetClicked] = useState(false);
  if (
    !faucetClicked &&
    localProvider &&
    localProvider._network &&
    localProvider._network.chainId === 31337 &&
    yourLocalBalance &&
    formatEther(yourLocalBalance) <= 0
  ) {
    faucetHint = (
      <div style={{ padding: 16 }}>
        <Button
          type="primary"
          onClick={() => {
            faucetTx({
              to: address,
              value: parseEther("0.05"),
            });
            setFaucetClicked(true);
          }}
        >
          💰 Grab funds from the faucet ⛽️
        </Button>
      </div>
    );
  }

  const [yourJSON, setYourJSON] = useState(STARTING_JSON);
  const [sending, setSending] = useState();
  const [ipfsHash, setIpfsHash] = useState();
  const [ipfsDownHash, setIpfsDownHash] = useState();

  const [downloading, setDownloading] = useState();
  const [ipfsContent, setIpfsContent] = useState();

  const [transferToAddresses, setTransferToAddresses] = useState({});

  const [loadedAssets, setLoadedAssets] = useState();
  useEffect(() => {
    const updateYourCollectibles = async () => {
      const assetUpdate = [];
      for (const a in assets) {
        try {
          const forSale = await readContracts.YourCollectible.forSale(utils.id(a));
          let owner;
          if (!forSale) {
            const tokenId = await readContracts.YourCollectible.uriToTokenId(utils.id(a));
            owner = await readContracts.YourCollectible.ownerOf(tokenId);
          }
          assetUpdate.push({ id: a, ...assets[a], forSale, owner });
        } catch (e) {
          console.log(e);
        }
      }
      setLoadedAssets(assetUpdate);
    };
    if (readContracts && readContracts.YourCollectible) updateYourCollectibles();
  }, [assets, readContracts, transferEvents]);

  const galleryList = [];
  const buttonList = [];
  const connectToWallet = [];
  for (const a in loadedAssets) {
    console.log("loadedAssets", a, loadedAssets[a]);

    const cardActions = [];
    console.log(address + "mazza");
    if (loadedAssets[a].forSale && address) {
      // cardActions.push(
      //   <div className="button-row">
      //     <Button
      //       variant="contained"
      //       onClick={() => {
      //         const ethAmount = 0.05;
      //         // "value": web3.utils.toWei(amount,'ether')
      //         console.log("gasPrice,", gasPrice);
      //         tx(
      //           writeContracts.YourCollectible.mintItem(loadedAssets[a].id, {
      //             value: parseEther(ethAmount.toString()),
      //           }),
      //         );
      //       }}
      //       className="nft-button"
      //     >
      //       Collect
      //     </Button>
      //     {/* <Button
      //       onClick={() => {
      //         tx(writeContracts.YourCollectible.withdraw());
      //       }}
      //       className = "nft-button"
      //     >
      //       Withdraw
      //     </Button> */}
      //   </div>,
      // );
      buttonList.push(
        <div className="button-row">
          <Button
            variant="contained"
            onClick={() => {
              const ethAmount = 0.05;
              // "value": web3.utils.toWei(amount,'ether')
              console.log("gasPrice,", gasPrice);
              tx(
                writeContracts.YourCollectible.mintItem(loadedAssets[a].id, {
                  value: parseEther(ethAmount.toString()),
                }),
              );
            }}
            className="nft-button"
          >
            Collect
          </Button>
          {/* <Button
            onClick={() => {
              tx(writeContracts.YourCollectible.withdraw());
            }}
            className = "nft-button"
          >
            Withdraw
          </Button> */}
        </div>,
      );
    } else {
      connectToWallet.push(
        <div>
          <Button
            variant="outlined"
            className="alt-nft-button"
            /* type={minimized ? "default" : "primary"}     too many people just defaulting to MM and having a bad time */
            onClick={loadWeb3Modal}
          >
            Connect to Wallet
          </Button>
        </div>,
      );
    }
    if (loadedAssets[a].forSale) {
      galleryList.push(
        <Card
          className="nft-card"
          key={loadedAssets[a].name}
          title={
            <div>
              {loadedAssets[a].name}{" "}
              <a
                style={{ cursor: "pointer", opacity: 0.33 }}
                href={loadedAssets[a].external_url}
                target="_blank"
                rel="noreferrer"
              >
                <LinkOutlined />
              </a>
            </div>
          }
        >
          {/* <video style = {{
            height: 100,
            width: 100,
          }}>
            <source src={"https://ipfs.io/ipfs/Qmd6rNTbeviB4tGruY27z47wAs27yRGHTDyp7b2qhxLHtU"} type="video/mp4" />
          </video> */}
          {/* https://ipfs.io/ipfs/QmTSwPnsjnwBdqDrpGFP8LEaJjaMK9TVVyzLwvmqzse79G */}
          {/* <img className="nft-image" src={loadedAssets[a].image} alt="" /> */}
          <ReactPlayer
            // width='40%'
            height="90%"
            className="nft-video"
            url={loadedAssets[a].image}
            playing
            loop="true"
            // controls
            muted
          />
          <div style={{ opacity: 0.77 }}>{loadedAssets[a].description}</div>
          <CardActions>{cardActions}</CardActions>
        </Card>,
      );
    }
  }

  return (
    <div className="App">
      {/* ✏️ Edit the header and change the title to your project name */}
      {/* <Header /> */}
      {networkDisplay}

      <BrowserRouter>
        <Switch>
          <Route exact path="/">
            {/*
                🎛 this scaffolding is full of commonly used components
                this <Contract/> component will automatically parse your ABI
                and give you a form to interact with it locally
            */}

            {/* <div style={{ maxWidth: 820, margin: "auto", marginTop: 32, paddingBottom: 256 }}>
              <StackGrid columnWidth={200} gutterWidth={16} gutterHeight={16}>
                {galleryList}
              </StackGrid>
            </div> */}
            <div className="appbar">
              <div className="left-container">
                <HashLink smooth to={"/#section-two"} className="left-option">
                  About
                </HashLink>
                <HashLink smooth to={"/#section-three"} className="left-option">
                  RoadMap
                </HashLink>
                <HashLink smooth to={"/#section-four"} className="left-option">
                  FAQ
                </HashLink>
              </div>
              <div className="center">ENSO</div>
              <div className="options">
                <a href="https://discord.gg/Bv2NuGZ7Yv" className="icon-button">
                  <LogoDiscord
                    height="15%"
                    // width="15%"
                    color={"#464646"}
                    className="icon"
                  />
                </a>
                <a href="https://twitter.com/tryEnso" className="icon-button">
                  <LogoTwitter color={"#464646"} className="icon" />
                </a>
                <a href="https://www.reddit.com/r/enso_community/" className="icon-button">
                  <LogoReddit color={"#464646"} className="icon" />
                </a>
                {/* <body className="option">Check My Place</body> */}
              </div>
            </div>
            <section id="section-one" className="section-one">
              <div className="headers">
                <body className="title">Build A Community with Your NFTs</body>
                <body className="sub-title">
                  An easy to use NFT community builder for creators<br></br>to give their tokens more utility
                </body>
              </div>
              <div className="graphic"></div>
              <div className="button-row">
                {/* <Col span={4}> */}
                <HashLink smooth to={"/#buy-nft"}>
                  <Button variant="contained" type="primary" className="button-filled">
                    <div className="button-filled-text">Collect an ENSO NFT</div>
                  </Button>
                </HashLink>
                {/* </Col> */}
                {/* <Col span={5}> */}
                <div className="access-title">to Gain Priority Access or</div>
                {/* </Col> */}
                {/* <Col span={4}> */}
                <HashLink smooth to={"/#section-five"}>
                  <Button variant="outlined" type="primary" className="button">
                    <div className="button-text">Join Our Free Waitlist</div>
                  </Button>
                </HashLink>

                {/* </Col> */}
              </div>
            </section>

            <section id="section-two" className="section-two">
              <Divider className="dividerH">
                <body className="header">WHAT IS ENSO?</body>
              </Divider>
              <body className="subHeader">A space where your tokenholders can…</body>
              <div className="feature-row">
                <div className="feature" data-aos="fade-right">
                  <body className="emoji">🤫</body>
                  <body className="feature-descript">Access exclusive content</body>
                </div>
                <div className="feature" data-aos="fade-right">
                  <body className="emoji">🚁</body>
                  <body className="feature-descript">Easily get airdropped with surprises</body>
                </div>
              </div>
              <div className="feature-row">
                <div className="feature" data-aos="fade-left">
                  <body className="emoji">🏆</body>
                  <body className="feature-descript">Be rewarded for their participation</body>
                </div>
                <div className="feature" data-aos="fade-left">
                  <body className="emoji">🥳</body>
                  <body className="feature-descript">
                    and most importantly, Have fun through chats, threads, and voice rooms
                  </body>
                </div>
              </div>
              <div className="who-section">
                <div className="left-section">
                  <body className="left-text">ENSO IS PERFECT FOR...</body>
                </div>
                <div className="right-section" data-aos="fade-down">
                  <div className="demographic">
                    <body className="top-text">Creators who mint Individual Artworks</body>
                    <body className="bottom-text">
                      You are an artist like Wlop that has minted multiple artworks and any collector that holds one of
                      your pieces is able to join your Enso circle.
                    </body>
                  </div>
                  <div className="demographic">
                    <body className="top-text">Creators of an NFT Collection</body>
                    <body className="bottom-text">
                      You created an NFT collection called “Excited Dogs" and anyone who owns one of them is able to
                      access your Enso circle.
                    </body>
                  </div>
                </div>
              </div>
            </section>
            <section id="section-three" className="section-three">
              <body className="header-roadmap">ROAD MAP</body>
              <body className="sub-header">{"We Set These Goals to Make Our Vision A Reality"}</body>
              <div className="road-map" data-aos="fade-down">
                <Card className="quarters">
                  <CardHeader>
                    <CardTitle className="quarter-title">Early Q3</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Timeline align="alternate">
                      <TimelineItem>
                        <TimelineSeparator>
                          <TimelineDot />
                          <TimelineConnector />
                        </TimelineSeparator>
                        <TimelineContent className="quarter-descrip">
                          Set up our subreddit and discord server
                        </TimelineContent>
                      </TimelineItem>
                      <TimelineItem>
                        <TimelineSeparator>
                          <TimelineDot />
                          <TimelineConnector />
                        </TimelineSeparator>
                        <TimelineContent className="quarter-descrip">Code the draft our smart contract</TimelineContent>
                      </TimelineItem>
                      <TimelineItem>
                        <TimelineSeparator>
                          <TimelineDot />
                          <TimelineConnector />
                        </TimelineSeparator>
                        <TimelineContent className="quarter-descrip">Design the framework of the UI</TimelineContent>
                      </TimelineItem>
                      <TimelineItem>
                        <TimelineSeparator>
                          <TimelineDot />
                          <TimelineConnector />
                        </TimelineSeparator>
                        <TimelineContent className="quarter-descrip">Build core functionality</TimelineContent>
                      </TimelineItem>
                      <TimelineItem>
                        <TimelineSeparator>
                          <TimelineDot />
                        </TimelineSeparator>
                        <TimelineContent className="quarter-descrip">
                          Host biweekly town hall twitter spaces
                        </TimelineContent>
                      </TimelineItem>
                    </Timeline>
                  </CardContent>
                </Card>
                <Card className="quarters">
                  <CardHeader>
                    <CardTitle className="quarter-title">Late Q3</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Timeline align="alternate">
                      <TimelineItem>
                        <TimelineSeparator>
                          <TimelineDot />
                          <TimelineConnector />
                        </TimelineSeparator>
                        <TimelineContent className="quarter-descrip">
                          Focus building out the smaller features
                        </TimelineContent>
                      </TimelineItem>
                      <TimelineItem>
                        <TimelineSeparator>
                          <TimelineDot />
                          <TimelineConnector />
                        </TimelineSeparator>
                        <TimelineContent className="quarter-descrip">
                          Extensive alpha testing of the platform
                        </TimelineContent>
                      </TimelineItem>
                      <TimelineItem>
                        <TimelineSeparator>
                          <TimelineDot />
                          <TimelineConnector />
                        </TimelineSeparator>
                        <TimelineContent className="quarter-descrip">
                          Start Private Beta testing with the owners of Enso NFT
                        </TimelineContent>
                      </TimelineItem>
                      <TimelineItem>
                        <TimelineSeparator>
                          <TimelineDot />
                          <TimelineConnector />
                        </TimelineSeparator>
                        <TimelineContent className="quarter-descrip">Expand the Enso community</TimelineContent>
                      </TimelineItem>
                      <TimelineItem>
                        <TimelineSeparator>
                          <TimelineDot />
                        </TimelineSeparator>
                        <TimelineContent className="quarter-descrip">
                          Listen to feedback and integrate it
                        </TimelineContent>
                      </TimelineItem>
                    </Timeline>
                  </CardContent>
                </Card>
                <Card className="quarters">
                  <CardHeader>
                    <CardTitle className="quarter-title">Early Q4</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Timeline align="alternate">
                      <TimelineItem>
                        <TimelineSeparator>
                          <TimelineDot />
                          <TimelineConnector />
                        </TimelineSeparator>
                        <TimelineContent className="quarter-descrip">Expand developer team</TimelineContent>
                      </TimelineItem>
                      <TimelineItem>
                        <TimelineSeparator>
                          <TimelineDot />
                          <TimelineConnector />
                        </TimelineSeparator>
                        <TimelineContent className="quarter-descrip">
                          Release of public beta of the project
                        </TimelineContent>
                      </TimelineItem>
                      <TimelineItem>
                        <TimelineSeparator>
                          <TimelineDot />
                          <TimelineConnector />
                        </TimelineSeparator>
                        <TimelineContent className="quarter-descrip">Begin building the voice rooms</TimelineContent>
                      </TimelineItem>
                      <TimelineItem>
                        <TimelineSeparator>
                          <TimelineDot />
                          <TimelineConnector />
                        </TimelineSeparator>
                        <TimelineContent className="quarter-descrip">
                          Review and integrate feedback from public beta
                        </TimelineContent>
                      </TimelineItem>
                      <TimelineItem>
                        <TimelineSeparator>
                          <TimelineDot />
                        </TimelineSeparator>
                        <TimelineContent className="quarter-descrip">Launch of platform</TimelineContent>
                      </TimelineItem>
                    </Timeline>
                  </CardContent>
                </Card>
              </div>
            </section>
            <section id="section-four" className="section-four">
              <div className="header-div">
                <body className="header">FAQ</body>
              </div>
              <div className="right-section" data-aos="fade-left">
                <div className="Q-A">
                  <body className="question">Who’s on the team?</body>
                  <body className="answer">
                    Enso was created by 2 friends, Moodi and Tom, who are excited by the future of NFTs and saw that
                    current NFT creators want to give more utility to their tokens.
                    <br /> Moodi is an experienced startup founder and has a background in community building and computer
                    science, specifically blockchain technology and app development.
                    <br /> Tom has a background in marketing and finance. He adopted BTC and ETH back in 2017 and since
                    has been a huge proponent of crypto.
                    <br />
                    The NFTs were created by Moodi and designed by Sunrises. Check out more of their work{" "}
                    <a href="https://www.instagram.com/the__sunrises_art/" className="link-text">
                      here{" "}
                    </a>
                    .
                  </body>
                </div>
                <div className="Q-A">
                  <body className="question">Why do we want your email for the waitlist?</body>
                  <body className="answer">When we release more updates and info, we can easily notify you!</body>
                </div>
                <div className="Q-A">
                  <body className="question">Specs of the Enso NFT</body>
                  <body className="answer">
                    <ul>
                      <li>
                        Each of the unique Enso NFTs are unique and programmatically generated as they all include a
                        different background pattern. There are 10 red, 10 blue, 10 green and 5 multicolored patterns
                        and 5 rare editions with spiral designs.
                      </li>
                      <li>The NFTs are stored as ERC-721 tokens on the Ethereum blockchain and hosted on IPFS.</li>
                      <li>All of the token costs 0.05 to mint and there are no bonding curves.</li>
                    </ul>
                  </body>
                </div>
                <div className="Q-A">
                  <body className="question">How can you reach out to us?</body>
                  <body className="answer">
                    You can join{" "}
                    <a href="https://discord.gg/Bv2NuGZ7Yv" className="link-text">
                      our discord{" "}
                    </a>
                    or{" "}
                    <a href="https://www.reddit.com/r/enso_community/" className="link-text">
                      subreddit{" "}
                    </a>{" "}
                    to reach out to us. Or you can send us a{" "}
                    <a href="https://twitter.com/tryEnso" className="link-text">
                      DM on Twitter.
                    </a>
                  </body>
                </div>
              </div>
            </section>
            <section id="buy-nft" className="buy-nft">
              <div className="description">
                <div className="header"></div>
                <div className="sub-header">
                  {galleryList.length != 0 ? "Price: 0.05 ETH - Only " + galleryList.length + " Available" : ""}
                </div>
                <ul className="headerm">
                  <li>
                    A limited NFT collection where the token doubles as your membership to the Enso group as well as
                    access to the Enso platform when it launches.
                  </li>
                  <li>Each edition has a unique pattern generated through infinitive code.</li>
                </ul>
                {galleryList.length == 0 ? <CircularProgress style ={{
                  color: "white",
                }}/> : 
                <div className="buttonDesign">{address ? buttonList[0] : connectToWallet[0]}</div>}
                <div data-aos="fade-left">
                  <div className="feature-row1">
                    <Card className="feature">
                      <CardContent>
                        <div className="feature-title">🥇</div>
                        <div className="subcontent">Be one of the first to use Enso</div>
                      </CardContent>
                    </Card>
                    <Card className="feature">
                      <CardContent>
                        <div className="feature-title">📢</div>
                        <div className="subcontent">Have a voice in how we build the platform</div>
                      </CardContent>
                    </Card>
                  </div>
                  <div className="feature-row2">
                    <Card className="feature">
                      <CardContent>
                        <div className="feature-title">🍻</div>
                        <div className="subcontent">Membership to the Enso group</div>
                      </CardContent>
                    </Card>
                    <a href="https://twitter.com/tryEnso" className="link-text">
                      <div className="smallerText">
                        {" "}
                        Access to our private discord until we launch Enso!
                        <br /> DM us on twitter for access
                      </div>
                    </a>
                  </div>
                </div>
              </div>
              <div className="nfts" data-aos="fade-right">
                <ReactPlayer
                  // width='40%'
                  height="90%"
                  className="nft-video"
                  url={"https://gateway.pinata.cloud/ipfs/QmaVd7Gp88AEVLgi2BuDQSzjbxD13LQ71MUmV1zXgjmpUL/4D/ENOS4D_RED.mp4"}
                  playing
                  loop="true"
                  controls
                  muted
                />
              </div>
            </section>
            <div className="bottom-section">
              <section id="section-five" className="section-five">
                <body className="header">JOIN OUR WAITLIST</body>
                <body className="subheader">
                  Be one of the first to know when we launch and get other important updates!
                </body>
                <form className="suggestion-col" onSubmit={handleEmail}>
                  <TextField
                    className="suggestion"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    id="standard-required"
                    label="Email"
                  />
                  <Button variant="outlined" type="primary" className="button">
                    <body className="button-filled-text">Submit</body>
                  </Button>
                </form>
              </section>
              <section id="section-six" className="section-six">
                <body className="header">SUGGESTION BOX</body>
                <body className="subheader">We are open to any and all suggestions so send them over!</body>
                <form className="suggestion-col" onSubmit={handleSuggestion}>
                  <TextField
                    id="standard-full-width"
                    label="Suggestion Box"
                    multiline
                    className="suggestion"
                    rows={4}
                    required
                    value={suggestion}
                    onChange={e => setSuggestion(e.target.value)}
                    variant="outlined"
                    // defaultValue="Example: There should be a dark and light theme"
                  />
                  <Button variant="contained" type="primary" className="button-filled">
                    <body className="button-filled-text">SEND</body>
                  </Button>
                </form>
                {/* <div className="social-row">
                <a href="https://youtube.com">
                  <TwitterCircleFilled className="icon" />
                </a>
                <TwitterCircleFilled className="icon" />
                <TwitterCircleFilled className="icon" />
                <TwitterCircleFilled className="icon" />
                <TwitterCircleFilled className="icon" />
              </div> */}
              </section>
              <section className="endSection">
                <body className="header">CREATE AN AMAZING COMMUNITY</body>
                <body className="subheader">© TRY ENSO 2021 - ALL RIGHTS RESERVED</body>
              </section>
            </div>
            {/* <StackGrid columnWidth={200} gutterWidth={16} gutterHeight={16}>
              {galleryList}
            </StackGrid>
             */}
          </Route>
          {/*
          <Route path="/yourcollectibles">
            <div style={{ width: 640, margin: "auto", marginTop: 32, paddingBottom: 32 }}>
              <List
                bordered
                dataSource={yourCollectibles}
                renderItem={item => {
                  const id = item.id.toNumber();
                  return (
                    <List.Item key={id + "_" + item.uri + "_" + item.owner}>
                      <Card
                        title={
                          <div>
                            <span style={{ fontSize: 16, marginRight: 8 }}>#{id}</span> {item.name}
                          </div>
                        }
                      >
                        <div>
                          <img src={item.image} style={{ maxWidth: 150 }} alt="" />
                        </div>
                        <div>{item.description}</div>
                      </Card>

                      <div>
                        owner:{" "}
                        <Address
                          address={item.owner}
                          ensProvider={mainnetProvider}
                          blockExplorer={blockExplorer}
                          fontSize={16}
                        />
                        <AddressInput
                          ensProvider={mainnetProvider}
                          placeholder="transfer to address"
                          value={transferToAddresses[id]}
                          onChange={newValue => {
                            const update = {};
                            update[id] = newValue;
                            setTransferToAddresses({ ...transferToAddresses, ...update });
                          }}
                        />
                        <Button
                          onClick={() => {
                            console.log("writeContracts", writeContracts);
                            tx(writeContracts.YourCollectible.transferFrom(address, transferToAddresses[id], id));
                          }}
                        >
                          Transfer
                        </Button>
                      </div>
                    </List.Item>
                  );
                }}
              />
            </div>
          </Route>

          <Route path="/transfers">
            <div style={{ width: 600, margin: "auto", marginTop: 32, paddingBottom: 32 }}>
              <List
                bordered
                dataSource={transferEvents}
                renderItem={item => {
                  return (
                    <List.Item key={item[0] + "_" + item[1] + "_" + item.blockNumber + "_" + item[2].toNumber()}>
                      <span style={{ fontSize: 16, marginRight: 8 }}>#{item[2].toNumber()}</span>
                      <Address address={item[0]} ensProvider={mainnetProvider} fontSize={16} /> =&gt;
                      <Address address={item[1]} ensProvider={mainnetProvider} fontSize={16} />
                    </List.Item>
                  );
                }}
              />
            </div>
          </Route>

          <Route path="/ipfsup">
            <div style={{ paddingTop: 32, width: 740, margin: "auto", textAlign: "left" }}>
              <ReactJson
                style={{ padding: 8 }}
                src={yourJSON}
                theme="pop"
                enableClipboard={false}
                onEdit={(edit, a) => {
                  setYourJSON(edit.updated_src);
                }}
                onAdd={(add, a) => {
                  setYourJSON(add.updated_src);
                }}
                onDelete={(del, a) => {
                  setYourJSON(del.updated_src);
                }}
              />
            </div>

            <Button
              style={{ margin: 8 }}
              loading={sending}
              size="large"
              shape="round"
              type="primary"
              onClick={async () => {
                console.log("UPLOADING...", yourJSON);
                setSending(true);
                setIpfsHash();
                const result = await ipfs.add(JSON.stringify(yourJSON)); // addToIPFS(JSON.stringify(yourJSON))
                if (result && result.path) {
                  setIpfsHash(result.path);
                }
                setSending(false);
                console.log("RESULT:", result);
              }}
            >
              Upload to IPFS
            </Button>

            <div style={{ padding: 16, paddingBottom: 150 }}>{ipfsHash}</div>
          </Route>
          <Route path="/ipfsdown">
            <div style={{ paddingTop: 32, width: 740, margin: "auto" }}>
              <Input
                value={ipfsDownHash}
                placeHolder="IPFS hash (like QmadqNw8zkdrrwdtPFK1pLi8PPxmkQ4pDJXY8ozHtz6tZq)"
                onChange={e => {
                  setIpfsDownHash(e.target.value);
                }}
              />
            </div>
            <Button
              style={{ margin: 8 }}
              loading={sending}
              size="large"
              shape="round"
              type="primary"
              onClick={async () => {
                console.log("DOWNLOADING...", ipfsDownHash);
                setDownloading(true);
                setIpfsContent();
                const result = await getFromIPFS(ipfsDownHash); // addToIPFS(JSON.stringify(yourJSON))
                if (result && result.toString) {
                  setIpfsContent(result.toString());
                }
                setDownloading(false);
              }}
            >
              Download from IPFS
            </Button>

            <pre style={{ padding: 16, width: 500, margin: "auto", paddingBottom: 150 }}>{ipfsContent}</pre>
          </Route>
          <Route path="/debugcontracts">
            <Contract
              name="YourCollectible"
              signer={userProvider.getSigner()}
              provider={localProvider}
              address={address}
              blockExplorer={blockExplorer}
            />
          </Route>*/}
        </Switch>
      </BrowserRouter>

      {/* <ThemeSwitch /> */}

      {/* 👨‍💼 Your account is in the top right with a wallet at connect options */}
      {/* <div style={{ position: "fixed", textAlign: "right", right: 0, top: 30, padding: 20 }}>
        <Account
          address={address}
          localProvider={localProvider}
          userProvider={userProvider}
          mainnetProvider={mainnetProvider}
          price={price}
          web3Modal={web3Modal}
          loadWeb3Modal={loadWeb3Modal}
          logoutOfWeb3Modal={logoutOfWeb3Modal}
          blockExplorer={blockExplorer}
        />
        {faucetHint}
      </div> */}

      {/* 🗺 Extra UI like gas price, eth price, faucet, and support: */}
      {/* <div style={{ position: "fixed", textAlign: "left", left: 0, bottom: 20, padding: 10 }}>
        <Row align="middle" gutter={[4, 4]}>
          <Col span={8}>
            <Ramp price={price} address={address} networks={NETWORKS} />
          </Col>

          <Col span={8} style={{ textAlign: "center", opacity: 0.8 }}>
            <GasGauge gasPrice={gasPrice} />
          </Col>
          <Col span={8} style={{ textAlign: "center", opacity: 1 }}>
            <Button
              onClick={() => {
                window.open("https://t.me/joinchat/KByvmRe5wkR-8F_zz6AjpA");
              }}
              size="large"
              shape="round"
            >
              <span style={{ marginRight: 8 }} role="img" aria-label="support">
                💬
              </span>
              Support
            </Button>
          </Col>
        </Row>
          
        <Row align="middle" gutter={[4, 4]}>
          <Col span={24}>
            {
              faucetAvailable ? (
                <Faucet localProvider={localProvider} price={price} ensProvider={mainnetProvider} />
              ) : (
                ""
              )
            }
          </Col>
        </Row>
          </div> */}
    </div>
  );
}

/* eslint-disable */
window.ethereum &&
  window.ethereum.on("chainChanged", chainId => {
    web3Modal.cachedProvider &&
      setTimeout(() => {
        window.location.reload();
      }, 1);
  });

window.ethereum &&
  window.ethereum.on("accountsChanged", accounts => {
    web3Modal.cachedProvider &&
      setTimeout(() => {
        window.location.reload();
      }, 1);
  });
/* eslint-enable */

export default App;
