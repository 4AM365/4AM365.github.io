---
title: Crank Bearing Stress Calculator
tags:
  - cars
  - engine
  - calculator
status: seedling
---

How much torque will the crank bearings take? I built this to answer that for the 1FZ-FE in my
Land Cruiser: ACL Race bearings, factory oil clearances, a turbo, and ethanol. The defaults are that
engine. Change them and it works for any inline six.

It starts from combustion. Spark timing, fuel, lambda, dilution, mixing and boost set how fast the
flame burns. Boost lowers the laminar flame speed but thins the flame front, so the turbulent burn
actually speeds up and the pressure peak gets taller and narrower. That pressure goes through the
slider-crank, pin offset included, and becomes rod force, side thrust on the bore and crank pin load.
The crank is modelled as a beam on seven elastic main caps, so crank stiffness and cap rigidity
decide how the load splits between the mains. The oil film in each bearing comes from Booker's
mobility method. Viscosity follows the oil grade and a film temperature that depends on oil
pressure. The tabs break out the rod bearing (unit load against peak oil-film pressure), the wrist
pin and rod buckling.

Treat it as a comparison tool. Several inputs are estimates and are marked "est." Trust the
difference between two settings more than any one absolute number. It does not model knock, bearing
shell elasticity, thermal distortion, torsional vibration or oil aeration.

<div data-widget="crank-bearing-calc"></div>
