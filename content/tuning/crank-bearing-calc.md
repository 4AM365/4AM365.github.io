---
title: Crank Bearing Stress Calculator
tags:
  - cars
  - engine
  - calculator
status: seedling
---

A simple bearing stress solver based on inputs. Set the engine geometry, combustion, oil and
camshaft, and it estimates main and rod bearing loads, oil film thickness, wrist pin stress, rod
buckling, and the torque at which the bearings reach their rating.

Defaults are a turbocharged 1FZ-FE on E85: factory oil clearances, ACL Race bearings, Manley 14005
H-beam rods, stock cams. Inputs marked "est." are estimates.

Each tab has an Equations panel with the formulas it uses. Results are best used to compare one
setting against another. Not modelled: knock, bearing shell elasticity, thermal distortion,
torsional vibration, oil aeration.

<div data-widget="crank-bearing-calc"></div>
