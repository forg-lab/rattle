# 1 - hello
#
# Cmd+Enter (Ctrl+Enter) runs the buffer. Cmd+. stops it.
# Change any number below and run again: the beat carries straight on.

use_bpm(96)

@live_loop("beat")
def beat():
    sample("bd")
    sleep(1)

@live_loop("melody", sync="beat")
def melody():
    play("c4", release=0.4)
    sleep(0.5)
    play("e4", release=0.4)
    sleep(0.5)
    play("g4", release=0.4)
    sleep(1)
