// ANTIGRAVITY AUTOMATOR V17.3 — SCROLL-FIRST + RIGHT-BUTTON ONLY + USER SCROLL RESPECT
console.log("🚀 Antigravity Automator V17.3 (User-Scroll Aware) Active");

// 1. CLEANUP
if (window.agAutomator) clearInterval(window.agAutomator);
if (window.agObserver) { window.agObserver.disconnect(); window.agObserver = null; }
if (window.agObserver2) { window.agObserver2.disconnect(); window.agObserver2 = null; }
if (window.agScanner) { window.agScanner.disconnect(); window.agScanner = null; }
if (window.agHeartbeat) { clearInterval(window.agHeartbeat); window.agHeartbeat = null; }
if (window.agStuckChecker) { clearInterval(window.agStuckChecker); window.agStuckChecker = null; }
if (window.agPrimaryScanner) { clearInterval(window.agPrimaryScanner); window.agPrimaryScanner = null; }

// ====== STATE ======
let isStreaming = false;
let mutationBurst = 0;
let streamingTimeout = null;
let userScrolledUp = false;
let stuckDetected = false;
let lastStuckTime = 0;
let debugScanCount = 0;
const STREAMING_THRESHOLD = 3;
const IDLE_DELAY = 2000;
const HEARTBEAT_INTERVAL = 3000;
const STUCK_COOLDOWN_MS = 5000;
const ACTION_BUTTON_SCAN_MS = 800;
const DEBUG_LOG_EVERY_N = 10;

// ========================================================
// 2. UTILITIES
// ========================================================
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

