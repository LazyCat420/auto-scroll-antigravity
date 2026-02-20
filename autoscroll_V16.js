// ANTIGRAVITY AUTOMATOR V16.0 — BUTTON DEBUGGER + ACCEPT-ALL CLEARER + ALWAYS-ALLOW + STUCK RECOVERY
console.log("🚀 Antigravity Automator V16.0 (Dom/Button Debugger) Active");

// 1. CLEANUP
if (window.agAutomator) clearInterval(window.agAutomator);
if (window.agObserver) { window.agObserver.disconnect(); window.agObserver = null; }
if (window.agObserver2) { window.agObserver2.disconnect(); window.agObserver2 = null; }
if (window.agScanner) { window.agScanner.disconnect(); window.agScanner = null; }
if (window.agHeartbeat) { clearInterval(window.agHeartbeat); window.agHeartbeat = null; }
if (window.agStuckChecker) { clearInterval(window.agStuckChecker); window.agStuckChecker = null; }
if (window.agAcceptAllScanner) { clearInterval(window.agAcceptAllScanner); window.agAcceptAllScanner = null; }

// ====== STATE ======
let isStreaming = false;
let mutationBurst = 0;
let streamingTimeout = null;
let userScrolledUp = false;
let scrollUpLogged = false;
let stuckDetected = false;
let stuckCooldown = false;
let lastStuckTime = 0;
const STREAMING_THRESHOLD = 3;
const IDLE_DELAY = 2000;
const STUCK_CHECK_INTERVAL = 2000;
const HEARTBEAT_INTERVAL = 3000;
const STUCK_COOLDOWN_MS = 5000;
const ALWAYS_ALLOW_SCAN_MS = 1500;  // scan for Always Allow every 1.5s
const ACCEPT_ALL_SCAN_MS = 1000;    // scan for Accept All notifications every 1s

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

// 3. Check if ANY popup/typeahead is currently visible
function isPopupOpen(doc) {
    const typeahead = doc.querySelector('#typeahead-menu, .lexical-typeahead-menu');
    if (typeahead) return true;
    const menu = doc.querySelector('.menubar-menu-items-holder, .monaco-menu-container');
    if (menu) return true;
    const popup = doc.querySelector('[role="listbox"], [role="menu"], .suggest-widget, .quick-input-widget');
    if (popup) return true;
    return false;
}

// 4. Check if an element is inside the chat input or a popup
function isInExcludedZone(el) {
    let node = el;
    while (node) {
        if (node.nodeType === 1) {
            const id = (node.id || '').toLowerCase();
            const cls = (node.className && typeof node.className === 'string') ? node.className.toLowerCase() : '';
            const role = (node.getAttribute && node.getAttribute('role')) || '';

            if (id === 'typeahead-menu') return true;
            if (cls.includes('lexical-typeahead-menu')) return true;
            if (cls.includes('menubar-menu-items-holder')) return true;
            if (cls.includes('monaco-menu-container')) return true;
            if (cls.includes('monaco-menu')) return true;
            if (role === 'listbox' || role === 'menu') return true;
            if (cls.includes('suggest-widget') || cls.includes('quick-input')) return true;
            if (cls.includes('lexical-') && (role === 'textbox' || node.contentEditable === 'true')) return true;
            if (node.contentEditable === 'true') return true;
        }
        node = node.parentElement || (node.getRootNode && node.getRootNode() !== node ? node.getRootNode().host : null);
    }
    return false;
}

// 5. Find ALL scrollable containers in a document
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

// 6. Force-scroll ALL scrollable containers to the bottom
function forceScrollAllContainers(doc) {
    const containers = findAllScrollableContainers(doc);
    if (containers.length === 0) return;

    console.log(`🔄 Force-scrolling ${containers.length} scrollable containers`);
    containers.forEach((el, i) => {
        const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        if (distFromBottom > 5) {
            el.scrollTop = el.scrollHeight;
        }
    });
}

// 7. PRECISION Auto-Scroll — scrolls #conversation container
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

// 8. User scroll detection
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

// 9. Streaming activity tracker (ENHANCED — also watches characterData)
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
            scrollUpLogged = false;
        }
        mutationBurst = 0;
    }, IDLE_DELAY);
}

// 10. Keyboard Trigger (for approval buttons only)
function keyboardTrigger(btn) {
    console.log(`⚡ TRIGGER: [${btn.innerText.trim().substring(0, 40)}]`);
    try { btn.focus(); } catch (e) { }
    const options = { bubbles: true, cancelable: true, view: window };
    const enter = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, ...options };
    btn.dispatchEvent(new KeyboardEvent('keydown', enter));
    btn.dispatchEvent(new KeyboardEvent('keypress', enter));
    btn.dispatchEvent(new KeyboardEvent('keyup', enter));
    btn.click();
}

