// USD Layer 1 backtester - candle replay for the execution demo.
//
// Renders the demo's M5 candles with its level grid and steps through the trader's own sequence:
// qualifying close, limit order, fill, stop, target and exit. Three.js is used when it is present (the
// vendored build under lib/vendor/); when WebGL is unavailable the same controller draws to a 2D canvas, so
// the drill-down never becomes a blank box in a headless browser or an offline checkout.
//
// Research only: this draws a saved ledger. It computes no call, no level and no trade.

(function () {
  "use strict";

  var UP_COLOUR = 0x35d0a5;
  var DOWN_COLOUR = 0xf0616f;
  var LEVEL_COLOUR = 0x43c8b0;
  var FILL_COLOUR = 0xffd166;
  var EXIT_COLOUR = 0xffffff;

  function stepList(trades) {
    var steps = [{ kind: "start", label: "Session start", time: null, trade: null }];
    trades.forEach(function (trade) {
      steps.push({ kind: "trigger", label: "Qualifying close beyond the line", time: trade.triggerTimeUtc, trade: trade });
      steps.push({ kind: "order", label: "Limit order placed back at the line", time: trade.fillTimeUtc, trade: trade });
      steps.push({ kind: "fill", label: "Filled at the line", time: trade.fillTimeUtc, trade: trade });
      if (trade.exitTimeUtc) {
        steps.push({
          kind: "exit",
          label: trade.exitReason === "target" ? "Target taken" : trade.exitReason === "stop" ? "Stopped out" : "Exit",
          time: trade.exitTimeUtc,
          trade: trade
        });
      } else {
        steps.push({
          kind: "open",
          label: "Still working at the end of the tape",
          time: trade.fillTimeUtc,
          trade: trade
        });
      }
    });
    return steps;
  }

  function candlesUpTo(candles, time) {
    if (!time) return 0;
    var stamp = Date.parse(time);
    var count = 0;
    for (var index = 0; index < candles.length; index += 1) {
      if (Date.parse(candles[index].t) <= stamp) count = index + 1;
    }
    return count;
  }

  function controller(api) {
    return {
      mode: api.mode,
      steps: api.steps,
      get step() {
        return api.index();
      },
      setStep: api.setStep,
      next: function () {
        api.setStep(api.index() + 1);
      },
      previous: function () {
        api.setStep(api.index() - 1);
      },
      destroy: api.destroy
    };
  }

  function extent(candles, levels) {
    var high = -Infinity;
    var low = Infinity;
    candles.forEach(function (bar) {
      if (bar.h > high) high = bar.h;
      if (bar.l < low) low = bar.l;
    });
    levels.forEach(function (level) {
      if (!Number.isFinite(level.price)) return;
      if (level.price > high) high = level.price;
      if (level.price < low) low = level.price;
    });
    if (!Number.isFinite(high) || !Number.isFinite(low)) return { high: 1, low: 0 };
    var pad = Math.max((high - low) * 0.06, 1e-6);
    return { high: high + pad, low: low - pad };
  }


  function create2D(container, model) {
    var candles = model.candles || [];
    var levels = model.levels || [];
    var steps = stepList(model.trades || []);
    var index = 0;

    var canvas = document.createElement("canvas");
    canvas.className = "usd-l1-replay-canvas";
    canvas.setAttribute("data-usd-l1-replay-canvas", "2d");
    container.appendChild(canvas);

    var bounds = extent(candles, levels);

    function draw() {
      var width = container.clientWidth || 720;
      var height = container.clientHeight || 340;
      var ratio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      var ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);

      var yOf = function (price) {
        return height - ((price - bounds.low) / (bounds.high - bounds.low)) * height;
      };
      var xOf = function (position) {
        return (position / Math.max(1, candles.length)) * (width - 8) + 4;
      };
      var barWidth = Math.max(1.5, (width - 8) / Math.max(1, candles.length) - 1);

      levels.forEach(function (level) {
        ctx.strokeStyle = level.source === "original" ? "rgba(67,200,176,0.35)" : "rgba(95,125,153,0.28)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, yOf(level.price));
        ctx.lineTo(width, yOf(level.price));
        ctx.stroke();
      });

      var visible = candlesUpTo(candles, steps[index].time);
      for (var bar = 0; bar < visible; bar += 1) {
        var candle = candles[bar];
        ctx.strokeStyle = candle.c >= candle.o ? "#35d0a5" : "#f0616f";
        ctx.fillStyle = ctx.strokeStyle;
        var x = xOf(bar);
        ctx.beginPath();
        ctx.moveTo(x + barWidth / 2, yOf(candle.h));
        ctx.lineTo(x + barWidth / 2, yOf(candle.l));
        ctx.stroke();
        var top = yOf(Math.max(candle.o, candle.c));
        var bottom = yOf(Math.min(candle.o, candle.c));
        ctx.fillRect(x, top, barWidth, Math.max(1, bottom - top));
      }

      var trade = steps[index].trade;
      if (trade) {
        [[trade.entry, "#ffd166"], [trade.stop, "#f0616f"], [trade.target, "#35d0a5"]].forEach(function (pair) {
          if (!Number.isFinite(pair[0])) return;
          ctx.strokeStyle = pair[1];
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.moveTo(0, yOf(pair[0]));
          ctx.lineTo(width, yOf(pair[0]));
          ctx.stroke();
          ctx.setLineDash([]);
        });
      }
    }

    function setStep(next) {
      index = Math.max(0, Math.min(steps.length - 1, next));
      draw();
      if (model.onStep) model.onStep(index, steps[index]);
    }

    window.addEventListener("resize", draw);
    setStep(0);

    return controller({
      mode: "2d",
      steps: steps,
      index: function () {
        return index;
      },
      setStep: setStep,
      destroy: function () {
        window.removeEventListener("resize", draw);
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      }
    });
  }

  function createThree(container, model) {
    var THREE = window.THREE;
    var candles = model.candles || [];
    var levels = model.levels || [];
    var steps = stepList(model.trades || []);
    var index = 0;

    var width = container.clientWidth || 720;
    var height = container.clientHeight || 340;
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (error) {
      return null;
    }
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(width, height);
    renderer.domElement.className = "usd-l1-replay-canvas";
    renderer.domElement.setAttribute("data-usd-l1-replay-canvas", "3d");
    container.appendChild(renderer.domElement);

    var scene = new THREE.Scene();
    var bounds = extent(candles, levels);
    var span = bounds.high - bounds.low;
    var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    camera.position.set(0, 0, 10);

    var layout = function (nextWidth, nextHeight) {
      var aspect = nextWidth / nextHeight;
      camera.left = -aspect;
      camera.right = aspect;
      camera.top = 1;
      camera.bottom = -1;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight);
    };
    layout(width, height);

    var xOf = function (position) {
      return ((position / Math.max(1, candles.length)) - 0.5) * 2;
    };
    var yOf = function (price) {
      return ((price - bounds.low) / span - 0.5) * 2;
    };
    var barHalfWidth = Math.max(0.0012, 0.9 / Math.max(1, candles.length));

    var levelGeometry = new THREE.BufferGeometry();
    var levelPositions = [];
    levels.forEach(function (level) {
      if (!Number.isFinite(level.price)) return;
      levelPositions.push(-1, yOf(level.price), 0, 1, yOf(level.price), 0);
    });
    levelGeometry.setAttribute("position", new THREE.Float32BufferAttribute(levelPositions, 3));
    var levelLines = new THREE.LineSegments(
      levelGeometry,
      new THREE.LineBasicMaterial({ color: LEVEL_COLOUR, transparent: true, opacity: 0.35 })
    );
    scene.add(levelLines);

    var wickGeometry = new THREE.BufferGeometry();
    var wickLines = new THREE.LineSegments(wickGeometry, new THREE.LineBasicMaterial({ color: 0x9fb6c9 }));
    scene.add(wickLines);

    var upGeometry = new THREE.BufferGeometry();
    var upBodies = new THREE.Mesh(upGeometry, new THREE.MeshBasicMaterial({ color: UP_COLOUR }));
    scene.add(upBodies);
    var downGeometry = new THREE.BufferGeometry();
    var downBodies = new THREE.Mesh(downGeometry, new THREE.MeshBasicMaterial({ color: DOWN_COLOUR }));
    scene.add(downBodies);

    var guideGeometry = new THREE.BufferGeometry();
    var guides = new THREE.LineSegments(
      guideGeometry,
      new THREE.LineDashedMaterial({ color: FILL_COLOUR, dashSize: 0.04, gapSize: 0.03 })
    );
    scene.add(guides);

    var markerGeometry = new THREE.BufferGeometry();
    var markers = new THREE.Points(markerGeometry, new THREE.PointsMaterial({ color: EXIT_COLOUR, size: 6 }));
    scene.add(markers);

    function rebuild(visible) {
      var wicks = [];
      var ups = [];
      var downs = [];
      for (var bar = 0; bar < visible; bar += 1) {
        var candle = candles[bar];
        var x = xOf(bar);
        wicks.push(x, yOf(candle.l), 0, x, yOf(candle.h), 0);
        var top = yOf(Math.max(candle.o, candle.c));
        var bottom = yOf(Math.min(candle.o, candle.c));
        var target = candle.c >= candle.o ? ups : downs;
        target.push(
          x - barHalfWidth, top, 0,
          x + barHalfWidth, top, 0,
          x + barHalfWidth, bottom, 0,
          x - barHalfWidth, top, 0,
          x + barHalfWidth, bottom, 0,
          x - barHalfWidth, bottom, 0
        );
      }
      wickGeometry.setAttribute("position", new THREE.Float32BufferAttribute(wicks, 3));
      upGeometry.setAttribute("position", new THREE.Float32BufferAttribute(ups, 3));
      downGeometry.setAttribute("position", new THREE.Float32BufferAttribute(downs, 3));
      wickGeometry.computeBoundingSphere();
      upGeometry.computeBoundingSphere();
      downGeometry.computeBoundingSphere();
    }

    function rebuildGuides(trade) {
      var positions = [];
      var points = [];
      if (trade) {
        [[trade.entry], [trade.stop], [trade.target]].forEach(function (pair) {
          if (!Number.isFinite(pair[0])) return;
          var y = yOf(pair[0]);
          positions.push(-1, y, 0, 1, y, 0);
          points.push(0, y, 0);
        });
      }
      guideGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      guides.computeLineDistances();
      markerGeometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
      markerGeometry.computeBoundingSphere();
    }

    function draw() {
      rebuild(candlesUpTo(candles, steps[index].time));
      rebuildGuides(steps[index].trade);
      renderer.render(scene, camera);
    }

    function setStep(next) {
      index = Math.max(0, Math.min(steps.length - 1, next));
      draw();
      if (model.onStep) model.onStep(index, steps[index]);
    }

    var onResize = function () {
      var nextWidth = container.clientWidth || 720;
      var nextHeight = container.clientHeight || 340;
      if (nextWidth === width && nextHeight === height) return;
      width = nextWidth;
      height = nextHeight;
      layout(width, height);
      draw();
    };
    window.addEventListener("resize", onResize);
    setStep(0);

    return controller({
      mode: "3d",
      steps: steps,
      index: function () {
        return index;
      },
      setStep: setStep,
      destroy: function () {
        window.removeEventListener("resize", onResize);
        scene.remove(levelLines, wickLines, upBodies, downBodies, guides, markers);
        [levelGeometry, wickGeometry, upGeometry, downGeometry, guideGeometry, markerGeometry].forEach(function (geometry) {
          geometry.dispose();
        });
        renderer.dispose();
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    });
  }

  function create(container, model) {
    if (!container) return null;
    if (window.THREE) {
      var three = createThree(container, model);
      if (three) return three;
    }
    return create2D(container, model);
  }

  window.UsdL1Replay = { create: create, stepList: stepList };
})();
