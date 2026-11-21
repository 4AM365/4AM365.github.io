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

Two engine presets: a turbocharged 1FZ-FE on E85 (factory clearances, ACL Race bearings, Manley
14005 H-beam rods, Kelford cam options) and a turbocharged 2JZ on E60 (stock bottom end, Brian
Crower 264° cams). Inputs marked "est." are estimates.

The Maps tab works backwards from a torque target: for each rpm it solves the boost and ignition
timing needed, pulling timing where the rod or main bearing would pass its rating, and lays the
result out as EMU Black ignition and boost-target tables.

Each tab has an Equations panel with the formulas it uses. Results are best used to compare one
setting against another. Not modelled: knock, bearing shell elasticity, thermal distortion,
torsional vibration, oil aeration.

<div data-widget="crank-bearing-calc"></div>
