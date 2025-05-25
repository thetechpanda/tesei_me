# my personal website

TL;DR; time waster weekend project.

This text is rendered using an IBM AS/400-style 8x8 bitmap font.

The text is tokenized and stuffed with tags that specify changes in foreground color for the next token. Each token is then rendered to the canvas using the bit matrix stored in each available font character.

A single requestAnimationFrame is used, which calls context.advanceFrame. This method renders all tokens currently on screen,then proceeds to print any remaining tokens.

The buttons at the bottom allow you to adjust the glyph configuration, which controls zoom, kerning (spacing between letters), and line height (spacing between lines).

If you zoom in a lot, you'll notice some imperfections in my math 😝

When paused a cursor is shown under the last printed token.
