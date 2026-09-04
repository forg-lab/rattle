# 8 - synths and effects
#
# Synths:    sine  tri  saw  square  pulse  fm  pluck
# Envelope:  attack, decay, sustain, release   (in beats)
# Filter:    cutoff (a MIDI note number, so 100 is high), res
# Space:     room, pan, amp
#
# The log pane on the right names each synth as it comes round.

use_bpm(88)

@live_loop("tour")
def tour():
    for name in ["sine", "tri", "saw", "square", "pulse", "fm", "pluck"]:
        use_synth(name)
        log(name)
        play("a3", amp=0.4, release=0.8, cutoff=100, room=0.35)
        sleep(1)

@live_loop("bed", sync="tour")
def bed():
    use_synth("sine")
    play(chord("a2", "minor"), amp=0.14, attack=1.5, release=3, room=0.8)
    sleep(4)
