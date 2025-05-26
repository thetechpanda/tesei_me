// "use strict";
// LICENSE: GPL-v2.0

var ready = false

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
    let [zoom, kerning, height] = [1.5, -0.5, 2.5]
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
            g.charWitdh = 8 * zoom + kerning
            g.charHeight = 8 * zoom + height
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
    fps: 120,
    tsFPS: (new Date).getTime(),
    tsBlinker: (new Date).getTime(),
    visBlinker: false,
    mouse: {
        x: 0, y: 0, down: false, last: 0,
        timeout() { return (new Date).getTime() - context.mouse.last < 350 },
        risen() { context.mouse.last = (new Date).getTime() }
    },
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
    origY: 45,
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
     * updates canvas
     */
    updateCanvas() {
        glyph.charWitdh = 8 * glyph.zoom + glyph.kerning
        glyph.charHeight = 8 * glyph.zoom + glyph.lineHeight

        var printedLines = this.tokens.filter((v, i) => v == tags.EOL && i < this.cursor).length + 5
        canvas.height = Math.max(printedLines * glyph.charHeight, scr.height())
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
     * draws a string token on the canvas
     * @param {string} token string to print
     * @param {number} x 
     * @param {number} y 
     * @param {HTMLColor} color fill style for 2d context
     * @returns 
     */
    drawToken(token, x, y, color, zoom = glyph.zoom, charWidth = glyph.charWitdh) {
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
    collision(x, y, w, h) {
        let [m, x1, y1] = [context.mouse, x + w, y + h]
        let [r, l] = [Math.abs(m.x - x), Math.abs(m.x - x1)]
        let [collistion, pos] = [m.down && (m.x > x && m.x < x1 && m.y > y && m.y < y1), (l > r) ? -1 : Math.abs(l - r) > 30 ? 1 : 0]
        return [!m.timeout() && collistion, collistion ? pos : undefined /* invalid value */]
    },
    /**
     * prints HUD on the canvas
     */
    printHUD() {
        // glyph information
        let status = context.paused || context.cursor >= context.tokens.length ? "paused" : "playing"
        ctx.fillStyle = "black"
        let scrollY = scr.scrollY() + document.body.scrollTop
        ctx.fillRect(0, scrollY, scr.scrollX() + window.outerWidth, 60)
        ctx.font = "20px 'courier new'";
        ctx.fillStyle = "white"
        ctx.fillText(
            (new Date).toLocaleString() + " = " +
            "zoom: " + glyph.zoom.toFixed(2) + "x " +
            "kerning: " + glyph.kerning.toFixed(2) + "x " +
            "height: " + glyph.lineHeight.toFixed(2) + "x " +
            "scroll: " + scrollY.toFixed(2) + " " +
            "W x H: " + scr.width().toFixed(2) + " x " + scr.height().toFixed(2) + " "
            , 10, 20 + scrollY)
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
            ctx.font = "bold 20px 'courier new'";
            ctx.fillStyle = "green"
            let [cx, cy] = [(scr.width() + scr.scrollX()) - 170, 30 + scrollY]
            context.drawToken(status.toUpperCase(), cx, cy, "green", 3, 8 * 2.5)
        }

        const boxes = { "play": 120, "skip": 120, "reset": 120, "zoom": 140, "kerning": 175, "height": 160 }
        let xbox = 25
        for (let [box, w] of Object.entries(boxes)) {
            let [x, y, h] = [xbox, scrollY + 35, 24]
            let text = box
            let [collide, touchPos] = context.collision(x, y, w, h)

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

            switch (box) {
                case "zoom":
                    if (collide) {
                        if (touchPos == 1) {
                            glyphCtl.zoomUp()
                        } else if (touchPos == -1) {
                            glyphCtl.zoomDown()
                        }
                    }
                    text = `<  ${box}  >`
                    break
                case "kerning":
                    if (collide) {
                        if (touchPos == 1) {
                            glyphCtl.kerningUp()
                        } else if (touchPos == -1) {
                            glyphCtl.kerningDown()
                        }
                    }
                    text = `<  ${box}  >`
                    break
                case "height":
                    if (collide) {
                        if (touchPos == 1) {
                            glyphCtl.lineUp()
                        } else if (touchPos == -1) {
                            glyphCtl.lineDown()
                        }
                    }
                    text = `<  ${box}  >`
                    break
                case "play":
                    if (collide) {
                        glyphCtl.toggle()
                    }
                    text = !context.paused ? "pause" : "play"
                    touchPos = touchPos === undefined ? undefined : 0
                    break
                case "skip":
                    if (collide) {
                        glyphCtl.ffw()
                    }
                    touchPos = touchPos === undefined ? undefined : 0
                    break
                case "reset": {
                    if (collide) {
                        glyph.reset()
                    }
                    touchPos = touchPos === undefined ? undefined : 0
                    break
                }
            }
            context.drawButton(text, x, y, w, h, 'black', "whitesmoke", '', 5, '18px "courier new"')
            hl(x, y, w, h, touchPos)
            console.log(touchPos)
            ctx.fillStyle = "whitesmoke"
            ctx.textAlign = "center"
            ctx.font = '22px "courier new"'
            xbox += w + 25
            if (collide) {
                context.mouse.risen()
            }
        }

        if (context.mouse.down) {
            ctx.fillStyle = "green"
            ctx.globalAlpha = 0.1;
            ctx.beginPath();
            ctx.arc(context.mouse.x, context.mouse.y, 15, 0, 2 * Math.PI);
            ctx.fill();
            ctx.globalAlpha = 0.2;
            ctx.beginPath();
            ctx.arc(context.mouse.x, context.mouse.y, 10, 0, 2 * Math.PI);
            ctx.fill();
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.arc(context.mouse.x, context.mouse.y, 5, 0, 2 * Math.PI);
            ctx.fill();
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
        let elapsed = now - context.tsFPS;
        let interval = 1000 / context.fps
        context.clear()
        if (context.advanceFrame() === false) {
            // prints cursor on the last known token
            if ((now - context.tsBlinker) > 650) {
                context.visBlinker = !context.visBlinker
                context.tsBlinker = now
            }
            if (context.visBlinker) {
                context.drawRect(context.x - context.textCursorLength(), context.y + glyph.charHeight + 5, context.textCursorLength(), 2, "green")
                context.drawRect(context.x - context.textCursorLength(), context.y + glyph.charHeight + 3, context.textCursorLength(), 2, BACKGROUND_COLOR)
                context.drawRect(context.x - context.textCursorLength(), context.y + glyph.charHeight + 1, context.textCursorLength(), 2, "green")
            }
        }
        let nextThick = interval - elapsed
        context.tsFPS = now
        if (context.paused == false && context.tokens.length > context.cursor) {
            // todo: fix this on mobile.
            setTimeout(_ => { 
                window.scrollTo(0, Math.max(scr.scrollY(), canvas.height)) 
                context.printHUD()
            }, 0)
        }
        context.printHUD()
        setTimeout(context.main, nextThick > 0 ? nextThick : 0)
    })

}

