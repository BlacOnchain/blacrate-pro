let officialRate = 1600;
let isOfficialMode = false;
let lastTotal = 0;

const elements = {
    qty: document.getElementById('coinQty'),
    rate: document.getElementById('manualRate'),
    margin: document.getElementById('marginInput'),
    coin: document.getElementById('coinType'),
    marketShow: document.getElementById('marketValDisplay'),
    profitShow: document.getElementById('profitValDisplay'),
    finalShow: document.getElementById('nairaFinal'),
    offInfo: document.getElementById('officialRateInfo'),
    history: document.getElementById('historyList'),
    refresh: document.getElementById('refreshBtn'),
    copy: document.getElementById('copyBtn')
};

const formatNaira = value => value.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function readHistory() {
    try {
        return JSON.parse(localStorage.getItem('br_h')) || [];
    } catch (error) {
        localStorage.removeItem('br_h');
        return [];
    }
}

async function updateRates() {
    elements.refresh.disabled = true;
    elements.refresh.innerHTML = '<span>UPDATING...</span>';

    try {
        const cryptoRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether,solana&vs_currencies=usd');
        if (!cryptoRes.ok) throw new Error('Crypto rate request failed');
        const cryptoData = await cryptoRes.json();

        Array.from(elements.coin.options).forEach(option => {
            const coinId = option.dataset.coin;
            if (coinId && cryptoData[coinId]?.usd) option.value = cryptoData[coinId].usd;
        });

        const nairaRes = await fetch('https://open.er-api.com/v6/latest/USD');
        if (!nairaRes.ok) throw new Error('Currency rate request failed');
        const nairaData = await nairaRes.json();
        if (!nairaData.rates?.NGN) throw new Error('NGN rate unavailable');

        officialRate = nairaData.rates.NGN;
        elements.offInfo.textContent = `Official: N${formatNaira(officialRate)}`;
        if (!isOfficialMode) elements.rate.value = Math.round(officialRate * 1.05);
        runCalc();
    } catch (error) {
        elements.offInfo.textContent = `Official: N${formatNaira(officialRate)} (Cached)`;
    } finally {
        elements.refresh.disabled = false;
        elements.refresh.innerHTML = '<span>REFRESH</span>';
    }
}

function runCalc() {
    const qty = parseFloat(elements.qty.value) || 0;
    const coinUsd = parseFloat(elements.coin.value) || 1;
    const rate = parseFloat(elements.rate.value) || 0;
    const margin = parseFloat(elements.margin.value) || 0;
    const marketValue = qty * coinUsd * rate;
    const commission = qty * coinUsd * margin;
    const total = marketValue + commission;

    elements.marketShow.textContent = `N${formatNaira(marketValue)}`;
    elements.profitShow.textContent = `+N${formatNaira(commission)}`;
    elements.finalShow.textContent = formatNaira(total);

    if (total !== lastTotal) {
        elements.finalShow.parentElement.classList.remove('value-pulse');
        void elements.finalShow.parentElement.offsetWidth;
        elements.finalShow.parentElement.classList.add('value-pulse');
        lastTotal = total;
    }
}

function setMode(mode) {
    isOfficialMode = mode === 'official';
    elements.rate.value = isOfficialMode ? officialRate : Math.round(officialRate * 1.05);
    elements.rate.disabled = isOfficialMode;
    document.getElementById('p2pTab').classList.toggle('active', !isOfficialMode);
    document.getElementById('offTab').classList.toggle('active', isOfficialMode);
    document.getElementById('rateTypeLabel').textContent = isOfficialMode ? 'Official Rate (Locked)' : 'P2P Rate (Editable)';
    runCalc();
}

async function copyText(text) {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
    const helper = document.createElement('textarea');
    helper.value = text;
    helper.setAttribute('readonly', '');
    helper.style.position = 'fixed';
    helper.style.opacity = '0';
    document.body.appendChild(helper);
    helper.select();
    document.execCommand('copy');
    helper.remove();
}

document.getElementById('p2pTab').onclick = () => setMode('p2p');
document.getElementById('offTab').onclick = () => setMode('official');
elements.refresh.onclick = updateRates;
document.getElementById('clearHistBtn').onclick = () => {
    localStorage.removeItem('br_h');
    renderHistory();
};

[elements.qty, elements.rate, elements.margin, elements.coin].forEach(element => {
    element.addEventListener('input', runCalc);
    element.addEventListener('change', runCalc);
});

elements.copy.onclick = async function () {
    const selectedOption = elements.coin.options[elements.coin.selectedIndex];
    const text = `BLACRATE QUOTE\n\nSelling: ${elements.qty.value || 0} ${selectedOption.text}\nTotal: N${elements.finalShow.textContent}\n\nGenerated via BlacRate Pro`;

    try {
        await copyText(text);
        const history = readHistory();
        history.unshift({
            id: Date.now(),
            d: `${elements.qty.value || 0} ${selectedOption.text}`,
            a: elements.finalShow.textContent,
            t: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        localStorage.setItem('br_h', JSON.stringify(history.slice(0, 5)));
        this.textContent = 'COPIED TO CLIPBOARD';
        this.style.background = 'linear-gradient(115deg, #5cf2b0, #2ac58c)';
        this.style.color = '#06130f';
        renderHistory();
    } catch (error) {
        this.textContent = 'COPY FAILED - TRY AGAIN';
    }

    setTimeout(() => {
        this.textContent = 'Copy & Save Trade';
        this.style.background = '';
        this.style.color = '';
    }, 2200);
};

function deleteHistoryItem(id) {
    const history = readHistory().filter(item => item.id !== id);
    localStorage.setItem('br_h', JSON.stringify(history));
    renderHistory();
}

window.deleteHistoryItem = deleteHistoryItem;

function renderHistory() {
    const history = readHistory();
    elements.history.innerHTML = history.map(item => `
        <div class="h-item">
            <span>${item.d} <small>${item.t}</small></span>
            <div style="display:flex;align-items:center;gap:12px;">
                <span class="history-amount">N${item.a}</span>
                <button onclick="deleteHistoryItem(${item.id})" class="del-item-btn" title="Delete trade" type="button">×</button>
            </div>
        </div>`).join('');
}

runCalc();
updateRates();
renderHistory();
