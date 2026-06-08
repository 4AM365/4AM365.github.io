---
title: Protecting & perfecting a cammed idle
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
**boring** — eliminating the scheduled disturbances that jolt it. In principle a
disturbance can be handled two ways: smooth it into a **PWM/airflow ramp slow enough
that it never outruns the idle PID**, or **move it outside the idle region entirely** so
the step never lands while you're holding a controlled idle.

> [!tip] The approach taken here: relocate, don't smooth
> On this build I moved **all three** of the usual offenders — VSS up-idle, A/C
> compressor, and the coolant fan — **well outside the idle region**, rather than asking
> the idle controller to absorb them. The most robust way to keep a transient from
> upsetting idle is to make sure it doesn't happen *at* idle in the first place.

What that looks like for the three offenders:

- **VSS up-idle (raising the idle target with road speed).** Rather than scheduling a
  target **step** at a speed threshold — which itself injects variation into a heat-soak
  idle every time you cross it — the speed-dependent behavior is kept out of the
  held-idle window, and the low-speed return-to-idle dip is owned by **airflow-PID
  authority** (PID output / integral ceilings) and a **faster PID update interval** (e.g.
  200 ms → ~50 ms). The idle you actually sit at sees no scheduled target jump.
- **A/C compressor.** The simplest possible fix: raise the **minimum A/C activation
  RPM** above the idle band so the clutch physically cannot engage while you're sitting
  at idle. The ~900 ms torque step never lands on a minimum-airflow idle because the
  compressor only comes on once the engine is already off idle and breathing. No idle-up
  schedule, no feed-forward to time — the disturbance is simply gated out of the window.
  Works just fine.
- **Coolant fan.** The fan is gated on CLT *and* road speed so it engages **while the car
  is still moving** (e.g. at ~70 °C below a speed threshold) instead of snapping on while
  you sit at a light. The steady-state airflow compensation for fan load (a fixed airflow
  adder) stays; what's removed is the *transient* of it engaging at idle.

The throughline: don't make the idle controller discover a disturbance the moment it
happens. Schedule each load to arrive somewhere other than a held idle — and where a
transient is unavoidable, ramp it slowly enough that the PID can ride it. Anything you
take off the idle controller's plate is variation it no longer has to chase.

## Dig into the notes

- [notes/idle_stall.md](https://github.com/4AM365/emu-black-tuning-notes/blob/master/notes/idle_stall.md) — the full stall-pattern troubleshooting tree and the conservative feed-forward principle
- [notes/cranking_and_idle.md](https://github.com/4AM365/emu-black-tuning-notes/blob/master/notes/cranking_and_idle.md) — cranking/idle architecture, actuator range setup, idle ignition reserve, ASE, long-cam strategy
- [notes/throttle_feel.md](https://github.com/4AM365/emu-black-tuning-notes/blob/master/notes/throttle_feel.md) — the idle-to-driving handoff and the off-throttle "parachute" trade-offs
- On-site: [[emu-black-log|diagnosing an idle stall from a log]], [[emu-black-actuator-rescale|airflow rescaling]]

Repo: [github.com/4AM365/emu-black-tuning-notes](https://github.com/4AM365/emu-black-tuning-notes)