const glyphCtl = {
    zoomUp(ev) {
        glyph.zoom += .25
        if (ev && ev.stopPropagation) { ev.stopPropagation() }
    },
    zoomDown(ev) {
        glyph.zoom -= .25
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
        if (ev && ev.stopPropagation) { ev.stopPropagation() }
        requestAnimationFrame(_ => {
            window.scrollTo(0, scr.scrollY())
        })
    },
    toggle(ev) {
        if (!context.paused) {
            console.debug("pausing")
            context.paused = true
        } else {
            console.debug("playing")
            context.paused = false
            if (context.cursor >= context.tokens.length) {
                context.cursor = 0
                window.scrollTo(0, 0)
            }
        }
        if (ev && ev.stopPropagation) { ev.stopPropagation() }
    }
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

const [move, down, up] = [
    (ev) => {
        context.mouse.x = ev.clientX + scr.scrollX()
        context.mouse.y = ev.clientY + scr.scrollY()
        ev.stopPropagation()
    },
    (ev) => {
        context.mouse.x = ev.clientX + scr.scrollX()
        context.mouse.y = ev.clientY + scr.scrollY()
        context.mouse.down = true
        ev.stopPropagation()
    },
    (ev) => {
        context.mouse.x = ev.clientX + scr.scrollX()
        context.mouse.y = ev.clientY + scr.scrollY()
        context.mouse.down = false
        ev.stopPropagation()
    }
]

document.body.addEventListener('mousemove', move)
document.body.addEventListener('mousedown', down)
document.body.addEventListener('mouseup', up)

document.body.addEventListener('touchmove', move)
document.body.addEventListener('touchstart', down)
document.body.addEventListener('touchend', up)