# Bridge Builder Game Design Research
**Date:** 2026-05-21
**Audience:** Kids (target age 7–11)
**Reference games:** Poly Bridge 1/2/3, Bridge Constructor Playground, Cargo Bridge, World of Goo, Bridgy Jones

---

## What Makes Supports Actually Necessary (Not Optional)

### The Core Problem
Players always try the laziest valid structure first — a flat road span. Good games force that to fail in a way that immediately communicates *why* it failed and *what class of fix* is needed.

### How the Best Games Solve It

**Physics-enforced necessity (Poly Bridge series)**
Every beam has a stress limit. A flat road spanning a medium gap visibly deforms and snaps under vehicle weight. The stress colour system (green → yellow → orange → red) shows the problem while it is happening, not just when it catastrophically fails. Players see the mid-span road go red *before* it breaks. Adding a diagonal strut below the midpoint immediately shifts that section from red back to green.

Key design decision: **all materials weigh the same in Poly Bridge.** This is deliberate — players focus on shape and geometry, not "use heavier material and it'll be fine." Cognitive load reduction.

**Anchor point constraint (Cargo Bridge)**
Fixed anchor points on terrain plus a finite budget. You cannot just add more material — you must route forces efficiently to those anchors. This implicitly requires triangles because the only way to transfer vertical load to a horizontal anchor is with a diagonal member. Players discover triangles through experience, not instruction.

**Gap width as the main difficulty dial**
A 4-metre gap can be spanned with flat road and survive a light car. A 12-metre gap cannot. Graduated exposure: "flat road works" is the player's first mental model, then gap width gradually invalidates it.

### Why Supports Feel Satisfying (Not Just Necessary)
- **Immediate visual payoff:** watch a failing bridge turn green as you add one support
- **Cost optimisation bonus layer:** completing under budget = higher rating, creating a second-pass incentive
- **Failure is entertainment:** Poly Bridge 3 made collapse ragdoll-style and spectacular — failure is fun, not shame

---

## Explaining Structure to Kids Without Engineering Words

### Visual Language That Works

| Engineering word | Kid-friendly equivalent used in games |
|---|---|
| Stress / load | Colour on the beam itself (green = safe, red = danger) |
| Structural failure | "This bridge isn't safe enough for the truck" |
| Tension / compression | Not named — the cable falls apart vs. the strut holds |
| Triangulation | "Triangle" — named once, discovered first |
| Shear force | Never mentioned |

**Colour-as-health:** Green = safe, red = danger. Maps to traffic lights kids already know. No word "stress" needs to appear. The beam itself warns you before it breaks.

**Material visual distinction (Poly Bridge):** Road is rendered thick and black. Wood beams are brown/tan. Cables are thin grey lines. Players learn the difference between "thing the car drives on" and "thing holding it up" through visual difference alone — no label required.

**The car demonstrates the rules:** Players accidentally build a diagonal wooden beam and the car tries to drive up it and crashes. They stop using wood as road. No jargon required.

**World of Goo's approach (most accessible for young kids):** No UI numbers at all. The goo balls *stretch* visually under tension. When overloaded, they wobble and pull apart before breaking. Players as young as 6–7 can play because the physics *looks like physics*.

**Cargo Bridge's approach:** Workers physically walk across the bridge. When a section sags, you see them tilting and struggling. When it collapses, you see them fall (with a comedic shriek). Failure is embodied in characters, not abstract metrics.

---

## Typical Progression and the Engineered "Aha Moment"

### The Standard Level Arc (Across All Major Games)

**Phase 1 — Levels 1–3: Flat works.**
Short gap, light vehicle. Simple road span passes. Goal: let players feel competent and understand the build → test loop. No support needed. The game rewards confidence.

**Phase 2 — Levels 4–7: Flat no longer works.**
Gap is wider OR vehicle is heavier. Flat road bends red and snaps. Car falls. Stress colours show mid-span is red. Players add *anything* to the middle and discover it helps. The game validates the impulse without prescribing the form.

**Phase 3 — Triangle discovery.**
A level is structured so the natural solution — adding a downward strut from mid-span to the canyon floor, or an upward strut to a higher anchor — creates an accidental triangle. The bridge passes. The player may not even realise what they built. Subsequent levels repeat this geometry until the pattern generalises.

**Phase 4 — Named concept.**
Later tutorials or badge challenges explicitly name "triangle" as the target. Players recognise it as the thing that has been working. The name sticks because the experience came first.

### The Designed "Aha Moment"
The sequence every successful game engineers:
1. Player builds flat road → it sags → snaps → car falls
2. Stress colour showed red at the middle before it broke
3. Player adds one diagonal piece from the middle down to an anchor → **whole span turns green**
4. Car crosses

