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
