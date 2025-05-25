// "use strict";
// LICENSE: GPL-v2.0

let ready = false

const qs = (new URLSearchParams(window.location.search))

const Credits = `
#EOL#
// # About this site
//
//   - TL;DR; time waster weekend project.
//
// This text is rendered using an IBM AS/400-style 8x8 bitmap font.
// The text is tokenized and stuffed with tags that specify changes in foreground 
// color for the next token. 
// 
// Each token is then rendered to the canvas using the bit matrix stored in each 
// available font character.
//
// A single requestAnimationFrame is used, which calls context.advanceFrame, the method 
// renders all tokens currently on screen,then proceeds to print any remaining tokens.
//
// The buttons at the bottom allow you to adjust the glyph configuration, which controls zoom, 
// kerning (spacing between letters), and line height (spacing between lines).
//
// If you zoom in a lot, you'll notice some imperfections in my math :)
//
// When paused a cursor is shown under the last printed token.
// bug: cursor is not precise.
//
// todo: would be cool to add an editor :)
`
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

/**
 * @type {HTMLElement}
 */
const controlButton = document.getElementById('ctrl')
/**
 * @type {HTMLElement}
 */
const fastForwardButton = document.getElementById('ffw')

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
    }
}

/**
 * glyph is the current glyph configuration for the renderer
 */
const glyph = (() => {
    [size, kerning, height] = [.9, 0, 3]
    const g = {
        /**
         * pixelSize is the width and height of the letters as represented in the font.
         * see below.
         */
        zoom: size,
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
        charWitdh: 8 * size + kerning,
        /**
         * height of each character.
         */
        charHeight: 8 * size + height,
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
            g.zoom = size
            g.kerning = kerning
            g.lineHeight = height
            g.charWitdh = 8 * size + kerning
            g.charHeight = 8 * size + height
        }
    }
    return g
})()

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

const block = document.getElementsByTagName('pre')

if (block.length == 0) {
    terminate("no code block found, abort")
}

/**
 * golang source code
 */
const selfDotGo = block[0].innerText;

document.getElementsByTagName('main')[0].remove()

/**
 * list of tokens to render
 */
const tokens =
    // lame golang syntax hilighter, but does its job.. if the order is exactly as follow :D
    (selfDotGo + Credits)
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
        .filter(v => v.trim() != "")

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

/**
 * sets play button text and hides fast worward
 */
const resetPlayButton = () => {
    controlButton.innerText = "play"
    fastForwardButton.style.display = 'none';
}

/**
 * true if token is a printable token and not a tag
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
 * context controls the canvas and keeps track of what's displayed and what's not
 */
