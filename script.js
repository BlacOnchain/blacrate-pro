// --- CONFIG & STATE ---
let officialRate = 1600; 
let isOfficialMode = false;

const elements = {
    qty: document.getElementById('coinQty'),
    rate: document.getElementById('manualRate'),
    margin: document.getElementById('marginInput'),
    coin: document.getElementById('coinType'),
    marketShow: document.getElementById('marketValDisplay'),
    profitShow: document.getElementById('profitValDisplay'),
    finalShow: document.getElementById('nairaFinal'),
    offInfo: document.getElementById('officialRateInfo'),
    history: document.getElementById('historyList')
};

// --- API FETCHING ---
async function updateRates() {
    try {
        // Fetch Crypto
        const cryptoRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether,solana&vs_currencies=usd');
        const cryptoData = await cryptoRes.json();
        
        elements.coin.options[1].value = cryptoData.bitcoin.usd;
        elements.coin.options[2].value = cryptoData.ethereum.usd;
        elements.coin.options[3].value = cryptoData.solana.usd;

        // Fetch Naira Official
        const nairaRes = await fetch('https://open.er-api.com/v6/latest/USD');
        const nairaData = await nairaRes.json();
        officialRate = nairaData.rates.NGN;
        
        elements.offInfo.innerText = `Official: ₦${officialRate.toLocaleString()}`;
        if(!isOfficialMode) elements.rate.value = Math.round(officialRate * 1.05);
        
        runCalc();
    } catch (err) {
        console.log("Offline or API Error - Using stored rates");
    }
}

// --- CALCULATOR LOGIC ---
function runCalc() {
    const qty = parseFloat(elements.qty.value) || 0;
    const coinUsd = parseFloat(elements.coin.value);
    const rate = parseFloat(elements.rate.value) || 0;
    const margin = parseFloat(elements.margin.value) || 0;

    const marketValue = qty * coinUsd * rate;
    const commission = qty * coinUsd * margin;
    const total = marketValue + commission;

    elements.marketShow.innerText = "₦" + marketValue.toLocaleString('en-NG', {minimumFractionDigits: 2});
    elements.profitShow.innerText = "+₦" + commission.toLocaleString('en-NG', {minimumFractionDigits: 2});
    elements.finalShow.innerText = total.toLocaleString('en-NG', {minimumFractionDigits: 2});
}

// --- ENGINE TOGGLE ---
function setMode(mode) {
    isOfficialMode = (mode === 'official');
    elements.rate.value = isOfficialMode ? officialRate : Math.round(officialRate * 1.05);
    elements.rate.disabled = isOfficialMode;
    
    document.getElementById('p2pTab').classList.toggle('active', !isOfficialMode);
    document.getElementById('offTab').classList.toggle('active', isOfficialMode);
    document.getElementById('rateTypeLabel').innerText = isOfficialMode ? "Official Rate (Locked)" : "P2P Rate (Editable)";
    
    runCalc();
}

// --- EVENT LISTENERS ---
document.getElementById('p2pTab').onclick = () => setMode('p2p');
document.getElementById('offTab').onclick = () => setMode('official');
document.getElementById('refreshBtn').onclick = () => updateRates();
document.getElementById('clearHistBtn').onclick = () => { localStorage.removeItem('br_h'); renderHistory(); };

[elements.qty, elements.rate, elements.margin, elements.coin].forEach(el => {
    el.addEventListener('input', runCalc);
});

// --- COPY & HISTORY ---
document.getElementById('copyBtn').onclick = function() {
    const text = `💸 *BlacRate Quote*\n\nSelling: ${elements.qty.value} ${elements.coin.options[elements.coin.selectedIndex].text}\nTotal: ₦${elements.finalShow.innerText}\n\n_Generated via BlacRate Pro_`;
    navigator.clipboard.writeText(text);
    
    let h = JSON.parse(localStorage.getItem('br_h')) || [];
    h.unshift({ d: `${elements.qty.value} ${elements.coin.options[elements.coin.selectedIndex].text}`, a: elements.finalShow.innerText, t: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) });
    localStorage.setItem('br_h', JSON.stringify(h.slice(0, 5)));
    
    this.innerText = "COPIED! ✅";
    setTimeout(() => this.innerText = "Copy & Save Trade", 2000);
    renderHistory();
};

function renderHistory() {
    let h = JSON.parse(localStorage.getItem('br_h')) || [];
    elements.history.innerHTML = h.map(i => `
        <div class="h-item">
            <span>${i.d} <small style="opacity:0.3">${i.t}</small></span>
            <span style="color:var(--accent); font-weight:bold;">₦${i.a}</span>
        </div>`).join('');
}

// Initialize
updateRates();
renderHistory();