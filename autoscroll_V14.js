// ANTIGRAVITY AUTOMATOR V14.0 — STUCK-SCROLL RECOVERY + FORCE-ALL
console.log("🚀 Antigravity Automator V14.0 (Stuck-Scroll Recovery) Active");

// 1. CLEANUP
if (window.agAutomator) clearInterval(window.agAutomator);
if (window.agObserver) { window.agObserver.disconnect(); window.agObserver = null; }
if (window.agObserver2) { window.agObserver2.disconnect(); window.agObserver2 = null; }
if (window.agScanner) { window.agScanner.disconnect(); window.agScanner = null; }
if (window.agHeartbeat) { clearInterval(window.agHeartbeat); window.agHeartbeat = null; }
if (window.agStuckChecker) { clearInterval(window.agStuckChecker); window.agStuckChecker = null; }

// ====== STATE ======
let isStreaming = false;
let mutationBurst = 0;
let streamingTimeout = null;
let userScrolledUp = false;
let scrollUpLogged = false;
let stuckDetected = false;
let stuckCooldown = false;          // prevents rapid re-triggers
let lastStuckTime = 0;
const STREAMING_THRESHOLD = 3;
const IDLE_DELAY = 2000;
const STUCK_CHECK_INTERVAL = 2000;  // check for stuck state every 2s
const HEARTBEAT_INTERVAL = 3000;    // safety-net scan every 3s
const STUCK_COOLDOWN_MS = 5000;     // cooldown between stuck recoveries

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

        // BLOCK
        if (text.startsWith('always')) return;
        if (text.includes('reject') || text.includes('deny') || text.includes('cancel')) return;

        // TARGETS — only specific approval buttons
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
// 12. STUCK-SCROLL DETECTION — "Step Requires Input"
// ========================================================
function checkForStuckState(doc) {
    // Search the visible text for "Step Requires Input" (case-insensitive)
    // This text appears when the agent is waiting for a button click
    const bodyText = doc.body ? doc.body.innerText : '';

    // Match patterns like "1 Step Requires Input", "2 Steps Require Input", etc.
    const stuckPattern = /\d+\s+steps?\s+requires?\s+input/i;
    const isStuck = stuckPattern.test(bodyText);

    if (isStuck && !stuckDetected) {
        const now = Date.now();
        if (now - lastStuckTime < STUCK_COOLDOWN_MS) {
            return; // Still in cooldown from last recovery
        }

        stuckDetected = true;
        lastStuckTime = now;
        console.log("🔍 STUCK DETECTED: 'Step Requires Input' found — forcing all scrollers to bottom");

        // Override user scroll-up during stuck recovery
        userScrolledUp = false;

        // Force ALL scrollable containers to the bottom
        forceScrollAllContainers(doc);

        // After scrolling, scan for buttons that should now be visible
        setTimeout(() => {
            scanForButtons(doc);
            // Do a second force-scroll in case DOM reflow revealed new containers
            forceScrollAllContainers(doc);
            setTimeout(() => scanForButtons(doc), 500);
        }, 300);

    } else if (!isStuck && stuckDetected) {
        // The stuck state resolved (button was clicked, step is running)
        stuckDetected = false;
        console.log("✅ Stuck state resolved — resuming normal operation");
    }
}

// ========================================================
// 13. HEARTBEAT SCANNER — safety net for missed events
// ========================================================
function heartbeatScan(doc) {
    // 1. Check for stuck state
    checkForStuckState(doc);

    // 2. If stuck, keep force-scrolling until resolved
    if (stuckDetected) {
        forceScrollAllContainers(doc);
        scanForButtons(doc);
    }

    // 3. Even when not stuck, ensure we haven't missed any buttons
    //    (light scan — only if no popup is open)
    if (!isPopupOpen(doc)) {
        scanForButtons(doc);
    }
}

// 14. MAIN HANDLER (mutation-driven)
function handleMutations(doc) {
    onMutationActivity();
    autoScroll(doc);
    scanForButtons(doc);
}

// ========================================================
// 15. SETUP — OBSERVERS + HEARTBEAT
// ========================================================

// 15A. OBSERVE MAIN DOCUMENT
console.log("✅ Attaching Observer to MAIN document...");
setupScrollDetection(document);

window.agObserver2 = new MutationObserver((mutations) => {
    let relevant = false;
    for (const m of mutations) {
        // ENHANCED: also detect characterData changes (text updates without new nodes)
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
    characterData: true   // NEW: catch text-only streaming updates
});

// 15B. OBSERVE IFRAME
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

// 15C. HEARTBEAT — main document (always active)
window.agHeartbeat = setInterval(() => {
    heartbeatScan(document);
}, HEARTBEAT_INTERVAL);

// ========================================================
// 16. STARTUP SUMMARY
// ========================================================
console.log("✅ V14.0 Active. Stuck-scroll recovery + force-all-containers.");
console.log("📋 Summary:");
console.log("   • Auto-scroll targets #conversation container (normal mode)");
console.log("   • 🆕 Detects 'Step Requires Input' stuck state every 3s");
console.log("   • 🆕 Force-scrolls ALL scrollable containers when stuck");
console.log("   • 🆕 Heartbeat scanner catches missed buttons");
console.log("   • 🆕 Enhanced mutation detection (characterData)");
console.log("   • Scroll pauses if popup (#typeahead-menu) is open");
console.log("   • Scroll pauses on user scroll-up, resumes at bottom");
console.log("   • Button scan skips lexical-typeahead-menu & contentEditable zones");
