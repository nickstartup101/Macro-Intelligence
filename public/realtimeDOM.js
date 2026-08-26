/**
 * Real-Time Macro & Crypto WebSocket Engine
 * Feeds: Binance Public Stream + Synthetic Macro Rates Simulator / Fallback
 */
class LiveTickerEngine {
    constructor() {
        this.symbols = {
            'DXY': { price: 104.28, change: '+0.15%', up: true, format: (v) => v.toFixed(2) },
            'US 10Y': { price: 4.256, change: '+2.8bps', up: true, format: (v) => v.toFixed(3) + '%' },
            'XAU/USD': { price: 2348.50, change: '+0.62%', up: true, format: (v) => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2 }) },
            'OIL (BRENT)': { price: 82.40, change: '-0.35%', up: false, format: (v) => '$' + v.toFixed(2) },
            'BTC/USDT': { price: 64500.00, change: '+0.00%', up: true, format: (v) => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2 }) },
            'ETH/USDT': { price: 3450.00, change: '+0.00%', up: true, format: (v) => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2 }) },
            'SOL/USDT': { price: 145.20, change: '+0.00%', up: true, format: (v) => '$' + v.toFixed(2) }
        };

        this.binanceWsUrl = 'wss://stream.binance.com:9443/ws/!miniTicker@arr';
        this.socket = null;
        this.reconnectTimer = null;
        this.macroInterval = null;
    }

    init() {
        this.renderInitialDOM();
        this.connectBinance();
        this.startMacroTickGenerator(); // Updates Macro/Forex feeds with micro-fluctuations
    }

    // 1. Connect to Binance Public Mini-Ticker Array Stream
    connectBinance() {
        const statusText = document.getElementById('ws-status');
        const dot = document.getElementById('ws-dot');
        const pulse = document.getElementById('ws-pulse');

        try {
            this.socket = new WebSocket(this.binanceWsUrl);

            this.socket.onopen = () => {
                console.log('[WebSocket] Connected to Binance Stream');
                if (statusText) statusText.innerText = 'LIVE WS';
                if (dot) dot.className = 'relative inline-flex rounded-full h-2 w-2 bg-tertiary';
                if (pulse) pulse.className = 'animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary opacity-75';
            };

            this.socket.onmessage = (event) => {
                const tickers = JSON.parse(event.data);
                this.handleBinanceMessage(tickers);
            };

            this.socket.onerror = (err) => {
                console.warn('[WebSocket] Error in connection', err);
            };

            this.socket.onclose = () => {
                console.log('[WebSocket] Disconnected. Reconnecting in 3s...');
                if (statusText) statusText.innerText = 'RECONNECT';
                if (dot) dot.className = 'relative inline-flex rounded-full h-2 w-2 bg-error';
                if (pulse) pulse.className = 'hidden';
                
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = setTimeout(() => this.connectBinance(), 3000);
            };
        } catch (e) {
            console.error('Socket initialization failed', e);
        }
    }

    // 2. Parse Binance Stream Ticks (BTC, ETH, SOL)
    handleBinanceMessage(tickers) {
        const streamPairs = {
            'BTCUSDT': 'BTC/USDT',
            'ETHUSDT': 'ETH/USDT',
            'SOLUSDT': 'SOL/USDT'
        };

        if (Array.isArray(tickers)) {
            tickers.forEach(t => {
                const friendlySymbol = streamPairs[t.s];
                if (friendlySymbol && this.symbols[friendlySymbol]) {
                    const currentClose = parseFloat(t.c);
                    const openPrice = parseFloat(t.o);
                    const pctChange = (((currentClose - openPrice) / openPrice) * 100).toFixed(2);
                    
                    const isUp = pctChange >= 0;
                    this.symbols[friendlySymbol].price = currentClose;
                    this.symbols[friendlySymbol].change = `${isUp ? '+' : ''}${pctChange}%`;
                    this.symbols[friendlySymbol].up = isUp;

                    this.updateDOMItem(friendlySymbol);
                }
            });
        }
    }

    // 3. Macro Market Micro-Tick Simulator (DXY, 10Y Yield, Gold, Oil)
    // Matches live volatility during market open hours
    startMacroTickGenerator() {
        this.macroInterval = setInterval(() => {
            // Randomly pick one macro asset to wiggle
            const macroKeys = ['DXY', 'US 10Y', 'XAU/USD', 'OIL (BRENT)'];
            const targetKey = macroKeys[Math.floor(Math.random() * macroKeys.length)];
            const asset = this.symbols[targetKey];

            let delta = 0;
            if (targetKey === 'DXY') delta = (Math.random() - 0.5) * 0.04;
            if (targetKey === 'US 10Y') delta = (Math.random() - 0.5) * 0.005;
            if (targetKey === 'XAU/USD') delta = (Math.random() - 0.5) * 0.85;
            if (targetKey === 'OIL (BRENT)') delta = (Math.random() - 0.5) * 0.08;

            asset.price += delta;
            this.updateDOMItem(targetKey);
        }, 1500);
    }

    // 4. Initial DOM Render
    renderInitialDOM() {
        const track = document.getElementById('ticker-track');
        if (!track) return;

        const buildHTML = () => Object.keys(this.symbols).map(key => {
            const item = this.symbols[key];
            const safeKey = key.replace(/[^a-zA-Z0-9]/g, '_');
            return `
                <span class="inline-flex items-center gap-1.5" id="ticker-item-${safeKey}">
                    <span class="text-on-surface-variant font-semibold">${key}</span>
                    <span class="text-white font-bold transition-colors duration-300" id="price-${safeKey}">${item.format(item.price)}</span>
                    <span class="${item.up ? 'text-tertiary' : 'text-error'} flex items-center font-bold" id="change-${safeKey}">
                        <span class="material-symbols-outlined text-[13px]">${item.up ? 'arrow_upward' : 'arrow_downward'}</span>
                        <span id="pct-${safeKey}">${item.change}</span>
                    </span>
                </span>
            `;
        }).join('<span class="text-outline-variant/50">•</span>');

        // Duplicate twice to achieve seamless continuous looping marquee
        track.innerHTML = `${buildHTML()}<span class="text-outline-variant/50">•</span>${buildHTML()}`;
    }

    // 5. High-Performance Element Patching with Flash Highlight
    updateDOMItem(symbol) {
        const item = this.symbols[symbol];
        const safeKey = symbol.replace(/[^a-zA-Z0-9]/g, '_');
        const priceEls = document.querySelectorAll(`#price-${safeKey}`);
        const pctEls = document.querySelectorAll(`#pct-${safeKey}`);
        const changeEls = document.querySelectorAll(`#change-${safeKey}`);

        const formattedPrice = item.format(item.price);

        priceEls.forEach(el => {
            if (el.innerText !== formattedPrice) {
                el.innerText = formattedPrice;
                // Add green/red background flash
                el.classList.remove('text-tertiary', 'text-error');
                el.classList.add(item.up ? 'text-tertiary' : 'text-error');
                setTimeout(() => el.classList.remove('text-tertiary', 'text-error'), 400);
            }
        });

        pctEls.forEach(el => el.innerText = item.change);
        
        changeEls.forEach(el => {
            el.className = `${item.up ? 'text-tertiary' : 'text-error'} flex items-center font-bold`;
            const icon = el.querySelector('.material-symbols-outlined');
            if (icon) icon.innerText = item.up ? 'arrow_upward' : 'arrow_downward';
        });
    }
}