const context = {
    /**
     * cursor porition relative to the tokens
     * @type {number}
     */
    cursor: 0,
    /**
     * true if the context is frozen
     * @type {boolean}
     */
    paused: false,
    /**
     * tokens to be rendered
     */
    tokens: tokens.concat(),
    /**
     * origin x
     * @type {number}
     */
    origX: 5,
    /**
     * origin y
     * @type {number}
     */
    origY: 20,
    /**
     * current x position
     * @type {number}
     */
    x: 0,
    /**
     * current y position
     * @type {number}
     */
    y: 0,
    /**
     * generic state 
     */
    state: {},
    /**
     * updates glyph (in case they have changed.)
     */
    updateCanvas() {
        glyph.charWitdh = 8 * glyph.zoom + glyph.kerning
        glyph.charHeight = 8 * glyph.zoom + glyph.lineHeight

        var printedLines = this.tokens.filter((v, i) => v == tags.EOL && i < this.cursor).length + 5
        canvas.height = Math.max(printedLines * glyph.charHeight, scr.height())
        if (context.paused == false && context.tokens.length > context.cursor) {
            window.scrollTo(0, Math.max(scr.scrollY(), canvas.height))
        }
        let maxW = (glyph.maxColumns * glyph.charWitdh) + context.origX
        let wW = scr.width() - 20 // why is it 20? magic number.
        canvas.width = Math.max(maxW, wW)
        if (wW > maxW) {
            let pad = ((wW - maxW) / 2)
            context.origX = Math.min(5, pad)
        } else {
            context.origX = 5
        }
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
     * draws a token on the canvas
     * @param {string} token string to print
     * @param {number} x 
     * @param {number} y 
     * @param {HTMLColor} color fill style for 2d context
     * @returns 
     */
    drawToken(token, x, y, color) {
        // metrics()
        if (!token || !token.split) {
            return
        }
        let advance = x + (token.length * glyph.charWitdh)
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
                let cx = x + col * glyph.zoom
                let cy = y + row * glyph.zoom
                context.drawRect(
                    cx,
                    cy,
                    glyph.zoom,
                    glyph.zoom,
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
            x += glyph.charWitdh;
            nextCharacter()
        }
        nextCharacter()
        return advance
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
     * prints HUD on the canvas
     */
    printHUD() {
        // glyph information
        let status = context.paused || context.cursor >= context.tokens.length ? "pause" : "play"
        ctx.fillStyle = "black"
        ctx.fillRect(0, scr.scrollY(), canvas.width + 100, 20)
        ctx.font = "8pt 'courier new'";
        ctx.fillStyle = "white"
        ctx.fillText(
            (new Date).toLocaleString() + " = " +
            "zoom: " + glyph.zoom.toFixed(2) + "x " +
            "kerning: " + glyph.kerning.toFixed(2) + "x " +
            "height: " + glyph.lineHeight.toFixed(2) + "x " +
            "scroll: " + scr.scrollY().toFixed(2) + " " +
            "W x H: " + scr.width().toFixed(2) + " x " + scr.height().toFixed(2) + " "
            , 10, 13 + scr.scrollY())
        if (context.state.status_blink_show === undefined) {
            context.state.status_blink_show = true
        }
        if (context.state.status_blink_seen === undefined) {
            context.state.status_blink_seen = (new Date).getTime()
        } else if ((new Date).getTime() - context.state.status_blink_seen > 1500) {
            context.state.status_blink_seen = (new Date).getTime()
            context.state.status_blink_show = !context.state.status_blink_show
        }
        if (context.state.status_blink_show) {
            // play status
            ctx.font = "20px 'courier new'";
            ctx.fillStyle = "green"
            ctx.fillText(status, (scr.width() - scr.scrollX()) - 200, context.origY + 30 + scr.scrollY())
        }
    },
    /**
     * advances shown frame not the next
     * 
     * @returns {boolean} if true a token was printed.
     */
    advanceFrame() {
        // debugger
        context.updateCanvas()
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
            if (context.cursor >= context.tokens.length) {
                controlButton.innerText = "play"
                fastForwardButton.style.display = 'none';
            }
            context.printHUD()
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
        context.printHUD()
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
    }
}

const now = _ => (new Date).getTime()
let last = now()
let seen = false

/**
 * runs the main loop
 * @returns {void}
 */
const mainLoop = _ => requestAnimationFrame(() => {
    ready = true
    context.clear()
    if (context.advanceFrame() === false) {
        // prints cursor on the last known token
        if ((now() - last) > 650) {
            seen = !seen
            last = now()
        }
        if (seen) {
            context.drawRect(context.x - context.textCursorLength(), context.y + glyph.charHeight + 5, context.textCursorLength(), 2, "green")
            context.drawRect(context.x - context.textCursorLength(), context.y + glyph.charHeight + 3, context.textCursorLength(), 2, BACKGROUND_COLOR)
            context.drawRect(context.x - context.textCursorLength(), context.y + glyph.charHeight + 1, context.textCursorLength(), 2, "green")
        }
    }
    mainLoop()
})

// setups ui controls
controlButton.addEventListener('mouseup', _ => {
    console.debug("button clicked")
    if (controlButton.innerText.toLocaleLowerCase() === "pause") {
        console.debug("pausing")
        context.paused = true
        controlButton.innerText = "play"
    } else if (controlButton.innerText.toLocaleLowerCase() === "play") {
        console.debug("playing")
        context.paused = false
        controlButton.innerText = "pause"
        if (context.cursor >= context.tokens.length) {
            context.cursor = 0
            window.scrollTo(0, 0)
        }
        fastForwardButton.style.display = 'inline-block';
    }
})

const glyphCtl = {
    zoomUp() {
        glyph.zoom += .25
    },
    zoomDown() {
        glyph.zoom -= .25
    },
    kerningUp() {
        glyph.kerning += .25
    },
    kerningDown() {
        glyph.kerning -= .25
    },
    lineUp() {
        glyph.lineHeight += .25
    },
    lineDown() {
        glyph.lineHeight -= .25
    },
    ffw() {
        debugger
        fastForwardButton.style.display = 'none';
        controlButton.innerText = "play"
        context.cursor = context.tokens.length
        context.paused = false
        requestAnimationFrame(_ => {
            window.scrollTo(0, scr.scrollY())
        })
    }
}
document.getElementById('zoom-up').addEventListener('mouseup', glyphCtl.zoomUp)
document.getElementById('zoom-up').addEventListener('touchend', glyphCtl.zoomUp)
document.getElementById('zoom-down').addEventListener('mouseup', glyphCtl.zoomDown)
document.getElementById('zoom-down').addEventListener('touchend', glyphCtl.zoomDown)
document.getElementById('kerning-up').addEventListener('mouseup', glyphCtl.kerningUp)
document.getElementById('kerning-up').addEventListener('touchend', glyphCtl.kerningUp)
document.getElementById('kerning-down').addEventListener('mouseup', glyphCtl.kerningDown)
document.getElementById('kerning-down').addEventListener('touchend', glyphCtl.kerningDown)
document.getElementById('line-up').addEventListener('mouseup', glyphCtl.lineUp)
document.getElementById('line-up').addEventListener('touchend', glyphCtl.lineUp)
document.getElementById('line-down').addEventListener('mouseup', glyphCtl.lineDown)
document.getElementById('line-down').addEventListener('touchend', glyphCtl.lineDown)
document.getElementById('reset').addEventListener('mouseup', glyph.reset)
document.getElementById('reset').addEventListener('touchend', glyph.reset)
console.log(fastForwardButton)
fastForwardButton.addEventListener('click', glyphCtl.ffw)
fastForwardButton.addEventListener('touchend', glyphCtl.ffw)

// controls initial state
if (context.cursor >= context.tokens.length) {
    context.cursor = 0
    window.scrollTo(0, 0)
}


// start rendering
if (qs.get("paused") !== null) {
    context.paused = true
    controlButton.innerText = "play"
    fastForwardButton.style.display = 'inline-block';
}

// start rendering
mainLoop()