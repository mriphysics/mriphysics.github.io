# Direct Signal Control

**This set of methods is based on designing entire sequences of RF pulses together, focusing on the important thing - the *signal* - as the subject of the optimization. The main example so far has been dynamic RF shimming of Fast Spin Echo sequences.**
##Contents
* [**Optimal Control EPG**](#optepg)
* [**EPG vs Isochromat simulations**]() *(coming soon)*
* [**Driven Equilibrium EPG**]() *(coming soon)*

<a name="optepg"></a>

##[Optimal Control EPG](https://github.com/mriphysics/optimal-control-EPG/)
This work by [Alessandro Sbrizzi (UMCU)](http://www.umcutrecht.nl/en/Research/Research-programs/UMC-Utrecht-Center-for-Image-Sciences/Research-programs/Ultra-high-field-MRI-7-Tesla/High-Precision-Medical-Imaging) builds on the *direct signal control* concept (see [this](http://dx.doi.org/10.1002/mrm.25192) paper, and [this](http://dx.doi.org/10.1002/mrm.25192) one) but treats the design problem using optimal control methods, rather than simple numerical optimization. The result is highly accelerated and much stabler calculation.