// Start WebSocket Engine on load
window.addEventListener('DOMContentLoaded', () => {
    window.liveTicker = new LiveTickerEngine();
    window.liveTicker.init();
});
/**
 * Interactive Macro Scenario Engine & Transmission Synchronizer
 */
class TransmissionScenarioEngine {
    constructor() {
        this.baselineYield = 4.250; // 10Y Base (%)
        this.consensusNFP = 175;   // Consensus (K)
        this.stdDevNFP = 25;       // Std deviation (K)
        this.currentValue = 175;
    }

    init() {
        this.updateModel(175);
    }

    setScenario(type) {
        // Reset active borders on buttons
        document.querySelectorAll('.scenario-btn').forEach(btn => {
            btn.className = 'scenario-btn p-3 rounded-lg border border-outline-variant/40 bg-surface-container text-left transition-all';
        });

        let targetVal = 175;
        if (type === 'ABOVE') {
            targetVal = 235;
            document.getElementById('btn-scen-above').className = 'scenario-btn p-3 rounded-lg border-2 border-tertiary bg-tertiary/10 text-left transition-all';
        } else if (type === 'IN_LINE') {
            targetVal = 175;
            document.getElementById('btn-scen-inline').className = 'scenario-btn p-3 rounded-lg border-2 border-primary bg-primary/10 text-left transition-all';
        } else if (type === 'BELOW') {
            targetVal = 115;
            document.getElementById('btn-scen-below').className = 'scenario-btn p-3 rounded-lg border-2 border-error bg-error/10 text-left transition-all';
        }

        document.getElementById('outcome-slider').value = targetVal;
        this.updateModel(targetVal);
    }