// 11. SCAN for approval buttons (with exclusion zones)
function scanForButtons(doc) {
    if (isPopupOpen(doc)) return;

    const candidates = querySelectorAllShadows('button, .monaco-button, div[role="button"], a.monaco-button', doc.body);
    const getBtnText = (btn) => (btn.textContent || btn.innerText || "").toLowerCase().replace(/\s+/g, '').trim();

    candidates.forEach(btn => {
        if (btn.dataset.agClicked) return;
        if (isInExcludedZone(btn)) return;

        const text = getBtnText(btn);

        // BLOCK — deny/reject/cancel only
        if (text.includes('reject') || text.includes('deny') || text.includes('cancel')) return;

        // TARGETS — specific approval buttons
        let isTarget = false;
        if (text === 'run' || text === 'runalt+' || text.includes('runalt')) isTarget = true;
        if (text.includes('runinthisconversation')) isTarget = true;
        if (text === 'accept' || text === 'approve') isTarget = true;
        if (text.includes('acceptall')) isTarget = true;
        if (text.includes('implementplan') || text === 'proceed') isTarget = true;
        if (text.startsWith('allow')) isTarget = true;

        if (isTarget) {
            btn.dataset.agClicked = "true";
            btn.style.border = "4px solid magenta";
            setTimeout(() => keyboardTrigger(btn), 100);
        }
    });
}

// ========================================================
// 12. V15 — ALWAYS ALLOW AUTO-CLICK (IFRAME-AWARE)
// ========================================================
function getCascadeIframe() {
    // The "Always Allow" button lives inside the cascade-panel iframe
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
        try {
            const src = iframe.src || '';
            if (src.includes('cascade-panel') || src.includes('antigravity')) {
                const doc = iframe.contentDocument || iframe.contentWindow.document;
                if (doc && doc.body) return doc;
            }
        } catch (e) {
            // Cross-origin, skip
        }
    }
    // Fallback: try first accessible iframe
    for (const iframe of iframes) {
        try {
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            if (doc && doc.body) return doc;
        } catch (e) { /* skip */ }
    }
    return null;
}

function clickAlwaysAllowInIframe() {
    const iframeDoc = getCascadeIframe();
    if (!iframeDoc) return false;

    const buttons = iframeDoc.querySelectorAll('button');
    for (const btn of buttons) {
        const text = (btn.textContent || '').trim();
        if (text === 'Always Allow') {
            // Don't re-click if we already clicked this exact button instance
            if (btn.dataset.agAlwaysAllowClicked) continue;

            btn.dataset.agAlwaysAllowClicked = "true";
            console.log("🔓 ALWAYS ALLOW found in iframe — clicking!");
            btn.style.border = "4px solid lime";

            // Use both click strategies for reliability
            try { btn.focus(); } catch (e) { }
            btn.click();

            // Also dispatch keyboard events as backup
            setTimeout(() => {
                const options = { bubbles: true, cancelable: true, view: window };
                const enter = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, ...options };
                btn.dispatchEvent(new KeyboardEvent('keydown', enter));
                btn.dispatchEvent(new KeyboardEvent('keyup', enter));
            }, 50);

            return true;
        }
    }
    return false;
}

// Also scan for Always Allow in the main document (fallback)
function clickAlwaysAllowInDocument(doc) {
    const buttons = doc.querySelectorAll('button');
    for (const btn of buttons) {
        const text = (btn.textContent || '').trim();
        if (text === 'Always Allow') {
            if (btn.dataset.agAlwaysAllowClicked) continue;

            btn.dataset.agAlwaysAllowClicked = "true";
            console.log("🔓 ALWAYS ALLOW found in main doc — clicking!");
            btn.style.border = "4px solid lime";
            try { btn.focus(); } catch (e) { }
            btn.click();
            return true;
        }
    }
    return false;
}

