---
title: Protecting & perfecting a cammed idle
tags: [tuning, idle, dbw, stall, cams]
description: Why big-cam engines stall, how the EMU idle control architecture is meant to work, and the principles that make a cammed idle stable.
---

> [!abstract] The discovery
> A cammed idle is marginal by nature — high overlap means a heavily diluted, residual-
> rich charge that burns slowly and unevenly. Stability comes from getting the
> **architecture** right: airflow owns RPM, ignition is a fast trim, feed-forward is
> deliberately conservative, and every common stall maps to one specific, diagnosable
> cause. Tune the cause, not the symptom.

## The architecture (EMU Black v3)

The single biggest mental shift: **airflow PID is the primary RPM controller; ignition
timing is fast-path fine-tuning only** (the opposite of older setups). On a 264° cam
the engine barely responds to timing at idle anyway — so timing is run **flat (~16°)**
and the airflow target does the work. Layered on top:

- An **active-state airflow** table (the feed-forward base the PID rides on, above
  400 RPM).
- A separate **cranking airflow** table below 400 RPM, pre-positioned so the handoff at
  400 RPM has **no step** — a step would take multiple ~740 ms manifold time constants
  to settle and disturb RPM.
- An **armed-state** table for the overrun window before idle PID engages.

## Why cammed engines stall — and the fix

The notes catalog the stall patterns; nearly every one is a specific, logged cause:

- **Overrun-to-idle (the most common):** armed-state airflow resolves too low at the
  decel RPM bins, the DBW motor fights its return spring at −80% DC with no useful air,
  and fuel returns into a near-zero air column → rich stumble → stall. **Fix:** populate
  armed-state airflow at **60–80% at 1800–2200 RPM**, tapering seamlessly into the idle
  value — no step. The rich spike is a *symptom*; it disappears when the air is there.
- **Tip-in stall:** a gap between idle airflow control and the DBW blend values. **Fix:**
  set the actuator floor just below steady hot-idle TPS, and the blend point just above
  idle PPS.
- **Cold-start slam:** throttle snaps from ~14% cranking TPS to ~3% idle TPS faster than
  ASE can cover. **Fix:** hold an elevated post-start RPM target for 5–10 s — don't cut
  ASE.
- **Warm stall with no trigger:** usually base VE lean at idle while ASE masks it until
  it decays, or the idle PID never engaging (a stuck brake switch pins idle state at 0).
- **Hunt-then-stall:** noisy VVT-i or CLT — three feedback loops fighting. Lock those
  down before touching calibration.

## The principle that ties it together

**Feed-forward should be conservative; the PID does the rest.** Bias open-loop
corrections toward *under*-correction — apply roughly half the airflow change the engine
needs and let closed-loop ease in the remainder. The asymmetry is the whole point:

| Failure | Result |
|---|---|
| Feed-forward under-corrects | brief high idle, PID trims it down — **safe** |
| Feed-forward over-corrects | commands too little air, hits the actuator floor before the PID can recover — **stall** |

This matters most for corrections keyed on sensor *proxies* (CAT for throttle-body temp),
step loads (fan, A/C, alternator), and anything that crosses stall margin — exactly where
a cammed idle already lives near the floor. Keep integrator limits **below** proportional
limits so the slow integrator can't trap the engine in a low-air state.

## Removing every source of variation

A cammed idle has almost no margin, so the real work is making the operating point
**boring** — eliminating the scheduled disturbances that jolt it. Every load or target
change that lands while the engine is sitting at a controlled idle is a candidate to
either *smooth* or *relocate*. The rule:

> [!tip] Two ways to handle a disturbance
> **Either** add it as a **smooth PWM/airflow ramp that does not outrun the idle PID**
> — sized conservatively, timed to the load's mechanical engagement, so the PID keeps
> authority in both directions — **or move it outside the idle region entirely**, so the
> step never arrives while you're holding a controlled idle.

What this looks like for the three usual offenders:

- **VSS up-idle (raising the idle target with road speed).** This is the tempting one to
  *avoid*. A VSS-scheduled target bump injects a **target step** into the controller every
  time you cross the threshold — exactly the kind of scheduled variable that makes a
  heat-soak idle wander. The better fix for the low-speed return-to-idle dip it was meant
  to paper over was **more airflow-PID authority** (raise the PID output / integral
  ceilings) and a **faster PID update interval** (e.g. 200 ms → ~50 ms), not a target
  step. Prefer tightening the loop you already have over adding a new scheduled input.
- **A/C compressor kick-on.** A clutch engages in well under a second (~900 ms on this
  inline-six), so the airflow correction has to **lead the load** and ramp, not arrive as
  a late slug of air. EMU's custom correction handles it well *if* the feed-forward is
  timed to engagement and sized conservatively — the airflow change must trail the load by
  *less* than the lag of the load's torque effect, or you over-add before the compressor
  actually bites. Under-correct and let the PID finish.
- **Coolant fan kick-on.** A radiator fan is a big, abrupt alternator/torque step. The
  clean move is to **relocate it out of the idle window**: gate engagement on CLT *and*
  road speed so the fan comes on **while the car is still moving** (e.g. at ~70 °C below a
  speed threshold) instead of snapping on while you sit at a light. The steady-state
  airflow compensation for fan load (a fixed airflow adder) is correct and stays — what
  you remove is the *transient* of it engaging at idle.

The throughline: don't let the idle controller discover a disturbance the moment it
happens. Anticipate it with a ramped feed-forward the PID can ride, or schedule it to
occur somewhere other than a held idle. Anything you can take off the idle controller's
plate is variation it no longer has to chase.

## Dig into the notes

- [notes/idle_stall.md](https://github.com/4AM365/emu-black-tuning-notes/blob/master/notes/idle_stall.md) — the full stall-pattern troubleshooting tree and the conservative feed-forward principle
- [notes/cranking_and_idle.md](https://github.com/4AM365/emu-black-tuning-notes/blob/master/notes/cranking_and_idle.md) — cranking/idle architecture, actuator range setup, idle ignition reserve, ASE, long-cam strategy
- [notes/throttle_feel.md](https://github.com/4AM365/emu-black-tuning-notes/blob/master/notes/throttle_feel.md) — the idle-to-driving handoff and the off-throttle "parachute" trade-offs
- On-site: [[emu-black-log|diagnosing an idle stall from a log]], [[emu-black-actuator-rescale|airflow rescaling]]

Repo: [github.com/4AM365/emu-black-tuning-notes](https://github.com/4AM365/emu-black-tuning-notes)
