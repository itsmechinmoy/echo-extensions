// ==UserScript==
// @name         Spotify Secrets
// @namespace    http://tampermonkey.net/
// @version      2025-07-29
// @description  try to take over the world!
// @author       You
// @match        https://open.spotify.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=spotify.com
// @grant        none
// @run-at       document-start
// ==/UserScript==

const patches = [
    {
        find: /=\[\w{2},\w{2},\w{2}\];const/, replacement: [
            {
                match: /(=\[\w{2},\w{2},\w{2}\];const \w{2}=(\w{2});)/,
                replace: (full,_,ve)=>`${full};window.TOKENS=${ve};console.log(TOKENS);`
            }
        ]
    }
];

/// ======== Do not touch the below! ========

Object.defineProperty(Function.prototype, "m", {
    set(v) {
        const source = this.toString();
        if (
            source.includes("exports") &&
            (source.includes("false") || source.includes("!1")) &&
            !(Array.isArray(v) && v?.some(m => m.toString().includes("CHROME_WEBSTORE_EXTENSION_ID"))) // react devtools
        ) {
            Object.defineProperty(this, "m", {
                value: v,
                configurable: true,
                enumerable: true,
                writable: true
            });

            patchFactories(v);

            delete Function.prototype.m;
            this.m = v;
            console.log(
                "%c%s%c %s %c%s",
                "background-color: #babbf1; color: black; border-radius: 4px; padding: 2px 4px; font-weight: bold;",
                "WebpackGrabber",
                "",
                "Found webpack_require! Check out",
                "font-weight: 600",
                "window.WEBPACK_GRABBER"
            );
        } else {
            // huh not webpack_require
            Object.defineProperty(this, "m", {
                value: v,
                configurable: true,
                writable: true,
                enumerable: true
            });
        }
    },
    configurable: true,
});

let webpackChunk = [];
Object.defineProperty(window, "webpackChunk_N_E", {
    configurable: true,

    get: () => webpackChunk,
    set: (v) => {
        if (v?.push) {
            if (!v.push.$$vencordOriginal) {
                console.log('Patching webpackChunk_N_E.push');
                patchPush(v);

                delete window.webpackChunk_N_E;
                window.webpackChunk_N_E = v;
            }
        }

        webpackChunk = v;
    }
});

function patchPush(webpackGlobal) {
    function handlePush(chunk) {
        try {
            patchFactories(chunk[1]);
        } catch (err) {
            console.error("Error in handlePush", err);
        }

        return handlePush.$$vencordOriginal.call(webpackGlobal, chunk);
    }

    handlePush.$$vencordOriginal = webpackGlobal.push;
    handlePush.toString = handlePush.$$vencordOriginal.toString.bind(handlePush.$$vencordOriginal);

    handlePush.bind = (...args) => handlePush.$$vencordOriginal.bind(...args);

    Object.defineProperty(webpackGlobal, "push", {
        configurable: true,

        get: () => handlePush,
        set(v) {
            handlePush.$$vencordOriginal = v;
        }
    });
}

function patchFactories(factories) {
    for (const id in factories) {
        let mod = factories[id];
        const originalMod = mod;

        const factory = factories[id] = function (module, exports, require) {
            try {
                mod(module, exports, require);
            } catch (e) {
                if (mod === originalMod) throw e;

                console.error("Error in patched module", e);
                return void originalMod(module, exports, require);
            }

            exports = module.exports;
            if (!exports) return;
        }

        factory.toString = originalMod.toString.bind(originalMod);
        factory.original = originalMod;

        let code = "0," + mod.toString();

        for (let i=0; i<patches.length; i++) {
            const patch = patches[i];

            const moduleMatches = typeof patch.find === "string"
            ? code.includes(patch.find)
            : patch.find.test(code);
            if (!moduleMatches) continue;

            const previousMod = mod;
            const previousCode = code;

            for (const replacement of patch.replacement) {
                const lastMod = mod;
                const lastCode = code;

                try {
                    code = code.replace(replacement.match, replacement.replace);
                    mod = (0, eval)(code);
                } catch (e) {
                    code = lastCode;
                    mod = lastMod;
                    console.log(e);
                    console.error("patch failed for " + replacement.replace);
                }
            }
            patches.splice(i--, 1);
        }
    }
}