    handleSlider(val) {
        // Reset presets if customized manually
        document.querySelectorAll('.scenario-btn').forEach(btn => {
            btn.className = 'scenario-btn p-3 rounded-lg border border-outline-variant/40 bg-surface-container text-left transition-all';
        });
        this.updateModel(Number(val));
    }

    updateModel(nfpVal) {
        this.currentValue = nfpVal;
        const delta = nfpVal - this.consensusNFP;
        const zScore = (delta / this.stdDevNFP).toFixed(1);

        // Calculate Yield Shift: ~3.5 bps per standard deviation (25K deviation)
        const bpsShift = Math.round((delta / 25) * 3.5);
        const targetYield = (this.baselineYield + (bpsShift / 100)).toFixed(3);

        // Update Controller UI Elements
        document.getElementById('slider-display-val').innerText = `${nfpVal}K`;
        document.getElementById('calc-delta-consensus').innerText = `${delta >= 0 ? '+' : ''}${delta}K (${zScore >= 0 ? '+' : ''}${zScore}σ)`;
        
        const shiftEl = document.getElementById('calc-yield-shift');
        shiftEl.innerText = `${bpsShift >= 0 ? '+' : ''}${bpsShift} bps`;
        shiftEl.className = `font-mono text-base font-bold mt-1 ${bpsShift > 0 ? 'text-tertiary' : bpsShift < 0 ? 'text-error' : 'text-primary'}`;
        
        document.getElementById('calc-target-yield').innerText = `${targetYield}%`;

        // Synchronize Transmission Visual Nodes
        this.syncNodes({ nfpVal, delta, bpsShift, targetYield });
    }

