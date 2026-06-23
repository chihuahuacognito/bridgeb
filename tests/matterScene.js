// tests/matterScene.js
// Faithful headless adapter that exposes the SAME `scene.matter` surface that
// Phaser gives physics.js, backed by a real matter-js engine. Lets tests drive
// the actual physics.js code (no divergent copy) and step the world.
import Matter from 'matter-js';

const EVT = { beforeupdate: 'beforeUpdate', afterupdate: 'afterUpdate', collisionstart: 'collisionStart' };

export function createMatterScene({ gravityY = 1.5 } = {}) {
  const engine = Matter.Engine.create({
    enableSleeping: false,
    positionIterations: 8,
    velocityIterations: 6,
    constraintIterations: 4,
  });
  engine.gravity.y = gravityY;
  engine.gravity.scale = 0.001; // matter default — physics.js reads gravity.scale
  const world = engine.world;

  const add = {
    circle: (x, y, r, opts = {}) => { const b = Matter.Bodies.circle(x, y, r, opts); Matter.Composite.add(world, b); return b; },
    rectangle: (x, y, w, h, opts = {}) => { const b = Matter.Bodies.rectangle(x, y, w, h, opts); Matter.Composite.add(world, b); return b; },
    constraint: (bodyA, bodyB, length, stiffness, opts = {}) => {
      const c = Matter.Constraint.create({ bodyA, bodyB, length, stiffness, ...opts });
      Matter.Composite.add(world, c); return c;
    },
  };
  const body = {
    setPosition: (b, p) => Matter.Body.setPosition(b, p),
    setAngle: (b, a) => Matter.Body.setAngle(b, a),
    setStatic: (b, s) => Matter.Body.setStatic(b, s),
    setVelocity: (b, v) => Matter.Body.setVelocity(b, v),
    setAngularVelocity: (b, w) => Matter.Body.setAngularVelocity(b, w),
    applyForce: (b, pos, f) => Matter.Body.applyForce(b, pos, f),
  };
  const matter = {
    add, body,
    world: {
      engine,
      enabled: true,
      runner: { enabled: true },
      on: (evt, cb) => Matter.Events.on(engine, EVT[evt] ?? evt, cb),
      off: (evt, cb) => Matter.Events.off(engine, EVT[evt] ?? evt, cb),
      remove: (items) => { for (const it of [].concat(items)) Matter.Composite.remove(world, it); },
      setGravity: (x, y) => { engine.gravity.x = x; engine.gravity.y = y; },
    },
  };
  const scene = { matter, time: { now: 0 } };

  function step(times = 1, dt = 16.666) {
    for (let i = 0; i < times; i++) { scene.time.now += dt; Matter.Engine.update(engine, dt); }
  }
  return { scene, engine, world, step, Matter };
}