// ========================================================
// 13B. V15.1 — ACCEPT ALL NOTIFICATION CLEARER
//   These are file-change notification bars ("1 File With Changes... Accept all")
//   that stack between chat and input box, blocking scroll.
//   This scanner BYPASSES isInExcludedZone to ensure they always get clicked.
// ========================================================
function clearAcceptAllNotifications(doc) {
    const docsToScan = [doc];
    const iframeDoc = getCascadeIframe();
    if (iframeDoc && iframeDoc !== doc) docsToScan.push(iframeDoc);

    let cleared = 0;
    for (const d of docsToScan) {
        const buttons = d.querySelectorAll('button');
        for (const btn of buttons) {
            const text = (btn.textContent || '').trim();
            // Match "Accept all" / "Accept All" — the file-change notification button
            if (/^Accept\s+all$/i.test(text)) {
                if (btn.dataset.agAcceptAllClicked) continue;
                btn.dataset.agAcceptAllClicked = "true";
                console.log(`🗑️ Accept All notification cleared: [${text}]`);
                btn.style.border = "4px solid cyan";
                try { btn.focus(); } catch (e) { }
                btn.click();
                // Backup: keyboard trigger
                setTimeout(() => {
                    const options = { bubbles: true, cancelable: true, view: window };
                    const enter = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, ...options };
                    btn.dispatchEvent(new KeyboardEvent('keydown', enter));
                    btn.dispatchEvent(new KeyboardEvent('keyup', enter));
                }, 50);
                cleared++;
            }
        }
    }
    return cleared;
}

// ========================================================
// 1X. V16 DEBUGGER LOGIC
// ========================================================
function logAllButtons(doc, contextName) {
    if (!doc) return;
    try {
        console.log(`\n--- 🔍 V16 DEBUG: ALL BUTTONS IN [${contextName}] ---`);
        const buttons1 = Array.from(doc.querySelectorAll('button'));
        const buttons2 = querySelectorAllShadows('button, .monaco-button, div[role="button"], a.monaco-button', doc.body || doc);

        // Use Set to deduplicate
        const uniqueButtons = Array.from(new Set([...buttons1, ...buttons2]));
        console.log(`Total interactive elements found: ${uniqueButtons.length}`);

        uniqueButtons.forEach((btn, i) => {
            const text = (btn.textContent || btn.innerText || '').trim().replace(/\n/g, '\\n').substring(0, 60);
            const classes = typeof btn.className === 'string' ? btn.className : '';
            const ariaLabel = btn.getAttribute('aria-label') || '';
            const role = btn.getAttribute('role') || '';
            const title = btn.getAttribute('title') || '';

            // Checking basic geometry to verify if it's rendered/visible
            const isVisible = btn.offsetWidth > 0 || btn.offsetHeight > 0;
            const textDisplay = text ? `"${text}"` : (ariaLabel ? `[Aria: ${ariaLabel}]` : (title ? `[Title: ${title}]` : '[No Text]'));

            console.log(`[${i}] Text: ${textDisplay} | Visible: ${isVisible} | Tag: ${btn.tagName} | Classes: "${classes}" | Role: "${role}"`);
        });
        console.log(`------------------------------------------\n`);
    } catch (e) {
        console.log(`⚠️ Error logging buttons in ${contextName}: `, e);
    }
}

// ========================================================
// 13. STUCK-SCROLL DETECTION — "Step Requires Input"
// ========================================================
function checkForStuckState(doc) {
    const bodyText = doc.body ? doc.body.innerText : '';

    const stuckPattern = /\d+\s+steps?\s+requires?\s+input/i;
    const isStuck = stuckPattern.test(bodyText);

    if (isStuck && !stuckDetected) {
        const now = Date.now();
        if (now - lastStuckTime < STUCK_COOLDOWN_MS) {
            return;
        }

        stuckDetected = true;
        lastStuckTime = now;
        console.log("🔍 STUCK DETECTED: 'Step Requires Input' found");

        // --- V16: DEBUG LOG ALL BUTTONS WHEN STUCK ---
        console.log("🚨 V16 DEBUG: Dumping ALL interactive elements to console to find the blocking prompt... 🚨");
        logAllButtons(doc, "MAIN DOCUMENT");

        const iframeDoc = getCascadeIframe();
        if (iframeDoc) {
            logAllButtons(iframeDoc, "CASCADE IFRAME");
        } else {
            console.log("⚠️ No accessible iframe found for button dump.");
        }
        // ---------------------------------------------

        // V15: First try to click "Always Allow" in the iframe
        console.log("🔍 Searching for 'Always Allow' button in iframe...");
        const clickedIframe = clickAlwaysAllowInIframe();

        if (!clickedIframe) {
            console.log("🔍 Not found in iframe, checking main document...");
            const clickedMain = clickAlwaysAllowInDocument(doc);

            if (!clickedMain) {
                console.log("⚠️ 'Always Allow' button not found — falling back to force-scroll");
                // Original V14 behavior: force scroll everything down
                userScrolledUp = false;
                forceScrollAllContainers(doc);
                setTimeout(() => {
                    scanForButtons(doc);
                    forceScrollAllContainers(doc);
                    // Try Always Allow again after scroll
                    setTimeout(() => {
                        clickAlwaysAllowInIframe();
                        clickAlwaysAllowInDocument(doc);
                        scanForButtons(doc);
                    }, 500);
                }, 300);
            }
        }

    } else if (!isStuck && stuckDetected) {
        stuckDetected = false;
        console.log("✅ Stuck state resolved — resuming normal operation");
    }
}

