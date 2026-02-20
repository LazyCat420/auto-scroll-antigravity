// ANTIGRAVITY AUTOMATOR V17.0 — OMNI-CLICKER + STUCK RECOVERY
console.log("🚀 Antigravity Automator V17.0 (Omni-Clicker) Active");

// 1. CLEANUP
if (window.agAutomator) clearInterval(window.agAutomator);
if (window.agObserver) { window.agObserver.disconnect(); window.agObserver = null; }
if (window.agObserver2) { window.agObserver2.disconnect(); window.agObserver2 = null; }
if (window.agScanner) { window.agScanner.disconnect(); window.agScanner = null; }
if (window.agHeartbeat) { clearInterval(window.agHeartbeat); window.agHeartbeat = null; }
if (window.agStuckChecker) { clearInterval(window.agStuckChecker); window.agStuckChecker = null; }
if (window.agPrimaryScanner) { clearInterval(window.agPrimaryScanner); window.agPrimaryScanner = null; }
if (window.agAcceptAllScanner) { clearInterval(window.agAcceptAllScanner); window.agAcceptAllScanner = null; }
if (window.agAlwaysAllowScanner) { clearInterval(window.agAlwaysAllowScanner); window.agAlwaysAllowScanner = null; }

// ====== STATE ======
let isStreaming = false;
let mutationBurst = 0;
let streamingTimeout = null;
let userScrolledUp = false;
let stuckDetected = false;
let lastStuckTime = 0;
const STREAMING_THRESHOLD = 3;
const IDLE_DELAY = 2000;
const HEARTBEAT_INTERVAL = 3000;
const STUCK_COOLDOWN_MS = 5000;
const ACTION_BUTTON_SCAN_MS = 1000;

// 2. Recursive Shadow DOM Selector
function querySelectorAllShadows(selector, root) {
    if (!root) return [];
    const results = [...root.querySelectorAll(selector)];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    while (walker.nextNode()) {
        const node = walker.currentNode;
        if (node.shadowRoot) results.push(...querySelectorAllShadows(selector, node.shadowRoot));
    }
    return results;
}

// 3. Iframe Finder
function getCascadeIframe() {
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
        try {
            const src = iframe.src || '';
            if (src.includes('cascade-panel') || src.includes('antigravity')) {
                const doc = iframe.contentDocument || iframe.contentWindow.document;
                if (doc && doc.body) return doc;
            }
        } catch (e) { }
    }
    for (const iframe of iframes) {
        try {
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            if (doc && doc.body) return doc;
        } catch (e) { }
    }
    return null;
}

// 4. Find ALL scrollable containers in a document
function findAllScrollableContainers(doc) {
    const containers = [];
    const allDivs = doc.querySelectorAll('div');
    allDivs.forEach(el => {
        if (el.scrollHeight > el.clientHeight && el.clientHeight > 50) {
            const style = window.getComputedStyle(el);
            const ov = style.overflowY;
            if (ov === 'scroll' || ov === 'auto' || ov === 'overlay') {
                containers.push(el);
            }
        }
    });
    return containers;
}

// 5. Force-scroll ALL scrollable containers to the bottom
function forceScrollAllContainers(doc) {
    const containers = findAllScrollableContainers(doc);
    if (containers.length === 0) return;

    // console.log(`🔄 Force-scrolling ${containers.length} scrollable containers`);
    containers.forEach((el, i) => {
        const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        if (distFromBottom > 5) {
            el.scrollTop = el.scrollHeight;
        }
    });
}

// 6. PRECISION Auto-Scroll
function isPopupOpen(doc) {
    const typeahead = doc.querySelector('#typeahead-menu, .lexical-typeahead-menu');
    if (typeahead) return true;
    const menu = doc.querySelector('.menubar-menu-items-holder, .monaco-menu-container');
    if (menu) return true;
    const popup = doc.querySelector('[role="listbox"], [role="menu"], .suggest-widget, .quick-input-widget');
    if (popup) return true;
    return false;
}

function autoScroll(doc) {
    if (!isStreaming) return;
    if (userScrolledUp) return;
    if (isPopupOpen(doc)) return;

    const convo = doc.getElementById('conversation');
    if (!convo) {
        const chat = doc.getElementById('chat');
        if (chat) scrollDeepestContainer(chat);
        return;
    }

    let scrollTarget = findScrollableParent(convo);
    if (scrollTarget) {
        scrollTarget.scrollTop = scrollTarget.scrollHeight;
    }
}

