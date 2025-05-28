// package v_downunder
//
// License: GPL-v2.0
//
// Welcome Traveller,
//
// package v_downunder is what happens when you want to update your website and;
//   - 1. you're too lazy to download a template.
//   - 2. to make any effort whatsoever.
//   - 3. you know that nobody will visit it anyway.
//   - 4. you'd go any length not to use react.
//
// Nope, that's not that code. This is just a tribute.
package v_downunder

import (
	"crypto/rand"
	"fmt"
	"math/big"
)

// todo: premature optimisation.

// Range as the name says is a range. What insight were you expecting?
type Range[T any] [2]T

// ToRange as the name says returns a range.
func ToRange[T any](from, to T) Range[T] {
	return [2]T{from, to}
}

const (
	/* My */
	Name = /* is */ "Valerio"

	/* You can */
	Contact = /* me at */ "v [at] tesei.me"
	// Do real people still use emails?

	/* I */
	Work = /* as a */ "Software Engineer"
	// Like anybody would go to my site to know what I do.

	/* And I live */
	DownUnder = /* in */ "Australia"
)

// Pleasure to meet you.
var (
	// Now that we are acquainted, Do you know why people have personal websites?
	// Isn't is just data brokers' free real estate?

	// Back on track; my interest? Do you really care?
	AboutMe = []string{
		"I know about networking",
		"I know my way around Linux and Docker; in general, I know how to read a manual",
		// bug: mostly IKEA forniture manuals.
		"I once made a living with the LAMP stack",
		"I like JavaScript, but I don't want it on the server side",
		"I don't understand TypeScript, especially when it's untyped",
		// todo: collect dislikes for SQL in the list below? ORM are a blight
		"C, C++, C#, Perl, SQL, and PHP are all languages I've used professionally at least once",
		// todo: implement clapping.
		"Right now I'm in love with Go",
		"If you've made it this far, I don't need to tell you I'm a nerd",
		"I've published a card game! Google 'The Cemetery Game'!",
		// todo: shill the game more
		"I love comics too, like the full geek spectrum",
		// todo: am I too old to be a geek? Investigate.
		"The question is: what are you still doing here?",
		// I mean my code is good but ain't that good.
	}

	// Thanks for your continued support, I feel bad for you, you read it all
	// I'll reward you with absuolutely useless information you most defintely don't care about.
	Expirience = map[Range[int]]string{
		ToRange(2002, 2006): "Software Developer: Linet S.r.l., Italy",
		ToRange(2006, 2008): "Head of Research & Develop: Sentinel S.r.l., Italy",
		ToRange(2008, 2010): "Lead Developer: Fast-Labs S.r.l., Italy",
		ToRange(2010, 2011): "Lead Developer: Klaustech Europe S.r.l., Italy",
		ToRange(2008, 2012): "Software Developer, Tech Consultant: RDSLab S.r.l, Italy & Brasil",
		ToRange(2012, 2023): "Software Developer, Tech Lead, CIO: AVANSER Pty Ltd, Austrlia",
		// todo: update when new experience is acquired.
	}
)

// todo: find something better to do when I get bored, I don't think web design is my thing.
func Usage() {
	fmt.Println("Hi my name is", Name, "and I am a", Work, "from", DownUnder, "and")

	var fact string
	if m, err := rand.Int(rand.Reader, big.NewInt(int64(len(AboutMe)))); err != nil {
		panic("no more entropy in the universe, " + err.Error())
	} else {
		fact = AboutMe[m.Int64()]
	}

	fmt.Println("that", fact, "and")
	if m, err := rand.Int(rand.Reader, big.NewInt(int64(len(Expirience)))); err != nil {
		panic("no more entropy in the universe, " + err.Error())
	} else {
		c := 0
		for k, v := range Expirience {
			if c == int(m.Int64()) {
				fmt.Println("that between ", k[0], " and ", k[1], "I was", v)
				break
			}
			c++
		}
	}
}
