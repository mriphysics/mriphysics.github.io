# Introductory MRI Physics: supplementary animations

## Tipping of Magnetization by RF field

An applied B1 field will tip M into the transverse plane.
This appears as a spiraling rotation in the laboratory frame of reference:

<img src="images/excite_labframe.gif" width="50%">

It is useful to view the same process in a frame of reference rotating at the Larmor frequency:

<img src="images/excite_rotframe.gif" width="50%">

### Relaxation Effects

Magnetization returns to thermal equilibrium by multiple means, resulting in longitudinal recovery with time constant T1 and transverse decay with time constant T2.

#### Longitudinal relaxation

<img src="images/M_bloch_t1.gif" width="50%">

#### Transverse relaxation

<img src="images/M_bloch_t2graph.gif" width="50%">

Transverse relaxation can be subdivided into irreversible decay due to random interactions (T2):

<img src="images/M_bloch_t2.gif" width="20%">

and reversible decay due to microscopic (but constant) field perturbations (T2'):

<img src="images/M_bloch_t2prime.gif" width="20%">

The reversible decay can be recovered by applying a second RF pulse to form a **SPIN ECHO**
<img src="images/M_spin_echo.gif" width="90%">

## Spatial Encoding

### Gradient Waveforms
Applied gradient fields can be characterized by a time variable waveform:

<img src="images/output_sDdnMn.gif" width="90%">


### Spin Warp method

After excitation, when viewed in the rotating frame we have stationary magnetization in the transverse plane:

<img src="images/spinwarp1.png" width="25%">

If a gradient is applied in the x-direction (Left to Right) we get spatial variation in precession frequency that means some move faster and some slower than the Larmor frequency. In the rotating frame this is seen as a slow drift:

<img src="images/spinwarp_Gx.gif" width="25%">

If a gradient is applied in the y-direction, the same is true:

<img src="images/spinwarp_Gy.gif" width="25%">

**Phase Encoding** involves applying gradients first in one direction and then another. This is best described in the k-space formalism, however we can visualise the effect of applying a y-directed gradient followed by x below:

<img src="images/spinwarp_Gyblip2_Gx.gif" width="25%">



(c) Shaihan Malik 2016
