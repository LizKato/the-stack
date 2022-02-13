let createShape;

let reset;

function init() {
    const width = window.innerWidth * 0.6;
    const height = window.innerHeight * 0.8;
    const currentStack = [];
    let currentScore = 0;
    let objectId = 1;
    const bodyOptions = {
        density: 1,
        friction: 10,
        frictionStatic: Infinity
    }

    const Engine = Matter.Engine,
        Render = Matter.Render,
        Runner = Matter.Runner,
        Bodies = Matter.Bodies,
        Events = Matter.Events,
        MouseConstraint = Matter.MouseConstraint,
        Mouse = Matter.Mouse,
        Vector = Matter.Vector,
        Bounds = Matter.Bounds,
        Common = Matter.Common,
        Vertices = Matter.Vertices,
        Composite = Matter.Composite;


    // create an engine
    const engine = Engine.create();

    // create a renderer
    const render = Render.create({
        element: document.getElementById('game'),
        engine: engine,
        options: {
            width: width,
            height: height,
            hasBounds: true,
            wireframes: false
        }
    });

    // create two boxes and a ground
    const boxA = Bodies.rectangle(400, height - 100, 80, 80, bodyOptions);
    const boxB = Bodies.rectangle(500, height - 100, 80, 80, bodyOptions);
    const ground = Bodies.rectangle(600, height, width * 2, 60, {isStatic: true});

    const colliders = [
        createCollider(400, 500, 10),
        createCollider(400, 100, 1000),
        createCollider(400, -300, 2000),
        createCollider(400, -height + 100, 5000)
    ]

    function createCollider(x, y, score) {
        return Bodies.rectangle(x, y, width * 2, 5, {
            isSensor: true,
            isStatic: true,
            render: {
                fillStyle: 'transparent',
                lineWidth: 1
            },
            label: score
        });
    }

    function getShape(x, y) {
        var sides = 4;

        // round the edges of some bodies
        var chamfer = null;
        if (sides > 2 && Common.random() > 0.7) {
            chamfer = {
                radius: 0
            };
        }

        switch (Math.round(Common.random(0, 1))) {
            case 0:
                if (Common.random() < 0.8) {
                    return Bodies.rectangle(x, y, Common.random(25, 50), Common.random(50, 100),
                        {
                            ...bodyOptions,
                            chamfer: chamfer
                        });
                } else {
                    return Bodies.rectangle(x, y, Common.random(80, 120), Common.random(50, 70),
                        {
                            ...bodyOptions,
                            chamfer: chamfer
                        });
                }
            case 1:
                return Bodies.polygon(x, y, sides, Common.random(50, 100), {
                    ...bodyOptions,
                    chamfer: chamfer
                });
        }
    }

    createShape = function () {
        const newBox = getShape(150, height - 100)
        Composite.add(engine.world, [newBox]);
    }
    // add all of the bodies to the world
    Composite.add(engine.world, [...colliders, boxA, boxB, ground]);

    // add mouse control
    const mouse = Mouse.create(render.canvas),
        mouseConstraint = MouseConstraint.create(engine, {
            mouse: mouse,
            constraint: {
                stiffness: 0.2,
                visible: false
            }
        });

    Composite.add(engine.world, mouseConstraint);

    // keep the mouse in sync with rendering
    render.mouse = mouse;

    // run the renderer
    Render.run(render);

    // create runner
    const runner = Runner.create();


    // run the engine
    Runner.run(runner, engine);

    reset = function () {
        Engine.clear(engine);
        Render.stop(render);
        Runner.stop(runner);
        render.canvas.remove();
        render.canvas = null;
        render.context = null;
        render.textures = {};
        document.getElementById('score').innerText = 0;
        init();
    }

    // an example of using collisionStart event on an engine
    Events.on(engine, 'collisionStart', function (event) {
        var pairs = event.pairs;
        // change object colours to show those in an active collision (e.g. resting contact)
        for (var i = 0; i < pairs.length; i++) {
            var pair = pairs[i];
            if (pair.bodyA.isSensor) {
                console.log('A is sensor', pair);
                currentScore += parseInt(pair.bodyA.label);
                document.getElementById('score').innerText = currentScore;
            } else if (pair.bodyB.isSensor) {
                console.log('B is sensor', pair);
                currentScore += parseInt(pair.bodyB.label);
                document.getElementById('score').innerText = currentScore;
            }
        }

    });

    // an example of using collisionEnd event on an engine
    Events.on(engine, 'collisionEnd', function (event) {
        var pairs = event.pairs;

        for (var i = 0; i < pairs.length; i++) {
            var pair = pairs[i];
            if (pair.bodyA.isSensor) {
                currentScore -= parseInt(pair.bodyA.label);
                document.getElementById('score').innerText = currentScore;
            } else if (pair.bodyB.isSensor) {
                currentScore -= parseInt(pair.bodyB.label);
                document.getElementById('score').innerText = currentScore;
            }
        }
    });

    // get the centre of the viewport
    var viewportCentre = {
        x: render.options.width * 0.5,
        y: render.options.height * 0.5
    };

    // create limits for the viewport
    var extents = {
        min: {x: width, y: -height},
        max: {x: width, y: height}
    };

    // keep track of current bounds scale (view zoom)
    var boundsScaleTarget = 1,
        boundsScale = {
            x: 1,
            y: 1
        };

    // use a render event to control our view
    Events.on(render, 'beforeRender', function () {
        var world = engine.world,
            mouse = mouseConstraint.mouse,
            translate;

        // if scale has changed
        if (Math.abs(boundsScale.x - boundsScaleTarget) > 0.01) {
            // smoothly tween scale factor
            scaleFactor = (boundsScaleTarget - boundsScale.x) * 0.2;
            boundsScale.x += scaleFactor;
            boundsScale.y += scaleFactor;

            // scale the render bounds
            render.bounds.max.x = render.bounds.min.x + render.options.width * boundsScale.x;
            render.bounds.max.y = render.bounds.min.y + render.options.height * boundsScale.y;

            // translate so zoom is from centre of view
            translate = {
                x: render.options.width * scaleFactor * -0.5,
                y: render.options.height * scaleFactor * -0.5
            };

            Bounds.translate(render.bounds, translate);

            // update mouse
            Mouse.setScale(mouse, boundsScale);
            Mouse.setOffset(mouse, render.bounds.min);
        }

        // get vector from mouse relative to centre of viewport
        var deltaCentre = Vector.sub(mouse.absolute, viewportCentre),
            centreDist = Vector.magnitude(deltaCentre);

        // translate the view if mouse has moved over 50px from the centre of viewport
        if (centreDist > 50) {
            // create a vector to translate the view, allowing the user to control view speed
            var direction = Vector.normalise(deltaCentre),
                speed = Math.min(10, Math.pow(centreDist - 50, 2) * 0.0002);

            translate = Vector.mult(direction, speed);

            // prevent the view moving outside the extents
            if (render.bounds.min.x + translate.x < extents.min.x)
                translate.x = extents.min.x - render.bounds.min.x;

            if (render.bounds.max.x + translate.x > extents.max.x)
                translate.x = extents.max.x - render.bounds.max.x;

            if (render.bounds.min.y + translate.y < extents.min.y)
                translate.y = extents.min.y - render.bounds.min.y;

            if (render.bounds.max.y + translate.y > extents.max.y)
                translate.y = extents.max.y - render.bounds.max.y;

            // move the view
            Bounds.translate(render.bounds, translate);

            // we must update the mouse too
            Mouse.setOffset(mouse, render.bounds.min);
        }
    });
}

(function () {
    init();
})();