function findScrollableParent(el) {
    let node = el;
    while (node) {
        if (node.scrollHeight > node.clientHeight && node.clientHeight > 50) {
            const style = window.getComputedStyle(node);
            const ov = style.overflowY;
            if (ov === 'scroll' || ov === 'auto') {
                return node;
            }
        }
        node = node.parentElement;
    }
    return null;
}

function scrollDeepestContainer(root) {
    const candidates = root.querySelectorAll('div');
    let best = null;
    let bestDepth = -1;
    candidates.forEach(el => {
        if (el.scrollHeight > el.clientHeight && el.clientHeight > 50) {
            const style = window.getComputedStyle(el);
            if (style.overflowY === 'scroll' || style.overflowY === 'auto') {
                let depth = 0, n = el;
                while (n.parentElement) { depth++; n = n.parentElement; }
                if (depth > bestDepth) { bestDepth = depth; best = el; }
            }
        }
    });
    if (best) best.scrollTop = best.scrollHeight;
}

// 7. User scroll detection
function setupScrollDetection(doc) {
    doc.addEventListener('wheel', (e) => {
        if (e.deltaY < 0) {
            if (!userScrolledUp) {
                userScrolledUp = true;
                console.log("⏸️ User scrolled up — auto-scroll paused until streaming restarts");
            }
        } else if (e.deltaY > 0) {
            const convo = doc.getElementById('conversation');
            if (convo) {
                const scrollParent = findScrollableParent(convo);
                if (scrollParent) {
                    const distFromBottom = scrollParent.scrollHeight - scrollParent.scrollTop - scrollParent.clientHeight;
                    if (distFromBottom < 100) {
                        if (userScrolledUp) {
                            userScrolledUp = false;
                            console.log("▶️ User scrolled to bottom — auto-scroll resumed");
                        }
                    }
                }
            }
        }
    }, { passive: true });
}

// 8. Streaming activity tracker
function onMutationActivity() {
    mutationBurst++;
    if (mutationBurst >= STREAMING_THRESHOLD && !isStreaming) {
        isStreaming = true;
        console.log("▶️ Streaming detected — auto-scroll ON");
    }
    clearTimeout(streamingTimeout);
    streamingTimeout = setTimeout(() => {
        if (isStreaming) {
            console.log("⏹️ Streaming stopped — auto-scroll OFF");
            isStreaming = false;
            userScrolledUp = false;
        }
        mutationBurst = 0;
    }, IDLE_DELAY);
}

// ========================================================
// 9. V17 OMNI-CLICKER (Bypasses all exclusion zones!)
// ========================================================
function scanForPrimaryActions() {
    const docsToScan = [document];
    const iframeDoc = getCascadeIframe();
    if (iframeDoc && iframeDoc !== document) docsToScan.push(iframeDoc);

    let clicked = 0;
    for (const d of docsToScan) {
        const candidates = querySelectorAllShadows('button, .monaco-button, div[role="button"], a.monaco-button', d.body || d);

        for (const btn of candidates) {
            const rawText = btn.textContent || btn.innerText || '';
            const text = rawText.toLowerCase().replace(/\s+/g, '').trim();

            if (!text) continue;

            // Explicitly ignore cancel/reject/deny
            if (text.includes('reject') || text.includes('deny') || text.includes('cancel')) continue;

            // Identify Target Buttons
            let isTarget = false;
            if (text.includes('runalt')) isTarget = true;
            if (text.includes('acceptall')) isTarget = true;
            if (text === 'alwaysallow') isTarget = true;
            if (text === 'run') isTarget = true;
            if (text === 'proceed') isTarget = true;
            if (text === 'accept' || text === 'approve') isTarget = true;
            if (text.includes('runinthisconversation')) isTarget = true;
            if (text.includes('implementplan')) isTarget = true;

            if (isTarget) {
                // If it's disabled or hidden, skip
                if (btn.disabled || btn.classList.contains('disabled') || btn.getAttribute('aria-disabled') === 'true') continue;

                try {
                    const style = window.getComputedStyle(btn);
                    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
                } catch (e) { }

                if (btn.dataset.agPrimaryClicked) continue;
                btn.dataset.agPrimaryClicked = "true";

                console.log(`⚡ V17 OMNI-TRIGGER: [${rawText.trim()}]`);
                btn.style.border = "4px solid orange";

                try { btn.focus(); } catch (e) { }
                btn.click();

                // Backup keyboard trigger
                setTimeout(() => {
                    const options = { bubbles: true, cancelable: true, view: window };
                    const enter = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, ...options };
                    btn.dispatchEvent(new KeyboardEvent('keydown', enter));
                    btn.dispatchEvent(new KeyboardEvent('keyup', enter));
                }, 50);

                // Reset clicked flag after a delay so it can be pressed again later if a new prompt appears
                setTimeout(() => { btn.dataset.agPrimaryClicked = ""; }, 2500);
                clicked++;
            }
        }
    }
    return clicked;
}

