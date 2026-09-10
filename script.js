let officialRate = 1600;
let isOfficialMode = false;
let lastTotal = 0;

const elements = {
    qty: document.getElementById('coinQty'),
    rate: document.getElementById('manualRate'),
    margin: document.getElementById('marginInput'),
    coin: document.getElementById('coinType'),
    payment: document.getElementById('paymentChannel'),
    paymentTag: document.getElementById('paymentTag'),
    paymentFeeInfo: document.getElementById('paymentFeeInfo'),
    marketShow: document.getElementById('marketValDisplay'),
    profitShow: document.getElementById('profitValDisplay'),
    feeShow: document.getElementById('feeValDisplay'),
    finalShow: document.getElementById('nairaFinal'),
    offInfo: document.getElementById('officialRateInfo'),
    history: document.getElementById('historyList'),
    refresh: document.getElementById('refreshBtn'),
    copy: document.getElementById('copyBtn'),
    receipt: document.getElementById('receiptBtn'),
    volumeMetric: document.getElementById('volumeMetric'),
    commissionMetric: document.getElementById('commissionMetric'),
    marginMetric: document.getElementById('marginMetric'),
    chart: document.getElementById('analyticsChart'),
    alertThreshold: document.getElementById('alertThreshold'),
    alertDirection: document.getElementById('alertDirection'),
    saveAlert: document.getElementById('saveAlertBtn'),
    alertStatus: document.getElementById('alertStatus'),
    alertMessage: document.getElementById('alertMessage')
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
        const cryptoRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether,solana,usd-coin,binancecoin,the-open-network&vs_currencies=usd');
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
        checkAlert();
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
    const channelFeeRate = parseFloat(elements.payment.value) || 0;
    const marketValue = qty * coinUsd * rate;
    const commission = qty * coinUsd * margin;
    const channelFee = marketValue * channelFeeRate;
    const total = marketValue + commission + channelFee;

    elements.marketShow.textContent = `N${formatNaira(marketValue)}`;
    elements.profitShow.textContent = `+N${formatNaira(commission)}`;
    elements.feeShow.textContent = `-N${formatNaira(channelFee)}`;
    elements.finalShow.textContent = formatNaira(total);

    if (total !== lastTotal) {
        elements.finalShow.parentElement.classList.remove('value-pulse');
        void elements.finalShow.parentElement.offsetWidth;
        elements.finalShow.parentElement.classList.add('value-pulse');
        lastTotal = total;
    }
    checkAlert();
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

elements.payment.addEventListener('change', () => {
    const selectedPayment = elements.payment.options[elements.payment.selectedIndex];
    const feeRate = parseFloat(selectedPayment.value) || 0;
    elements.paymentTag.textContent = selectedPayment.dataset.tag;
    elements.paymentFeeInfo.textContent = feeRate ? `${feeRate * 100}% processing impact` : 'No processing fee';
    runCalc();
});

function readAlert() {
    try { return JSON.parse(localStorage.getItem('br_alert')) || null; } catch (error) { return null; }
}

function checkAlert() {
    const alert = readAlert();
    if (!alert) return;
    const currentRate = parseFloat(elements.rate.value) || 0;
    const triggered = alert.direction === 'above' ? currentRate >= alert.threshold : currentRate <= alert.threshold;
    elements.alertStatus.textContent = triggered ? 'TRIGGERED' : 'ACTIVE';
    elements.alertStatus.className = `alert-status ${triggered ? 'triggered' : 'active'}`;
    elements.alertMessage.textContent = triggered
        ? `Rate watch hit at N${formatNaira(currentRate)}.`
        : `Watching for ${alert.direction === 'above' ? 'N' + formatNaira(alert.threshold) + ' or higher' : 'N' + formatNaira(alert.threshold) + ' or lower'}.`;
    if (triggered && 'Notification' in window && Notification.permission === 'granted' && alert.lastNotified !== alert.threshold) {
        new Notification('BlacRate rate alert', { body: `Current P2P rate is N${formatNaira(currentRate)}.` });
        alert.lastNotified = alert.threshold;
        localStorage.setItem('br_alert', JSON.stringify(alert));
    }
}

elements.saveAlert.onclick = async () => {
    const threshold = parseFloat(elements.alertThreshold.value);
    if (!threshold || threshold < 0) {
        elements.alertMessage.textContent = 'Enter a valid Naira threshold first.';
        return;
    }
    if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
    localStorage.setItem('br_alert', JSON.stringify({ threshold, direction: elements.alertDirection.value, lastNotified: null }));
    checkAlert();
};

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
            total: marketValueForHistory(),
            commission: parseFloat(elements.profitShow.textContent.replace(/[^0-9.-]/g, '')) || 0,
            fee: parseFloat(elements.feeShow.textContent.replace(/[^0-9.-]/g, '')) || 0,
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

elements.receipt.onclick = () => {
    const selectedOption = elements.coin.options[elements.coin.selectedIndex];
    const selectedPayment = elements.payment.options[elements.payment.selectedIndex];
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 900;
    canvas.height = 1120;

    const gradient = context.createLinearGradient(0, 0, 900, 1120);
    gradient.addColorStop(0, '#111b26');
    gradient.addColorStop(1, '#060a10');
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#8d7aff';
    context.fillRect(0, 0, canvas.width, 18);
    context.fillStyle = '#f5f7fb';
    context.font = '900 52px Arial';
    context.fillText('Blac', 70, 115);
    context.fillStyle = '#b5a8ff';
    context.fillText('Rate', 195, 115);
    context.fillStyle = '#9daab5';
    context.font = '600 22px Arial';
    context.fillText('PROFESSIONAL TRADE QUOTE', 72, 158);

    const rows = [
        ['Asset', `${elements.qty.value || 0} ${selectedOption.text}`],
        ['Rate', `N${formatNaira(parseFloat(elements.rate.value) || 0)}`],
        ['Payment', selectedPayment.dataset.tag],
        ['Market value', elements.marketShow.textContent],
        ['Commission', elements.profitShow.textContent],
        ['Channel fee', elements.feeShow.textContent]
    ];
    context.fillStyle = 'rgba(255,255,255,0.07)';
    context.roundRect(55, 220, 790, 450, 24);
    context.fill();
    rows.forEach((row, index) => {
        const y = 285 + index * 60;
        context.fillStyle = '#9daab5';
        context.font = '600 22px Arial';
        context.fillText(row[0].toUpperCase(), 90, y);
        context.fillStyle = '#f5f7fb';
        context.font = '700 25px Arial';
        context.fillText(row[1], 490, y);
    });
    context.fillStyle = '#9daab5';
    context.font = '700 21px Arial';
    context.fillText('FINAL QUOTE', 75, 780);
    context.fillStyle = '#b5a8ff';
    context.font = '900 64px Arial';
    context.fillText(`N${elements.finalShow.textContent}`, 70, 860);
    context.fillStyle = '#9daab5';
    context.font = '500 20px Arial';
    context.fillText(`Generated ${new Date().toLocaleString()}`, 70, 980);
    context.fillText('BlacRate Pro | Trade with clarity', 70, 1020);

    const link = document.createElement('a');
    link.download = `blacrate-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    elements.receipt.textContent = 'RECEIPT DOWNLOADED';
    setTimeout(() => { elements.receipt.textContent = 'Download Branded Receipt'; }, 2200);
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
    renderAnalytics(history);
}

function marketValueForHistory() {
    return parseFloat(elements.marketShow.textContent.replace(/[^0-9.-]/g, '')) || 0;
}

function renderAnalytics(history) {
    const volume = history.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
    const commission = history.reduce((sum, item) => sum + (Number(item.commission) || 0), 0);
    const averageMargin = history.length ? commission / history.length : 0;
    elements.volumeMetric.textContent = `N${formatNaira(volume)}`;
    elements.commissionMetric.textContent = `N${formatNaira(commission)}`;
    elements.marginMetric.textContent = `N${formatNaira(averageMargin)}`;

    const context = elements.chart.getContext('2d');
    const width = elements.chart.width;
    const height = elements.chart.height;
    context.clearRect(0, 0, width, height);
    context.strokeStyle = 'rgba(255,255,255,0.1)';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(0, height - 24);
    context.lineTo(width, height - 24);
    context.stroke();
    const points = history.slice().reverse().map(item => Number(item.total) || 0);
    if (!points.length) return;
    const max = Math.max(...points, 1);
    const step = points.length === 1 ? width / 2 : width / (points.length - 1);
    context.beginPath();
    points.forEach((point, index) => {
        const x = points.length === 1 ? width / 2 : index * step;
        const y = height - 28 - (point / max) * (height - 54);
        index ? context.lineTo(x, y) : context.moveTo(x, y);
    });
    context.strokeStyle = '#8d7aff';
    context.lineWidth = 5;
    context.lineJoin = 'round';
    context.stroke();
    points.forEach((point, index) => {
        const x = points.length === 1 ? width / 2 : index * step;
        const y = height - 28 - (point / max) * (height - 54);
        context.fillStyle = '#b5a8ff';
        context.beginPath();
        context.arc(x, y, 6, 0, Math.PI * 2);
        context.fill();
    });
}

runCalc();
updateRates();
renderHistory();
const savedAlert = readAlert();
if (savedAlert) {
    elements.alertThreshold.value = savedAlert.threshold;
    elements.alertDirection.value = savedAlert.direction;
    checkAlert();
}
