# Recorded samples

These come from [Sonic Pi](https://sonic-pi.net)'s bundled sample set, which
its authors released under the
[CC0 1.0 public domain dedication](https://creativecommons.org/publicdomain/zero/1.0/).
Sonic Pi in turn took most of them from [freesound.org](https://freesound.org),
where their creators had placed them in the public domain. Thank you to all of
them.

For rattle each file was mixed down to mono, peak-normalised to -1 dBFS and
encoded as 96 kbps MP3 - 160 kbps with no low-pass for the cymbals and the bell,
which at 96 kbps lost most of their sound above 16 kHz. The long ones (`ride`,
`bell`, `guitar`) were cut short with a fade.

| rattle name | Sonic Pi sample | freesound creator |
|---|---|---|
| `kick` | `drum_heavy_kick` | Zajo |
| `808` | `bd_808` | EKVelika |
| `snare` | `drum_snare_hard` | menegass |
| `hihat` | `drum_cymbal_closed` | menegass |
| `openhat` | `drum_cymbal_open` | menegass |
| `crash` | `drum_cymbal_hard` | menegass |
| `ride` | `ride_tri` | trivialAccapella |
| `cowbell` | `drum_cowbell` | Neotone |
| `hitom` | `drum_tom_hi_hard` | menegass |
| `lotom` | `drum_tom_lo_hard` | menegass |
| `tabla_na` | `tabla_na` | dio_333 |
| `tabla_tun` | `tabla_tun1` | dio_333 |
| `tabla_ghe` | `tabla_ghe1` | dio_333 |
| `snap` | `perc_snap` | SoundCollectah |
| `bell` | `perc_bell` | AlaskaRobotics |
| `piano` | `ambi_piano` | RutgerMuller |
| `choir` | `ambi_choir` | Exsomniel |
| `bass` | `bass_hard_c` | ani_music |
| `guitar` | `guit_em9` | Sub-d |
| `amen` | `loop_amen` | Dolfeus |
| `scratch` | `vinyl_scratch` | hello_flowers |

The list of names lives in `src/dsl.js` (`RECORDED`); a test checks that every
name there has a file here.
