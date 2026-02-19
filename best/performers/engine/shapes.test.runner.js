/**
 * @file Node.js test runner for ShapeEngine tests.
 * @description Runs the ShapeEngine tests in a simulated browser environment.
 * Usage: node shapes.test.runner.js
 */

const vm = require('vm');
const fs = require('fs');
const path = require('path');

// Read source files
const shapesCode = fs.readFileSync(path.join(__dirname, 'shapes.js'), 'utf8');
const testCode = fs.readFileSync(path.join(__dirname, 'shapes.test.js'), 'utf8');

// Mock DOM APIs
function createMockElement(tag = 'div') {
    const children = [];
    const classList = new Set();
    const dataset = {};
    const style = {};
    const attrs = {};
    const eventListeners = {};

    const element = {
        tagName: tag.toUpperCase(),
        style,
        dataset,
        children,
        childNodes: children,
        className: '',
        innerHTML: '',
        textContent: '',
        parentNode: null,

        classList: {
            add: (c) => classList.add(c),
            remove: (c) => classList.delete(c),
            contains: (c) => classList.has(c),
            toggle: (c) => classList.has(c) ? classList.delete(c) : classList.add(c)
        },

        getAttribute: (name) => attrs[name],
        setAttribute: (name, value) => { attrs[name] = value; },
        removeAttribute: (name) => { delete attrs[name]; },

        appendChild: (child) => {
            child.parentNode = element;
            children.push(child);
            return child;
        },
        removeChild: (child) => {
            const idx = children.indexOf(child);
            if (idx > -1) children.splice(idx, 1);
            child.parentNode = null;
            return child;
        },
        remove: () => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        },

        querySelector: (selector) => {
            // Simple selector matching
            for (const child of children) {
                if (matchesSelector(child, selector)) return child;
                const found = child.querySelector?.(selector);
                if (found) return found;
            }
            return null;
        },
        querySelectorAll: (selector) => {
            const results = [];
            function search(el) {
                for (const child of (el.children || [])) {
                    if (matchesSelector(child, selector)) results.push(child);
                    search(child);
                }
            }
            search(element);
            return results;
        },
        closest: (selector) => {
            let current = element;
            while (current) {
                if (matchesSelector(current, selector)) return current;
                current = current.parentNode;
            }
            return null;
        },

        addEventListener: (event, handler) => {
            if (!eventListeners[event]) eventListeners[event] = [];
            eventListeners[event].push(handler);
        },

        getBoundingClientRect: () => ({
            width: parseFloat(style.width) || 200,
            height: parseFloat(style.height) || 150,
            top: 0, left: 0, right: 200, bottom: 150
        }),

        getContext: (type) => {
            if (type === '2d') {
                return {
                    clearRect: () => {},
                    save: () => {},
                    restore: () => {},
                    translate: () => {},
                    rotate: () => {},
                    beginPath: () => {},
                    moveTo: () => {},
                    lineTo: () => {},
                    closePath: () => {},
                    fill: () => {},
                    stroke: () => {},
                    arc: () => {},
                    fillRect: () => {},
                    globalAlpha: 1,
                    fillStyle: '',
                    strokeStyle: '',
                    lineWidth: 1
                };
            }
            return null;
        },

        // For parsing innerHTML
        set innerHTML(html) {
            children.length = 0;
            if (html) {
                // Parse simple HTML structures for test purposes
                const divRegex = /<div[^>]*class="([^"]*)"[^>]*data-username="([^"]*)"[^>]*>([\s\S]*?)<\/div>/g;
                let match;
                while ((match = divRegex.exec(html)) !== null) {
                    const child = createMockElement('div');
                    child.className = match[1];
                    child.dataset.username = match[2];
                    child.parentNode = element;

                    // Parse nested elements
                    const innerDivRegex = /<div[^>]*class="([^"]*)"[^>]*style="([^"]*)"[^>]*>/g;
                    let innerMatch;
                    while ((innerMatch = innerDivRegex.exec(match[3])) !== null) {
                        const innerChild = createMockElement('div');
                        innerChild.className = innerMatch[1];
                        const styleParts = innerMatch[2].split(';').filter(s => s.trim());
                        styleParts.forEach(part => {
                            const [key, value] = part.split(':').map(s => s.trim());
                            if (key && value) {
                                innerChild.style[key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
                            }
                        });
                        innerChild.parentNode = child;
                        child.children.push(innerChild);
                    }

                    // Handle iframe wrappers
                    const iframeWrapperRegex = /<div[^>]*class="iframe-wrapper([^"]*)"[^>]*data-slot="(\d+)"[^>]*style="([^"]*)"[^>]*>/g;
                    let iwMatch;
                    while ((iwMatch = iframeWrapperRegex.exec(html)) !== null) {
                        const wrapper = createMockElement('div');
                        wrapper.className = 'iframe-wrapper' + iwMatch[1];
                        wrapper.dataset.slot = iwMatch[2];
                        const styleParts = iwMatch[3].split(';').filter(s => s.trim());
                        styleParts.forEach(part => {
                            const [key, value] = part.split(':').map(s => s.trim());
                            if (key && value) {
                                wrapper.style[key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
                            }
                        });
                        wrapper.parentNode = element;
                        // Don't push iframes for performer card parsing
                    }

                    children.push(child);
                }

                // Handle iframe-wrapper elements if no performer cards found
                if (children.length === 0) {
                    const iframeWrapperRegex2 = /class="iframe-wrapper([^"]*)"[^>]*data-slot="(\d+)"[^>]*style="([^"]*)"[^>]*/g;
                    let iwm;
                    while ((iwm = iframeWrapperRegex2.exec(html)) !== null) {
                        const wrapper = createMockElement('div');
                        wrapper.className = 'iframe-wrapper' + iwm[1];
                        wrapper.dataset.slot = iwm[2];
                        const styleParts = iwm[3].split(';').filter(s => s.trim());
                        styleParts.forEach(part => {
                            const [key, value] = part.split(':').map(s => s.trim());
                            if (key && value) {
                                wrapper.style[key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
                            }
                        });
                        wrapper.parentNode = element;
                        children.push(wrapper);
                    }
                }
            }
        },
        get innerHTML() { return ''; }
    };

    return element;
}

function matchesSelector(el, selector) {
    if (!el || !el.className) return false;

    // Class selector
    if (selector.startsWith('.')) {
        const parts = selector.split(':not(');
        const className = parts[0].substring(1);
        const hasClass = (el.className || '').includes(className);

        if (parts.length > 1) {
            const notClass = parts[1].replace(')', '').substring(1);
            return hasClass && !(el.className || '').includes(notClass);
        }
        return hasClass;
    }

    // Attribute selector
    if (selector.startsWith('[')) {
        const match = selector.match(/\[data-(\w+)="?([^"\]]*)"?\]/);
        if (match) {
            const key = match[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
            return el.dataset?.[key] === match[2];
        }
    }

    return false;
}

// Create the sandbox context
const sandbox = vm.createContext({
    console,
    window: { getComputedStyle: () => ({ position: 'relative' }) },
    document: {
        createElement: (tag) => createMockElement(tag),
        body: createMockElement('body'),
        querySelectorAll: () => []
    },
    requestAnimationFrame: (cb) => { setTimeout(cb, 0); return 1; },
    cancelAnimationFrame: () => {},
    performance: { now: () => Date.now() },
    setTimeout,
    clearTimeout,
    Math,
    Object,
    Map,
    Set,
    Array,
    JSON,
    parseInt,
    parseFloat,
    Boolean,
    String,
    Number,
    Error,
    Promise,
    process: { exit: (code) => { process.exitCode = code; } }
});

// Run shapes.js and expose ShapeEngine
vm.runInContext(shapesCode + '\nthis.ShapeEngine = ShapeEngine;', sandbox);

// Run tests
vm.runInContext(testCode, sandbox);
