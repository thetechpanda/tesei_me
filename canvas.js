// "use strict";
// LICENSE: GPL-v2.0

var ready = false

const qs = (new URLSearchParams(window.location.search))

/**
 * @type {HexColor}
 */
const BACKGROUND_COLOR = "#2C2C2C"

/**
 * @type {HTMLCanvasElement}
 */
const canvas = document.getElementById('c');

/**
 * @type {CanvasRenderingContext2D}
 */
const ctx = canvas.getContext('2d');

/** @type {FontMap8x8} */
let font = window.BitmapFont || false

function terminate(msg) {
    canvas.width = scr.width() - 20;
    canvas.height = scr.height() - 50;
    ctx.font = '50px courier new'
    ctx.fillStyle = "red"
    let dangerText = msg
    ctx.fillText(dangerText, 150, 150)
    document.getElementById('toolbar').style.display = 'none';
    throw new Error(dangerText) // crashes to stop the world from ending, you are welcome.

}

if (font === false) {
    terminate("font.js not loaded, abort")
}

// const zeroY = window.scrollY

/**
 * unified screen info, forseening issues supporting all browsers.
 */
const scr = {
    portrait: window.matchMedia("(orientation: portrait)").matches,
    width() {
        return document.body.getBoundingClientRect().width
    },
    height() {
        return document.body.getBoundingClientRect().height
    },
    scrollY() {
        return window.scrollY
    },
    scrollX() {
        return window.scrollX
    },
}

window.matchMedia("(orientation: portrait)").addEventListener("change", e => {
    if (e.matches) {
        scr.portrait = true
    } else {
        scr.portrait = false
    }
});


/**
 * glyph is the current glyph configuration for the renderer
 */
const glyph = (() => {
    let [zoom, kerning, height] = [1.5, -2.0, 4]
    const g = {
        /**
         * pixelSize is the width and height of the letters as represented in the font.
         * see below.
         */
        zoom: zoom,
        /**
         * keyring is the spacing between letters.
         */
        kerning: kerning,
        /**
         * lineHeight is the spacing between line.
         */
        lineHeight: height,
        /**
         * width of each character.
         */
        charWitdh: 8 * zoom + kerning,
        /**
         * height of each character.
         */
        charHeight: 8 * zoom + height,
        /**
         * max column length.
         */
        maxColumns: 0,
        /**
         * max lines.
         */
        maxLines: 0,
        /**
         * resets the glyph to its original configuration
         */
        reset() {
            g.zoom = zoom
            g.kerning = kerning
            g.lineHeight = height
            g.charWitdh = 8 * (scr.portrait ? zoom : zoom - .5) + kerning
            g.charHeight = 8 * (scr.portrait ? zoom : zoom - .5) + height
        },
        getZoom() {
            return (scr.portrait ? glyph.zoom : glyph.zoom - .5)
        }
    }
    return g
})()


/**
 * controls for global glyph configuration
 */
const glyphCtl = {
    zoomUp(ev) {
        glyph.zoom += .10
        if (ev && ev.stopPropagation) { ev.stopPropagation() }
    },
    zoomDown(ev) {
        glyph.zoom -= .10
        if (ev && ev.stopPropagation) { ev.stopPropagation() }
    },
    kerningUp(ev) {
        glyph.kerning += .25
        if (ev && ev.stopPropagation) { ev.stopPropagation() }
    },
    kerningDown(ev) {
        glyph.kerning -= .25
        if (ev && ev.stopPropagation) { ev.stopPropagation() }
    },
    lineUp(ev) {
        glyph.lineHeight += .25
        if (ev && ev.stopPropagation) { ev.stopPropagation() }
    },
    lineDown(ev) {
        glyph.lineHeight -= .25
        if (ev && ev.stopPropagation) { ev.stopPropagation() }
    },
    ffw(ev) {
        context.cursor = context.tokens.length
        context.paused = true
        if (context.autoscroll) {
            canvas.height = (glyph.maxLines + 1) * glyph.getZoom() * glyph.charHeight
            document.getElementById("anchor").scrollIntoView()
        }
        if (ev && ev.stopPropagation) { ev.stopPropagation() }
    },
    toggle(ev) {
        if (!context.paused) {
            context.paused = true
        } else {
            context.paused = false
            if (context.cursor >= context.tokens.length) {
                context.cursor = 0
                window.scrollTo(0, 0)
            }
        }
        if (ev && ev.stopPropagation) { ev.stopPropagation() }
    }
}


