// GPLv3+

package main

import (
	"flag"
	"fmt"
	"github.com/gorilla/mux"
	"net"
	"net/http"
	"os"
	"log"
	"strings"
	//"time"
	"encoding/json"
	"io/ioutil"
	"github.com/galaktor/gostwriter"
	"github.com/galaktor/gostwriter/key"
)

var (
	router *mux.Router = mux.NewRouter()
	//kb *gostwriter.Keyboard
)

type InputEvent struct {
	Action string //keydown, keyup....
	Key string //A, PageUp, LeftMouse
	X float64 // used for some Actions
	Y float64
}
// for now, send all queued, wait for rsvp, repeat
// which has more latency than needed but is probably fine on lan
type InMessage struct {
	InputEvents []InputEvent
}

// TODO handle key repeat in a way that is reasonable wrt netsplits
func processMessages(c chan InMessage) {
	kb, err := gostwriter.New("foo"); guard(err);
	defer kb.Destroy()

	for {
		input := <-c
		for _, ie := range input.InputEvents {
			hilarioustest(kb, ie)
		}
	}
}

func main() {
	flag.Parse()
	sockpath := flag.Arg(0)
	if sockpath == "" {
		log.Fatal("must specify socket path on command line")
	}

	c := make(chan InMessage)
	go processMessages(c)

	router.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// already in nginx config:
		//w.Header.Add("X-Frame-Options", "DENY")
		//w.Header.Add("X-Robots-Tag", "noarchive, noindex, nosnippet")
		//w.Header.Add("Cache-Control", "no-cache")
		//w.Header.Add("P3P", "CP=\"This is not a P3P policy\"")
		//w.Header.Add("X-UA-Compatible", "IE=edge")

		good := true
		good = good && r.Method == "POST"

		// Checking for HTTPS won't work here in that we are behind nginx
		// and the nginx--golang connection is over unix socket, not TCP+TLS.

		// Redundant with nginx config but that is okay:
		good = good && len(r.Header["X-Not-Cross-Domain"]) == 1 && r.Header["X-Not-Cross-Domain"][0] == "yes"

		// Checking Origin/Referer is already in nginx config,
		// and requires knowing the domain/port.

		// nginx is doing HTTP Basic Auth. Given that, this is silly,
		// in addition to being a non-constant-time comparison,
		// with the password committed to code.
		//good = good && len(r.Header["X-Token"]) == 1 && r.Header["X-Token"][0] == "badpassword"
		if !good {
			w.WriteHeader(403)
			fmt.Fprintf(w, "<h1>403</h1>")
			return
		}

		var input InMessage
		body, err1 := ioutil.ReadAll(r.Body)
		err2 := json.Unmarshal(body, &input)
		good = good && err1 == nil && err2 == nil
		if !good {
			w.WriteHeader(400)
			fmt.Fprintf(w, "<h1>400</h1>")
			return
		}

		c <- input
		w.WriteHeader(204)
	})

	os.Remove(sockpath) // (does nothing if absent)
	l, err := net.Listen("unix", sockpath); guard(err);
	err = os.Chmod(sockpath, 0770); guard(err);
	defer l.Close()
	err = http.Serve(l, router); guard(err);
}


// CODE_RESERVED if none match
func keycodeFromName(name string) key.Code {
	switch strings.ToLower(name) {
		case "a": return key.CODE_A
		case "b": return key.CODE_B
		case "c": return key.CODE_C
		case "d": return key.CODE_D
		case "e": return key.CODE_E
		case "f": return key.CODE_F
		case "g": return key.CODE_G
		case "h": return key.CODE_H
		case "i": return key.CODE_I
		case "j": return key.CODE_J
		case "k": return key.CODE_K
		case "l": return key.CODE_L
		case "m": return key.CODE_M
		case "n": return key.CODE_N
		case "o": return key.CODE_O
		case "p": return key.CODE_P
		case "q": return key.CODE_Q
		case "r": return key.CODE_R
		case "s": return key.CODE_S
		case "t": return key.CODE_T
		case "u": return key.CODE_U
		case "v": return key.CODE_V
		case "w": return key.CODE_W
		case "x": return key.CODE_X
		case "y": return key.CODE_Y
		case "z": return key.CODE_Z
		case "0": return key.CODE_0
		case "1": return key.CODE_1
		case "2": return key.CODE_2
		case "3": return key.CODE_3
		case "4": return key.CODE_4
		case "5": return key.CODE_5
		case "6": return key.CODE_6
		case "7": return key.CODE_7
		case "8": return key.CODE_8
		case "9": return key.CODE_9
		case " ", "space": return key.CODE_SPACE
		case "-": return key.CODE_MINUS
		case "=": return key.CODE_EQUAL
		case "backspace": return key.CODE_BACKSPACE
		case "tab", "\t": return key.CODE_TAB
		default: return key.CODE_RESERVED
	}
}

// uses the 't', 'e' and 's' keys to write 'test' to the
// console ten times. then it uses the 'ctrl' and 'c' keys
// to kill itself by emulating a 'CTRL+C' command
func hilarioustest(kb *gostwriter.Keyboard, ie InputEvent) {
	if ie.Action == "keydown" || ie.Action == "keyup" {
		code := keycodeFromName(ie.Key)
		var k *gostwriter.K
		var err error
		if code != key.CODE_RESERVED {
			k, err = kb.Get(code); guard(err);
			log.Println("known key")
			if ie.Action == "keydown" {
				press(k)
			} else {
				release(k)
			}
		} else {
			log.Println("unknown key")
		}
	} else {
		log.Println("unknown action")
	}
	/*var f int
	f, err := kb.Get(key.CODE_T)
	q, f := kb.Get(key.CODE_T)
	f = key.CODE_T
	//keys  map[string]*gostwriter.K
	t, err    := kb.Get(key.CODE_T);         guard(err);
	e, err    := kb.Get(key.CODE_E);         guard(err);
	s, err    := kb.Get(key.CODE_S);         guard(err);
	//ret, err  := kb.Get(key.CODE_ENTER);     guard(err);

	//ctrl, err := kb.Get(key.CODE_LEFTCTRL);  guard(err);
	shift, err:= kb.Get(key.CODE_LEFTSHIFT); guard(err);
	//c, err    := kb.Get(key.CODE_C);         guard(err);
	n1, err   := kb.Get(key.CODE_1);         guard(err);

	log.Println("this demo will type the word 'test' and a newline 10 times")
	log.Println("then it will terminate itself by pressing CTRL + C")

	<-time.After(time.Millisecond*1000)
	push(t)
	push(e)
	push(s)
	push(t)
	press(shift)
	push(n1)
	release(shift)*/
/*
	cnt := 0
	for {
		<-time.After(time.Millisecond*100)
		push(t)
		<-time.After(time.Millisecond*100)
		push(e)
		<-time.After(time.Millisecond*100)
		push(s)
		<-time.After(time.Millisecond*100)
		push(t)
		<-time.After(time.Millisecond*500)
		push(ret)
		
		if cnt = cnt + 1; cnt == 10 {
			press(ctrl)
			press(c)
		}
	}
*/
}

// presses and subsequently releases a key
func push(k *gostwriter.K) {
	err := k.Push(); guard(err);
}

// presses a key, if not already pressed. does not release
func press(k *gostwriter.K) {
	err := k.Press(); guard(err);
}

// releases a key, if not aready released.
func release(k *gostwriter.K) {
	err := k.Release(); guard(err);
}

// TODO consider which errors to tolerate
// contains boilerplate error check. if error is present,
// prints it then exits the app
func guard(e error) {
	if e != nil {
		log.Fatal(e)
	}
}