// ========================================================
// 3. SCROLLING LOGIC
// ========================================================
function findAllScrollableContainers(doc) {
    const containers = [];
    doc.querySelectorAll('div').forEach(el => {
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

// Returns true if ALL scrollable containers are at the bottom
function isFullyScrolledToBottom(doc) {
    const containers = findAllScrollableContainers(doc);
    if (containers.length === 0) return true;
    for (const el of containers) {
        const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        if (distFromBottom > 15) return false;
    }
    return true;
}

function forceScrollAllContainers(doc) {
    const containers = findAllScrollableContainers(doc);
    let scrolled = 0;
    containers.forEach(el => {
        const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        if (distFromBottom > 5) {
            el.scrollTop = el.scrollHeight;
            scrolled++;
        }
    });
    return scrolled;
}

function isPopupOpen(doc) {
    if (doc.querySelector('#typeahead-menu, .lexical-typeahead-menu')) return true;
    if (doc.querySelector('.menubar-menu-items-holder, .monaco-menu-container')) return true;
    if (doc.querySelector('[role="listbox"], [role="menu"], .suggest-widget, .quick-input-widget')) return true;
    return false;
}

function findScrollableParent(el) {
    let node = el;
    while (node) {
        if (node.scrollHeight > node.clientHeight && node.clientHeight > 50) {
            const style = window.getComputedStyle(node);
            const ov = style.overflowY;
            if (ov === 'scroll' || ov === 'auto') return node;
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
    if (scrollTarget) scrollTarget.scrollTop = scrollTarget.scrollHeight;
}

// ========================================================
// 4. USER SCROLL DETECTION
// ========================================================
function setupScrollDetection(doc) {
    doc.addEventListener('wheel', (e) => {
        if (e.deltaY < 0) {
            if (!userScrolledUp) {
                userScrolledUp = true;
                console.log("⏸️ User scrolled up — auto-scroll paused");
            }
        } else if (e.deltaY > 0) {
            const convo = doc.getElementById('conversation');
            if (convo) {
                const scrollParent = findScrollableParent(convo);
                if (scrollParent) {
                    const dist = scrollParent.scrollHeight - scrollParent.scrollTop - scrollParent.clientHeight;
                    if (dist < 100 && userScrolledUp) {
                        userScrolledUp = false;
                        console.log("▶️ User scrolled to bottom — auto-scroll resumed");
                    }
                }
            }
        }
    }, { passive: true });
}

// ========================================================
// 5. STREAMING ACTIVITY TRACKER
// ========================================================
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
            // NOTE: Do NOT reset userScrolledUp here!
            // If the user scrolled up, that preference should persist until
            // they manually scroll back to the bottom.
        }
        mutationBurst = 0;
    }, IDLE_DELAY);
}

// ========================================================
// 6. V17.2 BUTTON CLASSIFIER
//    RIGHT-SIDE PRIMARY BUTTONS ONLY!
//    Layout is always:  [Always run ∨]  [Reject]  [Run Alt+⏎]
//                       [Always run ∨]  [Deny]    [Allow A...]
//    LEFT dropdown = NEVER click
//    RIGHT primary = ALWAYS click
// ========================================================

// BLOCKLIST: these are left-side dropdowns or destructive buttons — NEVER click
function isBlockedButton(text) {
    if (text.includes('reject')) return true;
    if (text.includes('deny')) return true;
    if (text.includes('cancel')) return true;
    if (text === 'alwaysrun') return true;         // LEFT-side dropdown toggle
    if (text === 'alwaysallow') return true;        // LEFT-side dropdown toggle (if it appears)
    if (text.startsWith('always')) return true;      // catch-all for ANY "Always ..." left-side toggle
    if (text === 'review') return true;              // user's own review button
    if (text === 'submit') return true;              // user's own submit button
    return false;
}

// TARGETLIST: these are RIGHT-side primary action buttons — CLICK THESE
function isRightSideAction(text) {
    // Run buttons (the primary action)
    if (text === 'run') return 'run';
    if (text.includes('runalt')) return 'runalt';                    // "RunAlt+⏎"
    if (text.includes('runinthisconversation')) return 'run-in-conv';

    // Allow/permission buttons (RIGHT side of permission prompt)
    if (text.startsWith('allow')) return 'allow';                   // "Allow", "Allow All", "Allow A..."

    // Accept buttons
    if (text === 'accept') return 'accept';
    if (text === 'approve') return 'approve';
    if (text.includes('acceptall')) return 'accept-all';            // file-change "Accept all"

    // Proceed/plan buttons
    if (text === 'proceed') return 'proceed';
    if (text.includes('implementplan')) return 'implement-plan';

    return null;
}

// ========================================================
// 7. V17.3 OMNI-CLICKER — RESPECTS USER SCROLL
//    ONLY force-scrolls when: streaming is active OR stuck state
//    When idle + user scrolled up → just scan buttons, no scroll
// ========================================================
function scanForPrimaryActions() {
    const docsToScan = [document];
    const iframeDoc = getCascadeIframe();
    if (iframeDoc && iframeDoc !== document) docsToScan.push(iframeDoc);

    let clicked = 0;
    debugScanCount++;
    const doDebug = (debugScanCount % DEBUG_LOG_EVERY_N === 0);

    // Should we force-scroll? Only when streaming or stuck — never when user scrolled up while idle
    const shouldForceScroll = (isStreaming || stuckDetected) && !userScrolledUp;

    if (doDebug) {
        console.log(`\n--- 🔎 V17.3 SCAN #${debugScanCount} | streaming:${isStreaming} | stuck:${stuckDetected} | userScrolledUp:${userScrolledUp} | forceScroll:${shouldForceScroll} ---`);
    }

    for (const d of docsToScan) {
        const docLabel = (d === document) ? 'MAIN' : 'IFRAME';

        // STEP 1: SCROLL — but ONLY when streaming/stuck and user hasn't scrolled up
        if (shouldForceScroll) {
            const wasAtBottom = isFullyScrolledToBottom(d);
            if (!wasAtBottom) {
                const scrolled = forceScrollAllContainers(d);
                if (doDebug) console.log(`[${docLabel}] ⬇️ Scrolled ${scrolled} containers to bottom`);
            }
        }

        // STEP 2: ALWAYS scan for right-side action buttons (even without scrolling)
        const candidates = querySelectorAllShadows('button, .monaco-button, div[role="button"], a.monaco-button', d.body || d);

        if (doDebug) console.log(`[${docLabel}] Scanning ${candidates.length} elements`);

        for (const btn of candidates) {
            const rawText = (btn.textContent || btn.innerText || '').trim();
            const text = rawText.toLowerCase().replace(/\s+/g, '').trim();

            if (!text) continue;

            // Check blocklist FIRST
            if (isBlockedButton(text)) {
                if (doDebug && rawText.length < 40) console.log(`  🚫 BLOCKED: "${rawText}"`);
                continue;
            }

            // Check if it's a right-side action button
            const matchRule = isRightSideAction(text);

            if (doDebug && rawText.length > 0 && rawText.length < 50) {
                const status = matchRule ? `✅ MATCH [${matchRule}]` : '⬜ skip';
                console.log(`  ${status}: "${rawText}"`);
            }

            if (matchRule) {
                // Skip disabled/hidden buttons
                if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') continue;
                try {
                    const style = window.getComputedStyle(btn);
                    if (style.display === 'none' || style.visibility === 'hidden') continue;
                    if (style.pointerEvents === 'none' || style.opacity === '0') continue;
                } catch (e) { }

                // Skip already-clicked (short cooldown prevents double-fire)
                if (btn.dataset.agOmniClicked) continue;
                btn.dataset.agOmniClicked = "true";

                console.log(`⚡ V17.3 CLICK [${matchRule}]: "${rawText}"`);
                btn.style.outline = "3px solid orange";

                try { btn.focus(); } catch (e) { }
                btn.click();

                // Backup: keyboard Enter
                setTimeout(() => {
                    const options = { bubbles: true, cancelable: true, view: window };
                    const enter = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, ...options };
                    btn.dispatchEvent(new KeyboardEvent('keydown', enter));
                    btn.dispatchEvent(new KeyboardEvent('keyup', enter));
                }, 50);

                // Reset after cooldown so new instances can be clicked
                setTimeout(() => { btn.dataset.agOmniClicked = ""; }, 2500);
                clicked++;
            }
        }
    }

    if (doDebug) console.log(`--- End scan (clicked: ${clicked}) ---\n`);
    return clicked;
}