// tags & colors
const tags = new class {
    EOL = "#EOL#"
    TAB = "#TAB#"
    SPACE = "#SPACE#"
    MAGENTA = "#C83CB1#"
    COMMENT = "#6B9E13#"
    GREEN = "#3CC753#"
    BLUE = "#3273BE#"
    BLUER = "#64A5F0#"
    YELLOW = "#F5F500#"
    ORANGE = "#FFB750#"
    WHITE = "#ffffff#"
    TEXT = "#FFFFE5#"
    QUOTED = "#95A5A6#"
}
// all color tags
const COLORS = [tags.QUOTED, tags.YELLOW, tags.MAGENTA, tags.COMMENT, tags.BLUE, tags.WHITE, tags.GREEN, tags.TEXT, tags.BLUER, tags.ORANGE]


/**
 * true if token is a printable token and not a tag
 * 
 * @param {string} token
 * @returns {boolean}
 */
const isPrintable = (token) => {
    if (COLORS.includes(token)) {
        return false
    }
    switch (token) {
        case tags.EOL:
        case tags.TAB:
        case tags.SPACE:
            return false;
    }
    return true
}

/**
 * pointer represent a pointer whatever mouse or touch type.
 */
class pointer {
    x = 0
    y = 0
    trigger = false
    touch = undefined
    last = 0
    delay = 500
    /**
     * true if the last event has lapsed in duration (delay) and pointer is NOT triggered
     * 
     * @returns {boolean}
     */
    elapsed() {
        return this.trigger === false || ((new Date).getTime() - this.last) > this.delay
    }
    /**
     * true if the last event has not lapsed in duration (delay) and pointer is triggered
     * 
     * @returns {boolean}
     */
    triggered() {
        return this.trigger === true && ((new Date).getTime() - this.last) < this.delay
    }
    /**
     * ingest mouse events from window/canvas
     * 
     * @param {MouseEvent} ev 
     */
    eventHandler(ev) {
        let evt = ev?.type + ''
        let pointer = { x: ev.clientX + scr.scrollX(), y: ev.clientY + scr.scrollY() }
        let isTouch = evt.startsWith("touch")
        if (isTouch) {
            pointer = { x: ev.layerX, y: ev.layerY }
        }
        if (this.isStart(ev)) {
            this.trigger = true
        } else if (this.isEnd(ev)) {
            this.trigger = false
        } else {
            return
        }
        if (this.trigger && this.elapsed()) {
            this.last = (new Date).getTime()
        }
        this.x = pointer.x
        this.y = pointer.y
        console.log('received', evt, this, ev)
        ev.stopPropagation()
    }
    /**
     * true if the device uses touch events
     * 
     * @param {MouseEvent} ev 
     * @returns {boolean}
     */
    touchDevice(ev) {
        if (this.touch === undefined) {
            this.touch = ev?.type.includes("touch") || window.ontouchstart !== undefined || navigator.maxTouchPoints > 0 || (window.DocumentTouch && document instanceof DocumentTouch)
        }
        return this.touch
    }
    /**
     * true if ev is "start" event
     * 
     * @param {MouseEvent} ev 
     * @returns {boolean}
     */
    isStart(ev) {
        return this.touchDevice(ev) ? ev?.type.endsWith("start") : ev?.type.endsWith("down")
    }
    /**
     * true if ev is "end" event
     * 
     * @param {MouseEvent} ev 
     * @returns {boolean}
     */
    isEnd(ev) {
        return this.touchDevice(ev) ? ev?.type.endsWith("end") : ev?.type.endsWith("up")
    }
}