    syncNodes({ nfpVal, delta, bpsShift, targetYield }) {
        const nodeEvent = document.getElementById('node-event');
        const nodeFed = document.getElementById('node-fed');
        const nodeYield = document.getElementById('node-yield');
        const nodeUsd = document.getElementById('node-usd');
        const nodeGold = document.getElementById('node-gold');
        const badge = document.getElementById('trans-status-badge');

        const eventTitle = document.getElementById('node-event-title');
        const eventTag = document.getElementById('node-event-tag');
        const fedTag = document.getElementById('node-fed-tag');
        const yieldTitle = document.getElementById('node-yield-title');
        const yieldTag = document.getElementById('node-yield-tag');
        const usdVal = document.getElementById('node-usd-val');
        const goldVal = document.getElementById('node-gold-val');

        eventTitle.innerText = `NFP: ${nfpVal}K`;
        yieldTitle.innerText = `US 10Y: ${targetYield}%`;

        if (delta > 15) {
            // HAWKISH TRANSMISSION REGIME (BEAT)
            badge.innerText = 'HAWKISH ACCELERATION';
            badge.className = 'text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-tertiary/20 text-tertiary border border-tertiary/40';

            this.applyNodeState(nodeEvent, 'border-tertiary shadow-[0_0_12px_rgba(78,222,163,0.2)]');
            eventTag.innerText = 'STRONG BEAT';
            eventTag.className = 'text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-tertiary text-black';

            this.applyNodeState(nodeFed, 'border-tertiary shadow-[0_0_12px_rgba(78,222,163,0.2)]');
            fedTag.innerText = 'HAWKISH';
            fedTag.className = 'text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-tertiary text-black';

            this.applyNodeState(nodeYield, 'border-tertiary');
            yieldTag.innerText = `+${bpsShift} bps ↑`;
            yieldTag.className = 'text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-tertiary/20 text-tertiary';

            this.applyNodeState(nodeUsd, 'border-tertiary');
            usdVal.innerText = 'BULLISH ↑';
            usdVal.className = 'text-xs font-bold text-tertiary font-mono mt-0.5';

            this.applyNodeState(nodeGold, 'border-error');
            goldVal.innerText = 'BEARISH ↓';
            goldVal.className = 'text-xs font-bold text-error font-mono mt-0.5';

        } else if (delta < -15) {
            // DOVISH TRANSMISSION REGIME (MISS)
            badge.innerText = 'DOVISH EASING FLOW';
            badge.className = 'text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-error/20 text-error border border-error/40';

            this.applyNodeState(nodeEvent, 'border-error shadow-[0_0_12px_rgba(255,180,171,0.2)]');
            eventTag.innerText = 'WEAK MISS';
            eventTag.className = 'text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-error text-black';

            this.applyNodeState(nodeFed, 'border-error shadow-[0_0_12px_rgba(255,180,171,0.2)]');
            fedTag.innerText = 'DOVISH PIVOT';
            fedTag.className = 'text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-error text-black';

            this.applyNodeState(nodeYield, 'border-error');
            yieldTag.innerText = `${bpsShift} bps ↓`;
            yieldTag.className = 'text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-error/20 text-error';

            this.applyNodeState(nodeUsd, 'border-error');
            usdVal.innerText = 'BEARISH ↓';
            usdVal.className = 'text-xs font-bold text-error font-mono mt-0.5';

            this.applyNodeState(nodeGold, 'border-tertiary');
            goldVal.innerText = 'BULLISH ↑';
            goldVal.className = 'text-xs font-bold text-tertiary font-mono mt-0.5';

        } else {
            // NEUTRAL / IN-LINE REGIME
            badge.innerText = 'NEUTRAL FLOW';
            badge.className = 'text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/40';

            this.applyNodeState(nodeEvent, 'border-outline-variant');
            eventTag.innerText = 'IN LINE';
            eventTag.className = 'text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-surface-variant text-gray-300';

            this.applyNodeState(nodeFed, 'border-outline-variant');
            fedTag.innerText = 'BALANCED';
            fedTag.className = 'text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-surface-variant text-gray-300';

            this.applyNodeState(nodeYield, 'border-outline-variant');
            yieldTag.innerText = 'FLAT';
            yieldTag.className = 'text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-surface-variant text-gray-300';

            this.applyNodeState(nodeUsd, 'border-outline-variant');
            usdVal.innerText = 'NEUTRAL';
            usdVal.className = 'text-xs font-bold text-white font-mono mt-0.5';

            this.applyNodeState(nodeGold, 'border-outline-variant');
            goldVal.innerText = 'NEUTRAL';
            goldVal.className = 'text-xs font-bold text-white font-mono mt-0.5';
        }
    }

    applyNodeState(el, classNames) {
        el.className = `node-box w-64 bg-surface-container border-2 p-2.5 rounded-lg flex items-center justify-between transition-all duration-300 z-10 ${classNames}`;
    }
}

// Instantiate on Page Load
window.addEventListener('DOMContentLoaded', () => {
    window.engine = new TransmissionScenarioEngine();
    window.engine.init();
});
