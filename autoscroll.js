// ANTIGRAVITY AUTOMATOR V13.0 — PRECISION SCROLL + POPUP SAFE
console.log("🚀 Antigravity Automator V13.0 (Precision Build) Active");

// 1. CLEANUP
if (window.agAutomator) clearInterval(window.agAutomator);
if (window.agObserver) { window.agObserver.disconnect(); window.agObserver = null; }
if (window.agObserver2) { window.agObserver2.disconnect(); window.agObserver2 = null; }
if (window.agScanner) { window.agScanner.disconnect(); window.agScanner = null; }

// ====== STATE ======
let isStreaming = false;
let mutationBurst = 0;
let streamingTimeout = null;
let userScrolledUp = false;
let scrollUpLogged = false;        // prevents console spam
const STREAMING_THRESHOLD = 3;
const IDLE_DELAY = 2000;

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
    // The exact elements from the DOM scan
    const typeahead = doc.querySelector('#typeahead-menu, .lexical-typeahead-menu');
    if (typeahead) return true;
    // Also check for VS Code menus
    const menu = doc.querySelector('.menubar-menu-items-holder, .monaco-menu-container');
    if (menu) return true;
    // Generic popups
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

            // Typeahead / @ mention popup (EXACT match from scan)
            if (id === 'typeahead-menu') return true;
            if (cls.includes('lexical-typeahead-menu')) return true;

            // VS Code menus
            if (cls.includes('menubar-menu-items-holder')) return true;
            if (cls.includes('monaco-menu-container')) return true;
            if (cls.includes('monaco-menu')) return true;

            // Generic popups
            if (role === 'listbox' || role === 'menu') return true;
            if (cls.includes('suggest-widget') || cls.includes('quick-input')) return true;

            // Chat input area (Lexical editor)
            if (cls.includes('lexical-') && (role === 'textbox' || node.contentEditable === 'true')) return true;
            if (node.contentEditable === 'true') return true;
        }
        // Walk up through shadow DOM boundaries too
        node = node.parentElement || (node.getRootNode && node.getRootNode() !== node ? node.getRootNode().host : null);
    }
    return false;
}

// 5. PRECISION Auto-Scroll — only scrolls #conversation container
function autoScroll(doc) {
    // GUARD 1: Only scroll when streaming
    if (!isStreaming) return;
    // GUARD 2: Respect user scroll-up
    if (userScrolledUp) return;
    // GUARD 3: Don't scroll if a popup is open (would kill @ menu)
    if (isPopupOpen(doc)) return;

    // Find the conversation scroll container
    // From scan: id="conversation" has class "overflow-y-hidden overflow-x-clip"
    // Its scrollable PARENT is what we need
    const convo = doc.getElementById('conversation');
    if (!convo) {
        // Fallback: find the deepest scrollable container inside #chat
        const chat = doc.getElementById('chat');
        if (chat) {
            scrollDeepestContainer(chat);
        }
        return;
    }

    // Walk UP from #conversation to find the actual scrollable parent
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
    // Fallback: scroll the deepest scrollable child in the chat
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

// 6. User scroll detection
function setupScrollDetection(doc) {
    doc.addEventListener('wheel', (e) => {
        if (e.deltaY < 0) {
            // User scrolled UP
            if (!userScrolledUp) {
                userScrolledUp = true;
                console.log("⏸️ User scrolled up — auto-scroll paused until streaming restarts");
            }
        } else if (e.deltaY > 0) {
            // User scrolled DOWN — check if they're near the bottom
            // If so, re-enable auto-scroll
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

// 7. Streaming activity tracker
function onMutationActivity() {
    mutationBurst++;

    if (mutationBurst >= STREAMING_THRESHOLD && !isStreaming) {
        isStreaming = true;
        // NOTE: we do NOT reset userScrolledUp here anymore!
        // It only resets when user scrolls back to the bottom
        console.log("▶️ Streaming detected — auto-scroll ON");
    }

    clearTimeout(streamingTimeout);
    streamingTimeout = setTimeout(() => {
        if (isStreaming) {
            console.log("⏹️ Streaming stopped — auto-scroll OFF");
            isStreaming = false;
            // Reset userScrolledUp when streaming ends so next conversation starts fresh
            userScrolledUp = false;
            scrollUpLogged = false;
        }
        mutationBurst = 0;
    }, IDLE_DELAY);
}

// 8. Keyboard Trigger (for approval buttons only)
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

// 9. SCAN for approval buttons (with exclusion zones)
function scanForButtons(doc) {
    // Don't scan at all if a popup is open
    if (isPopupOpen(doc)) return;

    const candidates = querySelectorAllShadows('button, .monaco-button, div[role="button"], a.monaco-button', doc.body);
    const getBtnText = (btn) => (btn.textContent || btn.innerText || "").toLowerCase().replace(/\s+/g, '').trim();

    candidates.forEach(btn => {
        if (btn.dataset.agClicked) return;

        // Skip anything inside popups, menus, chat input
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

// 10. MAIN HANDLER
function handleMutations(doc) {
    onMutationActivity();
    autoScroll(doc);
    scanForButtons(doc);
}

// 11A. OBSERVE MAIN DOCUMENT
console.log("✅ Attaching Observer to MAIN document...");
setupScrollDetection(document);

window.agObserver2 = new MutationObserver((mutations) => {
    let relevant = false;
    for (const m of mutations) {
        if (m.addedNodes.length > 0) { relevant = true; break; }
    }
    if (relevant) handleMutations(document);
});
window.agObserver2.observe(document.body, { childList: true, subtree: true });

// 11B. OBSERVE IFRAME
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
                    if (m.addedNodes.length > 0) { relevant = true; break; }
                }
                if (relevant) handleMutations(doc);
            });
            window.agObserver.observe(doc.body, { childList: true, subtree: true });
        } catch (e) {
            console.error("❌ Iframe access error:", e);
        }
    };
    if (frame.contentDocument && frame.contentDocument.readyState === 'complete') startIframeObserver();
    else frame.addEventListener('load', startIframeObserver);
} else {
    console.log("⚠️ Iframe not found (will catch via main observer).");
}

console.log("✅ V13.0 Active. Precision scroll + popup-safe.");
console.log("📋 Summary:");
console.log("   • Auto-scroll targets ONLY #conversation container");
console.log("   • Scroll pauses if popup (#typeahead-menu) is open");
console.log("   • Scroll pauses on user scroll-up, resumes at bottom");
console.log("   • Button scan skips lexical-typeahead-menu & contentEditable zones");