// ========================================================
// 10. STUCK-SCROLL DETECTION — "Step Requires Input"
// ========================================================
function checkForStuckState(doc) {
    const bodyText = doc.body ? doc.body.innerText : '';
    const stuckPattern = /\d+\s+steps?\s+requires?\s+input/i;
    const isStuck = stuckPattern.test(bodyText);

    if (isStuck && !stuckDetected) {
        const now = Date.now();
        if (now - lastStuckTime < STUCK_COOLDOWN_MS) return;

        stuckDetected = true;
        lastStuckTime = now;
        console.log("🔍 STUCK DETECTED: 'Step Requires Input' found");

        const clickedBtn = scanForPrimaryActions();

        if (clickedBtn === 0) {
            console.log("⚠️ No action button immediately found — forcing scroll to bottom");
            userScrolledUp = false;
            forceScrollAllContainers(doc);
            setTimeout(() => {
                forceScrollAllContainers(doc);
                scanForPrimaryActions();
            }, 300);
        } else {
            console.log("✅ Button was found and clicked immediately. Resolving stick state.");
            stuckDetected = false;
        }
    } else if (!isStuck && stuckDetected) {
        stuckDetected = false;
    }
}

// ========================================================
// 11. MAIN HANDLER (mutation-driven)
// ========================================================
function handleMutations(doc) {
    onMutationActivity();
    autoScroll(doc);
}

// ========================================================
// 12. SETUP — OBSERVERS + HEARTBEAT
// ========================================================

// 12A. OBSERVE MAIN DOCUMENT
console.log("✅ Attaching Observer to MAIN document...");
setupScrollDetection(document);

window.agObserver2 = new MutationObserver((mutations) => {
    let relevant = false;
    for (const m of mutations) {
        if (m.addedNodes.length > 0 || m.type === 'characterData') {
            relevant = true;
            break;
        }
    }
    if (relevant) handleMutations(document);
});
window.agObserver2.observe(document.body, { childList: true, subtree: true, characterData: true });

// 12B. OBSERVE IFRAME
const frame = document.querySelector('iframe[id*="antigravity"], iframe[src*="antigravity"]');
if (frame) {
    const startIframeObserver = () => {
        try {
            const doc = frame.contentDocument || frame.contentWindow.document;
            console.log("✅ Attaching Observer to IFRAME...");
            setupScrollDetection(doc);

            window.agObserver = new MutationObserver((mutations) => {
                let relevant = false;
                for (const m of mutations) {
                    if (m.addedNodes.length > 0 || m.type === 'characterData') {
                        relevant = true;
                        break;
                    }
                }
                if (relevant) handleMutations(doc);
            });
            window.agObserver.observe(doc.body, { childList: true, subtree: true, characterData: true });

            // Heartbeat
            window.agStuckChecker = setInterval(() => { checkForStuckState(doc); }, HEARTBEAT_INTERVAL);
        } catch (e) { }
    };
    if (frame.contentDocument && frame.contentDocument.readyState === 'complete') startIframeObserver();
    else frame.addEventListener('load', startIframeObserver);
}

// 12C. HEARTBEAT — main document
window.agHeartbeat = setInterval(() => {
    checkForStuckState(document);
}, HEARTBEAT_INTERVAL);

// 12D. OMNI-CLICKER DEDICATED SCANNER
// This single scanner catches Always Allow, Accept All, AND Run/Proceed buttons!
window.agPrimaryScanner = setInterval(() => {
    scanForPrimaryActions();
}, ACTION_BUTTON_SCAN_MS);

// ========================================================
// 13. STARTUP SUMMARY
// ========================================================
console.log("✅ V17.0 Active. Omni-Clicker + Stuck Recovery.");
console.log("📋 Summary:");
console.log("   • 🚨 V17: Omni-Clicker deployed (Bypasses all popup/exclusion zones)");
console.log("   • 🚨 V17: Action Button scanner actively running every 1000ms");
console.log("   • Clicks 'Always Allow', 'Accept all', 'Run Alt+⏎', 'Proceed', 'Accept' instantly");
console.log("   • Heartbeat scanner catches 'Step Requires Input' stuck states");
console.log("   • Force-scrolls ALL scrollable containers when heavily stuck fallback");
console.log("   • Improved scrolling logic with mutation/characterData tracking");
