import { createSolanaRpc, devnet } from "@solana/kit";
import { getWallets } from "@wallet-standard/app";

const rpc = createSolanaRpc(devnet("https://api.devnet.solana.com"));
const walletListDiv = document.getElementById("wallet-list");
const connectedDiv = document.getElementById("connected");
const statusDiv = document.getElementById("status");
const errorDiv = document.getElementById("error");

let connectedWallet = null;
const SOLANA_SIGN_FEATURES = [
  "solana:signAndSendTransaction",
  "solana:signTransaction",
  "solana:signMessage",
];

function clearChildren(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function lamportsToSolString(lamports) {
  const lamportsValue = BigInt(lamports);
  const whole = lamportsValue / 1_000_000_000n;
  const fractional = lamportsValue % 1_000_000_000n;

  if (fractional === 0n) {
    return whole.toString();
  }

  return `${whole}.${fractional.toString().padStart(9, "0").replace(/0+$/, "")}`;
}

function isSolanaWallet(wallet) {
  const hasSolanaChain = wallet.chains?.some((chain) => chain.startsWith("solana:"));
  const hasConnectFeature = Boolean(wallet.features["standard:connect"]);
  const hasSolanaSignFeature = SOLANA_SIGN_FEATURES.some(
    (feature) => feature in wallet.features
  );

  return hasSolanaChain && hasConnectFeature && hasSolanaSignFeature;
}

function renderNoWalletsMessage() {
  clearChildren(walletListDiv);
  const message = document.createElement("p");
  message.append("No Solana wallets found.");
  message.append(document.createElement("br"));
  message.append("Install ");

  const link = document.createElement("a");
  link.href = "https://phantom.app";
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = "Phantom";
  message.append(link);
  message.append(" or another Solana wallet to continue.");
  walletListDiv.append(message);
}

function renderWalletList(wallets) {
  const solanaWallets = wallets.filter(isSolanaWallet);

  if (solanaWallets.length === 0) {
    renderNoWalletsMessage();
    statusDiv.textContent = "";
    return;
  }

  statusDiv.textContent = `Found ${solanaWallets.length} wallet(s):`;
  clearChildren(walletListDiv);

  for (const wallet of solanaWallets) {
    const btn = document.createElement("button");
    btn.className = "wallet-btn";
    btn.type = "button";

    if (wallet.icon) {
      const icon = document.createElement("img");
      icon.className = "wallet-icon";
      icon.src = wallet.icon;
      icon.alt = `${wallet.name} icon`;
      btn.append(icon);
    }

    btn.append(wallet.name);
    btn.addEventListener("click", () => connectWallet(wallet));
    walletListDiv.append(btn);
  }
}

function renderConnectedState(walletName, address, balanceInSol) {
  clearChildren(connectedDiv);

  const title = document.createElement("h3");
  title.textContent = `Connected to ${walletName}`;

  const addressLabel = document.createElement("div");
  addressLabel.className = "field";
  addressLabel.textContent = "Address:";

  const addressValue = document.createElement("div");
  addressValue.className = "mono";
  addressValue.textContent = address;

  const balance = document.createElement("div");
  balance.className = "field";
  balance.textContent = `Balance: ${balanceInSol} SOL`;

  const disconnectBtn = document.createElement("button");
  disconnectBtn.id = "disconnectBtn";
  disconnectBtn.type = "button";
  disconnectBtn.textContent = "Disconnect";

  connectedDiv.append(title, addressLabel, addressValue, balance, disconnectBtn);

  disconnectBtn.addEventListener("click", () => disconnectWallet(connectedWallet));
}

async function connectWallet(wallet) {
  errorDiv.textContent = "";
  const connectFeature = wallet.features["standard:connect"];

  if (!connectFeature) {
    errorDiv.textContent = "This wallet doesn't support connecting.";
    return;
  }

  try {
    statusDiv.textContent = "Requesting connection...";
    const { accounts } = await connectFeature.connect();

    if (accounts.length === 0) {
      errorDiv.textContent = "No accounts returned. Did you reject the request?";
      statusDiv.textContent = "";
      return;
    }

    connectedWallet = wallet;
    const account =
      accounts.find((candidate) =>
        candidate.chains?.some((chain) => chain.startsWith("solana:"))
      ) ?? accounts[0];
    const address = account.address;

    const { value: balanceInLamports } = await rpc.getBalance(address).send();
    const balanceInSol = lamportsToSolString(balanceInLamports);

    walletListDiv.style.display = "none";
    statusDiv.textContent = "";
    connectedDiv.style.display = "block";
    renderConnectedState(wallet.name, address, balanceInSol);
  } catch (err) {
    if (String(err?.message ?? "").toLowerCase().includes("metamask")) {
      errorDiv.textContent =
        "MetaMask is not supported for this Solana flow. Choose Phantom, Solflare, or Backpack.";
    } else {
      errorDiv.textContent = `Connection failed: ${err.message}`;
    }
    statusDiv.textContent = "";
  }
}

async function disconnectWallet(wallet) {
  if (!wallet) {
    return;
  }

  const disconnectFeature = wallet.features["standard:disconnect"];
  if (disconnectFeature) {
    await disconnectFeature.disconnect();
  }

  connectedWallet = null;
  connectedDiv.style.display = "none";
  walletListDiv.style.display = "flex";
  statusDiv.textContent = "Disconnected. Choose a wallet to reconnect:";
}

const { get, on } = getWallets();
renderWalletList(get());

on("register", () => {
  if (!connectedWallet) {
    renderWalletList(get());
  }
});