/**
 * context controls the canvas and keeps track of what's displayed and what's not
 */
const context = {
    /**
     * fpsLimit limits the number of frame per seconds.
     * 
     * @type {number}
     */
    fpsLimit: 33,
    /**
     * context clock is last time a frame was printed.
     * 
     * @type {number}
     */
    contextClock: (new Date).getTime(),
    /**
     * displayStatusLast last time the status was displayed
     * 
     * @type {boolean}
     */
    displayStatusLast: (new Date).getTime(),
    /**
     * displayStatus true if the blinker is to be displayed
     * 
     * @type {boolean}
     */
    displayStatus: false,
    /**
     * enable click debug on screan
     * 
     * @type {boolean}
     */
    clickDebug: false,
    /**
     * auto scroll
     * 
     * @type {boolean}
     */
    autoscroll: true,
    /**
     * current pointer
     * 
     * @type {pointer}
     */
    pointer: new pointer,
    /**
     * cursor porition relative to the tokens
     * 
     * @type {number}
     */
    cursor: 0,
    /**
     * true if the context is frozen
     * 
     * @type {boolean}
     */
    paused: false,
    /**
     * tokens to be rendered
     * 
     * @type {[]string}
     */
    tokens: [],
    /**
     * origin x
     * 
     * @type {number}
     */
    origX: 5,
    /**
     * origin y
     * 
     * @type {number}
     */
    origY: 60,
    /**
     * current x position
     * 
     * @type {number}
     */
    x: 0,
    /**
     * current y position
     * 
     * @type {number}
     */
    y: 0,
    /**
     * generic state 
     * 
     * @type {{key: any, value: any}} obj
     */
    state: {},
    /**
     * updates canvas and clears screen
     */
    resetView() {
        glyph.charWitdh = 8 * glyph.getZoom() + glyph.kerning
        glyph.charHeight = 8 * glyph.getZoom() + glyph.lineHeight
        var printedLines = this.tokens.filter((v, i) => v == tags.EOL && i < this.cursor).length + 5
        canvas.height = Math.max(printedLines * glyph.charHeight + context.origY, scr.height())
        let maxW = (glyph.maxColumns * glyph.charWitdh) + context.origX
        let wW = scr.width() - 20 // why is it 20? magic number.
        canvas.width = Math.max(maxW, wW, 1024)
        if (wW > maxW) {
            let pad = ((wW - maxW) / 2)
            context.origX = Math.min(5, pad)
        } else {
            context.origX = 5
        }
        context.clear()
    },
    /**
     * clears the canvas
     */
    clear() {
        ctx.fillStyle = BACKGROUND_COLOR;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        context.x = context.origX
        context.y = context.origY
    },
    /**
     * draws a rectagle on the canvas
     * @param {number} x 
     * @param {number} y 
     * @param {number} w 
     * @param {number} h 
     * @param {HTMLColor} color fill style for 2d context
     */
    drawRect(x, y, w, h, color) {
        ctx.fillStyle = color
        ctx.fillRect(x, y, w, h);
    },
    /**
     * draws a string token on the canvas
     * @param {string} token string to print
     * @param {number} x 
     * @param {number} y 
     * @param {HTMLColor} color fill style for 2d context
     * @returns 
     */
    drawToken(token, x, y, color, zoom = glyph.getZoom(), charWidth = glyph.charWitdh) {
        // metrics()
        if (!token || !token.split) {
            return
        }
        let advance = x + (token.length * charWidth)
        token = token.split("")
        let [row, col, bmp] = [0, 0, null]
        const next = () => {
            if (row >= 8) {
                return
            }
            if (col >= 8) {
                row++
                col = 0
            }
            draw()
        }
        const draw = () => {
            let bits = bmp[row];
            if ((bits >> (7 - col)) & 1) {
                let cx = x + col * zoom
                let cy = y + row * zoom
                context.drawRect(
                    cx,
                    cy,
                    zoom,
                    zoom,
                    color
                );
            }
            col++
            next()
        }
        const nextCharacter = () => {
            [row, col] = [0, 0]
            if (token.length == 0) {
                return
            }
            let curr = token.shift()
            bmp = font[curr]
            draw()
            x += charWidth;
            nextCharacter()
        }
        nextCharacter()
        return advance
    },
    /**
     * draws a button with the give text in the center.
     * 
     * @param {string} text string to print
     * @param {number} x coord x 
     * @param {number} y coord y 
     * @param {number} w coord w 
     * @param {number} h coord h 
     * @param {HTMLColor} bg background CanvasRenderingContext2D colors
     * @param {HTMLColor} fg foreground CanvasRenderingContext2D colors
     * @param {HTMLColor} border border CanvasRenderingContext2D colors
     * @param {number} radius border radius
     * @param {string} font definition for CanvasRenderingContext2D font 
     */
    drawButton(text = '', x, y, w, h, bg = '', fg = '', border = '', radius = 0, font = '') {
        // rounded rectangle path
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();

        // fill background
        ctx.fillStyle = bg;
        ctx.fill();

        // draw border
        if (border) {
            ctx.strokeStyle = border;
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // draw text
        if (fg) {
            ctx.fillStyle = fg;
        }
        if (font) {
            ctx.font = font;
        }
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x + w / 2, y + h / 2);
    },
    /**
     * writes a token to the canvas, updates context's coordinates
     * @param {string} token 
     * @param {HTMLColor} color fill style for 2d context 
     */
    write(token, color) {
        switch (token) {
            case tags.EOL:
                comment = false
                context.x = context.origX;
                context.y += glyph.charHeight;
                break
            case tags.TAB:
                context.x += (glyph.charWitdh * 4);
                break
            case tags.SPACE:
                context.x += glyph.charWitdh;
                break
            default:
                context.x = context.drawToken(token, context.x, context.y, color)
        }
    },
    /**
     * checks collision between the coord given and the pointer.
     * 
     * @param {number} x 
     * @param {number} y 
     * @param {number} w 
     * @param {number} h 
     * @returns {[]any} [ 0: collision - bool, 1: pos - number ]
     */
    collision(x, y, w, h) {
        if (!context.pointer.triggered()) {
            return [false, undefined]
        }
        let [m, x1, y1] = [context.pointer, x + w, y + h]
        let [r, l] = [Math.abs(m.x - x), Math.abs(m.x - x1)]
        let [collision, pos] = [(m.x > x && m.x < x1 && m.y > y && m.y < y1), (l > r) ? -1 : Math.abs(l - r) > 30 ? 1 : 0]
        return [collision, collision ? pos : undefined /* invalid value */]
    },
    /**
     * prints HUD on the canvas
     */
    printHUD() {
        // glyph information
        const isPaused = context.paused || context.cursor >= context.tokens.length
        let status = isPaused ? "paused" : "playing"
        ctx.fillStyle = "black"
        let scrollY = scr.scrollY() + document.body.scrollTop
        ctx.fillRect(0, scrollY, 4096, 60)
        ctx.font = "bold 18px 'courier new'";
        ctx.fillStyle = "white"
        ctx.textAlign = 'left'
        let header = (new Date).toISOString() + " " +
            "zoom: " + glyph.getZoom().toFixed(2) + "x " +
            "kerning: " + glyph.kerning.toFixed(2) + "x " +
            "height: " + glyph.lineHeight.toFixed(2) + "x " +
            "size: " + scr.width().toFixed(0) + "x" + scr.height().toFixed(0) + " "
        ctx.fillText(header, 10, 20 + scrollY)
        if (context.state.ShowStatus === undefined) {
            context.state.ShowStatus = true
        }
        if (context.state.StatusLastUpdate === undefined) {
            context.state.StatusLastUpdate = (new Date).getTime()
        } else if ((new Date).getTime() - context.state.StatusLastUpdate > 1500) {
            context.state.StatusLastUpdate = (new Date).getTime()
            context.state.ShowStatus = !context.state.ShowStatus
        }

        if (context.state.EventTimestamp === undefined) {
            context.state.EventTimestamp = 0
        }

        const boxes = { "scroll": 60, "play": 60, "skip": 60, "reset": 60, "zoom": 120, "kerning": 120, "height": 120 }
        let xbox = 25
        let margin = 40
        for (let [box, w] of Object.entries(boxes)) {
            let [x, y, h] = [xbox, scrollY + 35 - 2, 24]
            let text = box
            let [collide, touchPos] = context.collision(x, y, w, h)
            let since = (new Date()).getTime() - context.state.EventTimestamp
            if (collide && context.pointer.triggered() && since > 500) {
                context.state.EventTimestamp = new Date().getTime()
                console.log(collide, context.pointer.triggered(), since)
            } else {
                collide = false
            }

            const hl = (x, y, w, h, hl = undefined) => {
                if (hl === undefined) {
                    return
                }
                let [cx, cy, cw, ch] = [x, y, w, h]
                let scale = 4
                switch (hl) {
                    case 1:
                        cx += cw - cw / scale
                    case -1:
                        cw = cw / scale
                        break
                    case 0:
                        break
                    default:
                        return
                }
                let ga = ctx.globalAlpha
                ctx.globalAlpha = 0.8
                context.drawRect(cx, cy, cw, ch, "green")
                ctx.globalAlpha = ga
            }

            let foreground = "whitesmoke"

            switch (box) {
                case "zoom":
                    if (collide) {
                        if (touchPos == 1) {
                            glyphCtl.zoomUp()
                        } else if (touchPos == -1) {
                            glyphCtl.zoomDown()
                        }
                    }
                    text = `<  ⌕  >`
                    break
                case "kerning":
                    if (collide) {
                        if (touchPos == 1) {
                            glyphCtl.kerningUp()
                        } else if (touchPos == -1) {
                            glyphCtl.kerningDown()
                        }
                    }
                    text = `<  ⎶  >`
                    break
                case "height":
                    if (collide) {
                        if (touchPos == 1) {
                            glyphCtl.lineUp()
                        } else if (touchPos == -1) {
                            glyphCtl.lineDown()
                        }
                    }
                    text = `<  ⌶  >`
                    break
                case "play":
                    if (collide) {
                        glyphCtl.toggle()
                    }
                    text = isPaused ? "⏵︎" : "⏸︎"
                    foreground = !isPaused ? "green" : "gray"
                    touchPos = touchPos === undefined ? undefined : 0
                    break
                case "skip":
                    if (collide) {
                        glyphCtl.ffw()
                    }
                    text = "⏭︎"
                    touchPos = touchPos === undefined ? undefined : 0
                    break
                case "reset": {
                    if (collide) {
                        glyph.reset()
                    }
                    text = "⌘"
                    touchPos = touchPos === undefined ? undefined : 0
                    break
                }
                case "scroll": {
                    if (collide) {
                        context.autoscroll = !context.autoscroll
                    }
                    text = "⏻"
                    foreground = context.autoscroll && !context.pointer.trigger ? "green" : "gray"
                    touchPos = touchPos === undefined ? undefined : 0
                    break
                }

            }
            context.drawButton(text, x, y, w, h, 'black', foreground, '', 5, 'bold 22px "courier new"')
            hl(x, y, w, h, touchPos)
            ctx.fillStyle = "whitesmoke"
            ctx.textAlign = "center"
            ctx.font = '22px "courier new"'
            xbox += w + margin
        }

        if (context.state.ShowStatus) {
            // play status
            ctx.font = "bold 20px 'courier new'";
            ctx.fillStyle = "green"
            let [cx, cy] = [(scr.width() + scr.scrollX()) - 170, 60 + scrollY]
            context.drawToken(status.toUpperCase(), cx, cy, "green", 3, 8 * 2.5)
        }

        if (context.clickDebug) {
            // debug mouse click
            let text = context.pointer.x + ', ' + context.pointer.y + ' = ' + context.pointer.triggered() + ' ' + scr.portrait
            let w = text.length * 10
            ctx.fillStyle = 'black'
            ctx.fillRect(context.pointer.x - (w / 2), context.pointer.y - 10, w, 20)
            ctx.fillStyle = 'yellow'
            ctx.font = '10px "courier new"'
            ctx.fillText(text, context.pointer.x, context.pointer.y)
        }

    },
    /**
     * advances shown frame not the next
     * 
     * @returns {boolean} if true a token was printed.
     */
    advanceFrame() {
        let color = tags.TEXT
        for (let t = 0; t < context.cursor; t++) {
            let token = context.tokens[t]
            if (COLORS.includes(token)) {
                color = token.substring(0, token.length - 1)
            } else {
                context.write(token, color)
            }
        }
        if (context.paused || context.cursor >= context.tokens.length) {
            return false
        }
        if (context.tokens[context.cursor]) {
            // advances frame
            let token = context.tokens[context.cursor++]
            if (!token) {
                return false
            }
            if (COLORS.includes(token)) {
                color = token.substring(0, token.length - 1)
            } else {
                context.write(token, color)
            }
        }
        return true
    },
    /**
     * returns the length of the last printed token.
     * 
     * @returns {number}
     */
    textCursorLength() {
        for (let curr = this.cursor - 1; curr >= 0; curr--) {
            if (this.tokens[curr]) {
                if (isPrintable(this.tokens[curr])) {
                    return this.tokens[curr].trim().length * glyph.charWitdh
                }
            }
        }
        return 0
    },
    /**
     * runs the main loop
     * @returns {void}
     */
    main: () => requestAnimationFrame(() => {
        ready = true
        let now = (new Date).getTime()
        let elapsed = now - context.contextClock;
        let interval = 1000 / context.fpsLimit
        context.resetView()
        context.printHUD()
        if (context.advanceFrame() === false) {
            // prints cursor on the last known token
            if ((now - context.displayStatusLast) > 650) {
                context.displayStatus = !context.displayStatus
                context.displayStatusLast = now
            }
            if (context.displayStatus) {
                context.drawRect(context.x - context.textCursorLength(), context.y + glyph.charHeight + 5, context.textCursorLength(), 2, "green")
                context.drawRect(context.x - context.textCursorLength(), context.y + glyph.charHeight + 3, context.textCursorLength(), 2, BACKGROUND_COLOR)
                context.drawRect(context.x - context.textCursorLength(), context.y + glyph.charHeight + 1, context.textCursorLength(), 2, "green")
            }
        }
        context.printHUD()
        let nextThick = interval - elapsed
        context.contextClock = now
        setTimeout(context.main, nextThick > 0 ? nextThick : 0)
        if (context.paused == false && context.tokens.length > context.cursor && !context.pointer.trigger && context.autoscroll) {
            window.scrollTo({
                top: Math.max(scr.scrollY(), canvas.height) + context.origY,
                behavior: "smooth"
            })
        }
    }),
}


