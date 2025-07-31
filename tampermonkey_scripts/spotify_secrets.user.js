// ==UserScript==
// @name         Spotify Secrets
// @namespace    http://tampermonkey.net/
// @version      2025-07-31
// @description  Extract Spotify tokens
// @author       You
// @match        https://open.spotify.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=spotify.com
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';
    
    console.log('Spotify Secrets script loaded');
    
    const patches = [
        {
            find: /=\[\w{2},\w{2},\w{2}\];const/, 
            replacement: [
                {
                    match: /(=\[\w{2},\w{2},\w{2}\];const \w{2}=(\w{2});)/,
                    replace: (full, _, ve) => `${full};window.TOKENS=${ve};console.log('TOKENS found:', TOKENS);`
                }
            ]
        }
    ];

    // Store original webpack chunk
    let originalWebpackChunk = window.webpackChunk_N_E;
    
    // Hook into webpack earlier
    Object.defineProperty(window, 'webpackChunk_N_E', {
        configurable: true,
        get() {
            return this._webpackChunk;
        },
        set(value) {
            console.log('webpackChunk_N_E set detected');
            this._webpackChunk = value;
            
            if (value && value.push && !value.push.$$patched) {
                console.log('Patching webpack push');
                patchWebpackPush(value);
            }
        }
    });

    // Initialize with existing value if present
    if (originalWebpackChunk) {
        window.webpackChunk_N_E = originalWebpackChunk;
    }

    function patchWebpackPush(webpackGlobal) {
        const originalPush = webpackGlobal.push.bind(webpackGlobal);
        
        webpackGlobal.push = function(chunk) {
            try {
                console.log('Webpack chunk pushed, patching factories');
                patchFactories(chunk[1]);
            } catch (err) {
                console.error('Error patching factories:', err);
            }
            
            return originalPush(chunk);
        };
        
        webpackGlobal.push.$$patched = true;
        console.log('Webpack push patched successfully');
    }

    function patchFactories(factories) {
        if (!factories || typeof factories !== 'object') return;
        
        for (const id in factories) {
            let factory = factories[id];
            if (typeof factory !== 'function') continue;
            
            const originalFactory = factory;
            let code = factory.toString();
            
            // Check if this factory matches our patches
            for (let i = 0; i < patches.length; i++) {
                const patch = patches[i];
                
                const moduleMatches = typeof patch.find === "string" 
                    ? code.includes(patch.find)
                    : patch.find.test(code);
                    
                if (!moduleMatches) continue;
                
                console.log(`Found matching module ${id}, applying patches`);
                
                for (const replacement of patch.replacement) {
                    try {
                        const newCode = code.replace(replacement.match, replacement.replace);
                        if (newCode !== code) {
                            console.log(`Patching module ${id}`);
                            code = newCode;
                            
                            // Create new factory function
                            factory = new Function('module', 'exports', 'require', 
                                code.substring(code.indexOf('{') + 1, code.lastIndexOf('}')));
                            
                            // Preserve original properties
                            Object.defineProperty(factory, 'toString', {
                                value: () => originalFactory.toString()
                            });
                            
                            factories[id] = factory;
                        }
                    } catch (e) {
                        console.error(`Failed to patch module ${id}:`, e);
                    }
                }
                
                // Remove used patch
                patches.splice(i, 1);
                i--;
                break;
            }
        }
    }

    // Alternative approach: Hook Function.prototype.m for older webpack versions
    const originalMSetter = Object.getOwnPropertyDescriptor(Function.prototype, 'm');
    
    Object.defineProperty(Function.prototype, 'm', {
        set(value) {
            if (originalMSetter?.set) {
                originalMSetter.set.call(this, value);
            } else {
                this._m = value;
            }
            
            const source = this.toString();
            if (source.includes('exports') && 
                (source.includes('false') || source.includes('!1')) &&
                Array.isArray(value)) {
                
                console.log('Found webpack require, patching factories');
                patchFactories(value);
            }
        },
        get() {
            if (originalMSetter?.get) {
                return originalMSetter.get.call(this);
            }
            return this._m;
        },
        configurable: true
    });

    // Monitor for TOKENS and report when found
    let tokenCheckInterval = setInterval(() => {
        if (window.TOKENS) {
            console.log('TOKENS object detected:', window.TOKENS);
            
            if (window.TOKENS.secrets && Array.isArray(window.TOKENS.secrets)) {
                console.log(`Found ${window.TOKENS.secrets.length} secrets`);
                window.TOKENS.secrets.forEach((secret, index) => {
                    console.log(`Secret ${index}:`, secret);
                });
            }
            
            clearInterval(tokenCheckInterval);
        }
    }, 1000);

    // Clear interval after 5 minutes to prevent memory leaks
    setTimeout(() => {
        if (tokenCheckInterval) {
            clearInterval(tokenCheckInterval);
        }
    }, 300000);

    console.log('Spotify Secrets script initialized');
})();
