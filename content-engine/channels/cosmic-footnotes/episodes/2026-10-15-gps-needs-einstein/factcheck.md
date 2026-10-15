---
episode: 2026-10-15-gps-needs-einstein
channel: cosmic-footnotes
status: pending
script_hash: 33b59bf0772d30220e3f86f31b724c893be6a9a86bd410dce425c205f06b43d8
generated_at: 2026-10-15T13:54:50Z
approved_by: null
approved_at: null
notes: null
---

# Fact-check: Your phone needs Einstein

**Nothing renders until a person approves this list.** Check each claim against its source, and read the
full transcript below for anything the list missed.

- Approve: `./engine approve factcheck --channel cosmic-footnotes --episode 2026-10-15-gps-needs-einstein --by "<your name>"`
- Ask for changes: `./engine reject factcheck --channel cosmic-footnotes --episode 2026-10-15-gps-needs-einstein --reason "<which claim and why>"`

## Claims (8)

### c1 · high confidence · beat `clue`
> GPS satellites orbit at an altitude of about 20,200 km (said as 'about twenty thousand kilometres').
- **Source:** https://www.gps.gov/systems/gps/space/ (medium Earth orbit, approximately 20,200 km)
- **Note:** On screen: "20,000 km up".

### c2 · high confidence · beat `clue`
> Each GPS satellite carries atomic clocks.
- **Source:** https://www.gps.gov/systems/gps/space/ ; Ashby, N. (2003) 'Relativity in the Global Positioning System', Living Reviews in Relativity 6:1

### c3 · high confidence · beat `story`
> Relativity predicts clocks run faster where gravity is weaker (general relativity) and slower when moving fast (special relativity).
- **Source:** Ashby 2003, Living Reviews in Relativity 6:1; Ohio State Univ. Astronomy 162 (R. Pogge), 'Real-World Relativity: The GPS Navigation System'

### c4 · high confidence · beat `story`
> Weaker gravity at orbit makes GPS clocks gain about 45 microseconds a day; their orbital speed makes them lose about 7, so they gain about 38 microseconds a day overall.
- **Source:** R. Pogge, Ohio State Univ. Astronomy 162, 'Real-World Relativity: The GPS Navigation System' (45 − 7 = 38 µs/day); Ashby 2003
- **Note:** On screen: "+45 µs a day", "-7 µs a day", "+38 µs a day".

### c5 · high confidence · beat `point`
> GPS receivers work out position from how long the satellites' signals take to arrive.
- **Source:** https://www.gps.gov/systems/gps/ ; Ashby 2003

### c6 · high confidence · beat `point`
> Light travels about 300 metres in a microsecond (299.79 m).
- **Source:** Speed of light 299,792,458 m/s (exact, SI definition): https://physics.nist.gov/cgi-bin/cuu/Value?c
- **Note:** On screen: "300 m per µs".

### c7 · high confidence · beat `point`
> Without the relativity correction, GPS position errors would grow by more than 10 km per day.
- **Source:** R. Pogge, Ohio State 'Real-World Relativity' (about 10 km/day); Ashby 2003 (range error ≈ 11.6 km/day); 38 µs × c ≈ 11.4 km
- **Note:** Sources give 10–11.6 km/day, so the script says 'more than ten kilometres'. On screen: "10+ km off".

### c8 · high confidence · beat `kicker`
> Engineers set the satellite clocks to tick slightly slow before launch (10.22999999543 MHz instead of 10.23 MHz) to cancel the effect.
- **Source:** Ashby 2003, Living Reviews in Relativity 6:1 (factory frequency offset); GPS World, 'Inside the Box: GPS and Relativity'

## Full transcript

| Beat | Voiceover | On screen |
|---|---|---|
| `hook` | Your phone needs Einstein. | Your phone needs Einstein |
| `clue` | Your map finds you using satellites about twenty thousand kilometres up. Each one carries an atomic clock. And up there, those clocks run fast. |  |
| `story` | Einstein said time runs faster where gravity is weaker. Up there, that adds about forty-five millionths of a second a day. Their speed takes away about seven. So every day, they gain thirty-eight millionths of a second. |  |
| `point` | That sounds like nothing. But your phone works out where you are from how long the signals take to arrive. Light travels about three hundred metres in a millionth of a second. Ignore Einstein, and your map would drift by more than ten kilometres every single day. |  |
| `kicker` | So engineers set the clocks to tick a little slow before launch. Your phone really does need Einstein. |  |

## Other text shown on screen

- Your phone needs Einstein #shorts
- GPS satellite clocks gain 38 millionths of a second a day. Here's why that would throw your map off by kilometres — and how Einstein fixes it.
- 20,000 km up
- fast!
- +45 µs a day
- -7 µs a day
- +38 µs a day
- tiny!
- 300 m per µs
- 10+ km off