That moment — one piece changes everything from red to green — teaches force distribution better than any explanation. The game should engineer this naturally on level 2 or 3.

---

## Kids-Specific Games and What They Do Differently

### Bridge Constructor Playground (Ages 7+) — Best in Class
- **No hard budget cap as a fail condition initially.** Budget is a score/badge metric, not a blocker. Kids can over-spend and still complete.
- **Five badges per level:** one just for completing, others for cost target, material restriction, stress limit, heavy vehicle. Kids can engage with structural lesson OR budgeting lesson at their own pace.
- **"Safe/unsafe" language** instead of "stress/load." Kids understand "safe." They don't understand "shear force."
- **Slower material introduction:** fewer tools at the start, new ones unlocked over more levels.

### World of Goo (Ages 6+) — Most Accessible
- No UI numbers at all — structure deforms visibly
- Undo is limited, not unlimited — prevents "spam undo until it works," which undermines learning
- Failure is silent and physical — no "FAILED" screen, structure simply falls
- Players as young as 6–7 can engage because the physics *looks like physics*

### Bridgy Jones (Ages 4+) — Youngest Audience
- Narrative context (dog chasing bird) gives emotional motivation
- Physics feedback is purely physical — train falls or it doesn't
- Does not teach much about support — leaves discovery entirely to trial and error
- Appropriate for exposure, not instruction

---

## Failure Modes: How Failure Is Made Readable and Educational

### Types of Failure and What Each Teaches

**Sag without snap** *(most instructive)*
Bridge deflects under load — bends into a U shape — but doesn't break. Car gets stuck at the low point or bounces. The visual of a sagging beam is exactly the intuition kids need: *the middle needs help.* This is why supports feel necessary — they are solving a visible, physical problem.

**Snap at a joint**
A single beam fails with a bright flash and detaches. Teaches: *this specific beam was overloaded.* The first-break indicator in Poly Bridge 3 marks which joint snapped first. Lesson: "This is the weakest point — add support here."

**Progressive cascade collapse**
One beam snaps, shifting load to adjacent beams which snap in sequence. Teaches: *the structure was near its limit everywhere.* Lesson: "The whole approach needs rethinking."

**Wobbly / oscillation failure**
Bridge enters harmonic oscillation and collapses from resonance. High spectacle, lower educational value. Memorable but the corrective action (damping) is hard to discover.

### How Games Make Failure Readable
1. **Slow it down** — play failure in real-time physics, let players watch
2. **Mark the origin** — first-break indicator, stress colours that remain visible during simulation
3. **Make it funny, not shameful** — shrieking workers, ragdoll explosions, oblivious driver. Tone signals "try again" not "you failed"
4. **Keep the bridge visible during collapse** — let the animation play out in full. Players learn from the fall

---

## Budget and Resource Systems

### The Core Tension: Deck vs. Support
The road deck is *mandatory* — it must span the full width regardless of support strategy. This creates a hidden minimum spend that sets the floor for every level. The structural challenge must be solved with whatever budget remains after paying for the mandatory deck. This is elegant design: **deck creates a constant expenditure that prevents players from buying their way out of the structural problem.**

### How Leading Games Tune This

**Poly Bridge**
- Hard budget cap; over-budget = fail even if bridge holds
- Road/deck material has fixed cost per unit of length
- Budget — not weight — is the binding constraint (all materials weigh the same, deliberately)
- Players solve an economic optimisation against a structural challenge

**Bridge Constructor**
- Roadway material is required everywhere the vehicle touches — cannot skip it
- Every unit of road bought is a unit of support you cannot afford
- The tension is explicit and unavoidable

**Bridge Constructor Playground (kids version)**
- Budget tracked but not a hard fail condition initially
- Two cost thresholds per level: complete, then complete under X
- First-time players learn to complete; on replay they learn to optimise
- Material-specific badges force understanding of which material serves which role

**Cargo Bridge**
- Budget is the only constraint
- Later levels introduce material tiers: wood for light cargo, steel for heavy. Transition is forced by physics, not player choice

### Key Budget Design Numbers
- Deck material should consume **40–60% of total budget** — leaves enough for supports without making them free
- Cheap-but-weak vs. expensive-but-strong crossover: at small spans wood is cheaper; at large spans the extra wood supports required make steel cheaper in aggregate. This crossover is an interesting decision point.
- **Removing budget = removing satisfaction.** Bridge Constructor Studio (2025) removed budget constraints with "Forget budgets, unleash your creativity" — reviewers found structural puzzle-solving far less engaging. The budget was doing more pedagogical work than the developers realised.

---

## Gap Analysis: Our Game vs. Best Practices