let body = (async () => {
    // let content = await fetch('self.go')
    const credits = await (await fetch('credits.txt')).text()
    /**
     * golang source code
     */
    const selfDotGo = (await (await fetch('self.go')).text())

    /**
     * list of tokens to render
     */
    const tokens =
        // lame golang syntax hilighter, but does its job.. if the order is exactly as follow :D
        [tags.EOL].concat((selfDotGo.trim() + "\n" + credits)
            // comments
            .replace(/\/\/(?!todo: |bug: ).*$/gm, m => `${tags.COMMENT}${m}${tags.TEXT}`)
            .replace(/\/\/\s+todo: .*/g, m => `${tags.ORANGE}${m}${tags.COMMENT}`)
            .replace(/\/\/\s+bug: .*/g, m => `${tags.MAGENTA}${m}${tags.COMMENT}`)
            .replace(/\/\* (.*?) \*\//g, m => `${tags.COMMENT}${m}${tags.TEXT}`)
            // package and return
            .replace(/^(\s*?)(package|return)/gm, `${tags.MAGENTA}$1$2${tags.TEXT}`)
            // higlights todo because I love better comments extension
            // quoted text
            .replace(/"(?:\\.|[^"\\])*"/g, m => `${tags.QUOTED}"${m.slice(1, -1)}"${tags.TEXT}`)
            // types highlight
            .replace(/((?:\[\d+?\])+)([A-Za-z_]\w*)/g, (_, brackets, ident) => `${tags.GREEN}${brackets}${ident}${tags.TEXT}`)
            .replace(/\b(?:(map\[\w+\]\w+?|((\[\w+?\])?(int|\[\]string|string|bool|byte|rune|error|float32|float64|chan))))\b/g, m => `${tags.GREEN}${m}${tags.TEXT}`)
            .replace(/\b(func|type)\b\s*(?:\([^)]*\)\s*)?([A-Za-z_]\w*)/g, `${tags.BLUE}$1${tags.TEXT} ${tags.YELLOW}$2${tags.TEXT}`)
            .replace(/\b(var|const)\b/g, `${tags.BLUE}$1 ${tags.TEXT}`)
            .replace(/([ \t])([A-Za-z_]\w*)(?=\s*=)/g, (_, sp, name) => `${sp}${tags.BLUER}${name}${tags.TEXT}`)
            // pretty square brackets
            .replace(/([\{\}])/g, `${tags.YELLOW}$1${tags.TEXT}`)
            // type casting, wouldn't bet this works with all code.
            .replace(/\S+\((.*)\)/g, m => `${tags.YELLOW}${m}${tags.TEXT}`)
            .replace(/\n/gm, `${tags.EOL}`)
            .replace(/\t/gm, `${tags.TAB}`)
            .replace(/\s/gm, ` ${tags.SPACE} `)
            .replaceAll(/#(\S+?)#/gm, ` #$1# `)
            .split(" ")
            .filter(v => v.trim() != ""))
            .concat(tags.EOL) // 1 lines padding

    context.tokens = tokens

    // in order to know height and width of the printed text scans the tokens and updates the glyph.
    let currColumnCounter = 0
    glyph.maxLines = 0
    glyph.maxColumns = 0
    for (let token of tokens) {
        if (COLORS.includes(token)) {
            continue
        }
        switch (token) {
            case tags.EOL:
                currColumnCounter = 0
                glyph.maxLines++
                break
            case tags.TAB:
                currColumnCounter += 4
                break
            case tags.SPACE:
                currColumnCounter += 1
                break
            default:
                currColumnCounter += token.length
                break
        }
        glyph.maxColumns = Math.max(glyph.maxColumns, currColumnCounter)
    }

    // controls initial state
    if (context.cursor >= context.tokens.length) {
        context.cursor = 0
        window.scrollTo(0, 0)
    }


    // start rendering
    if (qs.get("paused") !== null) {
        context.paused = true
    }

    // start rendering
    context.main()

    /**
     * updates context mouse values
     * 
     * @param {MouseEvent} ev 
     * @returns 
     */
    // const updateMouse = ev => _ => requestAnimationFrame(_ => context.pointer.eventHandler(ev))
    const updateMouse = ev => context.pointer.eventHandler(ev)

    canvas.addEventListener('mousemove', updateMouse)
    canvas.addEventListener('mousedown', updateMouse)
    canvas.addEventListener('mouseup', updateMouse)

    canvas.addEventListener('touchmove', updateMouse)
    canvas.addEventListener('touchstart', updateMouse)
    canvas.addEventListener('touchend', updateMouse)

    window.addEventListener('scroll', _ => context.printHUD())
    window.addEventListener('scrollend', _ => context.printHUD())
})()