// ========================================================
// 8. STUCK-SCROLL DETECTION — "Step Requires Input"
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
        console.log("🔍 STUCK DETECTED — scrolling to bottom then clicking action button");

        userScrolledUp = false;
        // Force scroll first
        forceScrollAllContainers(doc);
        // Then try to click after scroll settles
        setTimeout(() => {
            forceScrollAllContainers(doc);
            scanForPrimaryActions();
        }, 400);
    } else if (!isStuck && stuckDetected) {
        stuckDetected = false;
        console.log("✅ Stuck state resolved");
    }
}

// ========================================================
// 9. MAIN HANDLER (mutation-driven)
// ========================================================
function handleMutations(doc) {
    onMutationActivity();
    autoScroll(doc);
}

// ========================================================
// 10. SETUP — OBSERVERS + HEARTBEAT
// ========================================================

// 10A. OBSERVE MAIN DOCUMENT
console.log("✅ Attaching Observer to MAIN document...");
setupScrollDetection(document);

window.agObserver2 = new MutationObserver((mutations) => {
    let relevant = false;
    for (const m of mutations) {
        if (m.addedNodes.length > 0 || m.type === 'characterData') { relevant = true; break; }
    }
    if (relevant) handleMutations(document);
});
window.agObserver2.observe(document.body, { childList: true, subtree: true, characterData: true });

// 10B. OBSERVE IFRAME
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
                    if (m.addedNodes.length > 0 || m.type === 'characterData') { relevant = true; break; }
                }
                if (relevant) handleMutations(doc);
            });
            window.agObserver.observe(doc.body, { childList: true, subtree: true, characterData: true });
            window.agStuckChecker = setInterval(() => { checkForStuckState(doc); }, HEARTBEAT_INTERVAL);
        } catch (e) { console.error("❌ Iframe error:", e); }
    };
    if (frame.contentDocument && frame.contentDocument.readyState === 'complete') startIframeObserver();
    else frame.addEventListener('load', startIframeObserver);
} else {
    console.log("⚠️ Iframe not found (will catch via main observer + heartbeat).");
}

// 10C. HEARTBEAT — main document
window.agHeartbeat = setInterval(() => { checkForStuckState(document); }, HEARTBEAT_INTERVAL);

// 10D. OMNI-CLICKER SCANNER (scroll-first, then click right-side buttons)
window.agPrimaryScanner = setInterval(() => { scanForPrimaryActions(); }, ACTION_BUTTON_SCAN_MS);

// ========================================================
// 11. STARTUP SUMMARY
// ========================================================
console.log("✅ V17.3 Active. User-Scroll Aware + Right-Button Only.");
console.log("📋 Scroll Rules:");
console.log("   • Auto-scroll ONLY when streaming or stuck (never fights user scroll)");
console.log("   • User scrolls up → auto-scroll pauses, user is in control");
console.log("   • User scrolls back to bottom → auto-scroll resumes");
console.log("   • Streaming stops → scroll stays where user left it");
console.log("📋 Button Actions:");
console.log("   ✅ Clicks: Run, RunAlt+⏎, Allow*, Accept all, Proceed, Approve");
console.log("   🚫 NEVER: Always run, Always allow, Reject, Deny, Cancel");
console.log("📋 Debug log every ~8s — watch for streaming/stuck/userScrolledUp state");