| What we have | What's missing |
|---|---|
| Budget system (road=2, support=1) | Sag is too subtle — road snaps before kids see it drooping |
| Stress colour on beams | No first-break indicator on collapse |
| Snap cascade | Deck not truly mandatory — supports can replace road anywhere |
| Material cost difference | No character/cargo embodiment — failure is abstract |
| Physics simulation | Budget may not be tight enough to force structural choices |
| | No "triangle" concept named or taught |
| | Only one level — no graduated progression |
| | No multiple success tiers (complete vs. complete under budget) |

### Priority Order (Based on Research)
1. **Make sag visible and dramatic before snap** — kids need to *see* the road drooping under the car's weight. Everything else follows from this one feedback signal.
2. **First-break indicator** — mark which beam broke first on collapse.
3. **Budget tightness tuning** — deck should consume ~50% of budget, leaving just enough for supports.
4. **Level progression** — at least 3 levels: flat works → flat fails → triangle discovery.
5. **Multiple success tiers** — completion badge + under-budget badge.
6. **Character/cargo embodiment** — something that reacts to the bridge failing, not just a silent car.

---

## Material Costs & Budget Design

### Cost Model (per segment placed, regardless of length)

| Material | Cost | Role | Can car drive on it? |
|---|---|---|---|
| Road | **2** | The surface the car drives on — expensive, mandatory for the deck | Yes |
| Wood (support) | **1** | Holds the road up — cheap, structural only | No |
| Steel *(future)* | **3** | Stronger support for heavy vehicles | No |
| Cable/Rope *(future)* | **1** | Very cheap but only works when pulled, not pushed | No |

**The ratio that matters:** Road costs 2× a support. Every road segment you place costs a support slot. The player is constantly trading deck coverage against structural strength.

### Budget Numbers Per Level

Simulation of a 720px gap (our Level 1 span), road=2, wood=1:

| Bridge type | Road segments | Support segments | Total cost |
|---|---|---|---|
| Flat road, no support | 1–3 | 0 | 2–6 |
| Minimal truss (will probably fail) | 3 | 2 | 8 |
| Decent bridge (good truss) | 4 | 4 | **12** |
| Solid bridge (well-supported) | 5 | 6 | **16** |
| Over-engineered | 6 | 8 | 20 |

A solid bridge costs exactly 16. A decent bridge costs 12. This sets the budget targets:

| Level | Budget | Vehicle weight | Rationale |
|---|---|---|---|
| **L1** (intro) | **16** | Light car | A solid bridge exactly maxes the budget. Forces real choices — spend on road OR supports, not both freely. Flat road alone (cost 2–6) always fails physically, teaching the lesson. |
| **DEV_STRESS** | **40** | 10× heavy vehicle | Allows complex test structures across multiple attempts. Still forces thought — you can't just spam every joint with supports. Headroom of ~28 after a decent bridge. |
| *(future) L2* | **20** | Truck | Slightly wider gap or heavier load. Extra 4 points rewards experimentation. |
| *(future) L3* | **18** | Truck | Same cost as L2 but budget tightened — forces optimisation over brute force. |

### Why the Previous Budgets Were Wrong

- **L1 at 30:** 18 points of headroom after a solid bridge. Player never feels the ceiling. Budget is decorative.
- **DEV_STRESS at 9999:** Completely irrelevant. No structural thinking required even for dev testing. Breaks the habit of designing consciously.

### The 50% Rule
Research target: road deck should consume ~50% of the total budget. At budget 16 with 4 road segments: `4 × 2 = 8 = 50% of 16`. The other 50% (8 points = 8 support pieces) is where structural decision-making happens.

---

## Sources
- Poly Bridge 2: Bridging the Gap Between Engineering and Gaming (Medium)
- Poly Bridge 2 review: Trussing the process (Shacknews)
- Poly Bridge 3 Makes Catastrophic Failure Fun (david.reviews)
- Poly Bridge 3 Review: Engineered Entertainment (Keengamer)
- Poly Bridge on Steam / Poly Bridge 3 on Steam
- Poly Bridge Beginner Guide with Tips and Tricks (GameSkinny)
- Cargo Bridge Game and Implications (Justin Ketterer)
- Cargo Bridge Walkthrough (Jay Is Games)
- Bridge Constructor Playground Review (Pocket Gamer)
- Bridge Constructor Playground (Educational App Store / GOG.com)
- Bridge Constructor Series Review (Codec Moments)
- Bridgy Jones Review (Family Friendly Gaming / Gamezebo)
- World of Goo Game Design Analysis (Jonas Hietala)
- Finding the Fun: World of Goo (Game Developer)
- Forget Budgets — Bridge Constructor Studio review (TheXboxHub)
- Engineering Games for Kids (Space Ranger Fred)
- Build a Bridge! Review (Rapid Reviews UK)