// ========================================================
// 14. HEARTBEAT SCANNER — safety net for missed events
// ========================================================
function heartbeatScan(doc) {
    // 0. V15.1: Always clear Accept All notifications first
    clearAcceptAllNotifications(doc);

    // 1. Check for stuck state (includes Always Allow clicking)
    checkForStuckState(doc);

    // 2. If stuck, keep trying to click Always Allow + force-scroll
    if (stuckDetected) {
        clickAlwaysAllowInIframe();
        clickAlwaysAllowInDocument(doc);
        forceScrollAllContainers(doc);
        scanForButtons(doc);
    }

    // 3. Even when not stuck, ensure we haven't missed any buttons
    if (!isPopupOpen(doc)) {
        scanForButtons(doc);
    }
}

// 15. MAIN HANDLER (mutation-driven)
function handleMutations(doc) {
    onMutationActivity();
    clearAcceptAllNotifications(doc);  // V15.1: clear stacked notifications BEFORE scrolling
    autoScroll(doc);
    scanForButtons(doc);
}

// ========================================================
// 16. SETUP — OBSERVERS + HEARTBEAT
// ========================================================

// 16A. OBSERVE MAIN DOCUMENT
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
window.agObserver2.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
});

// 16B. OBSERVE IFRAME
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
            window.agObserver.observe(doc.body, {
                childList: true,
                subtree: true,
                characterData: true
            });

            // Start heartbeat for iframe too
            window.agStuckChecker = setInterval(() => {
                heartbeatScan(doc);
            }, HEARTBEAT_INTERVAL);

        } catch (e) {
            console.error("❌ Iframe access error:", e);
        }
    };
    if (frame.contentDocument && frame.contentDocument.readyState === 'complete') startIframeObserver();
    else frame.addEventListener('load', startIframeObserver);
} else {
    console.log("⚠️ Iframe not found (will catch via main observer + heartbeat).");
}

// 16C. HEARTBEAT — main document (always active)
window.agHeartbeat = setInterval(() => {
    heartbeatScan(document);
}, HEARTBEAT_INTERVAL);

// 16D. V15: DEDICATED ALWAYS-ALLOW SCANNER
// This runs independently to catch Always Allow buttons even outside stuck state
window.agAlwaysAllowScanner = setInterval(() => {
    // Check both iframe and main document for any Always Allow buttons
    const iframeDoc = getCascadeIframe();
    if (iframeDoc) {
        const buttons = iframeDoc.querySelectorAll('button');
        for (const btn of buttons) {
            const text = (btn.textContent || '').trim();
            if (text === 'Always Allow' && !btn.dataset.agAlwaysAllowClicked) {
                btn.dataset.agAlwaysAllowClicked = "true";
                console.log("🔓 [SCANNER] Always Allow detected — auto-clicking!");
                btn.style.border = "4px solid lime";
                try { btn.focus(); } catch (e) { }
                btn.click();
            }
        }
    }
}, ALWAYS_ALLOW_SCAN_MS);

// 16E. V15.1: DEDICATED ACCEPT ALL SCANNER
// Runs independently to catch file-change notification "Accept all" buttons
window.agAcceptAllScanner = setInterval(() => {
    clearAcceptAllNotifications(document);
}, ACCEPT_ALL_SCAN_MS);

// ========================================================
// 17. STARTUP SUMMARY
// ========================================================
console.log("✅ V16.0 Active. Button Debugger + Accept-All clearer + Always-Allow auto-click + stuck recovery.");
console.log("📋 Summary:");
console.log("   • 🚨 V16 DEBUG: Automatically logs all interactive elements in DOM & iframes when stuck");
console.log("   • 🆕 V15.1: Auto-clicks 'Accept all' file-change notifications (bypasses exclusion zones)");
console.log("   • 🆕 V15.1: Dedicated Accept All scanner every 1s");
console.log("   • Auto-clicks 'Always Allow' button in cascade-panel iframe");
console.log("   • Dedicated Always-Allow scanner every 1.5s");
console.log("   • Auto-scroll targets #conversation container (normal mode)");
console.log("   • Detects 'Step Requires Input' stuck state every 3s");
console.log("   • Force-scrolls ALL scrollable containers when stuck");
console.log("   • Heartbeat scanner catches missed buttons");
console.log("   • Scroll pauses if popup (#typeahead-menu) is open");
console.log("   • Scroll pauses on user scroll-up, resumes at bottom");
console.log("   • Button scan skips lexical-typeahead-menu & contentEditable zones");
