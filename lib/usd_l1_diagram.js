// USD Layer 1 backtester - the decision diagram.
//
// Draws the whole programme as one chain: sources, the 05:00 London snapshot, the factor families, the USD
// decision and the four tests. Every node is clickable and reports what it is, because the diagram's job is to
// explain the evidence path, not to decorate it.
//
// Three.js draws the chain when WebGL is available. A 2D canvas draws the same nodes and edges otherwise, so a
// headless browser or an offline checkout still gets a readable diagram rather than an empty box.
//
// Research only: this file draws the caller's nodes. It computes no call, no factor and no result.

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }
  root.UsdL1Diagram = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // The factory is called without the UMD wrapper's root, so resolve the global object once here: WebGL and
  // requestAnimationFrame live on it, and in Node (tests) it simply has neither.
  var root = typeof globalThis !== "undefined" ? globalThis : {};

  var TONES = {
    good: 0x35d0a5,
    warn: 0xffd166,
    bad: 0xf0616f,
    muted: 0x8d9aa8,
    info: 0x43c8b0,
    navy: 0x2f4a6d
  };

  var CSS_TONES = {
    good: "#35d0a5",
    warn: "#ffd166",
    bad: "#f0616f",
    muted: "#8d9aa8",
    info: "#43c8b0",
    navy: "#2f4a6d"
  };

  function columnsOf(nodes) {
    var columns = [];
    nodes.forEach(function (node) {
      var index = Number(node.column || 0);
      columns[index] = columns[index] || [];
      columns[index].push(node);
    });
    return columns;
  }

  function layout(nodes) {
    var columns = columnsOf(nodes);
    var width = Math.max(columns.length, 1);
    var positions = new Map();
    columns.forEach(function (group, column) {
      if (!group) return;
      var x = (column - (width - 1) / 2) * 4.6;
      group.forEach(function (node, row) {
        var y = ((group.length - 1) / 2 - row) * 2.15;
        positions.set(node.id, { x: x, y: y, column: column, row: row });
      });
    });
    return positions;
  }

  function nodeTone(node) {
    return TONES[node.tone] !== undefined ? TONES[node.tone] : TONES.navy;
  }

  function cssTone(node) {
    return CSS_TONES[node.tone] || CSS_TONES.navy;
  }

  /**
   * A highlighted path is a set of node ids, or null for "show everything". Both renderers use it the same way:
   * nodes on the path stay bright, edges between two path nodes stay visible, everything else fades back so the
   * selected test → market → date chain is the thing the eye follows.
   */
  function normaliseHighlight(value) {
    if (!value) return null;
    var list = Array.isArray(value) ? value : [value];
    var set = [];
    list.forEach(function (id) {
      if (id && set.indexOf(id) === -1) set.push(id);
    });
    return set.length ? set : null;
  }

  function onPath(highlight, id) {
    return !highlight || highlight.indexOf(id) !== -1;
  }

  function edgeOnPath(highlight, edge) {
    return !highlight || (highlight.indexOf(edge.from) !== -1 && highlight.indexOf(edge.to) !== -1);
  }


  function labelTexture(three, node) {
    var canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 192;
    var context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#f7fbfd";
    context.font = "600 30px ui-monospace, SFMono-Regular, Menlo, monospace";
    context.textAlign = "center";
    context.textBaseline = "middle";
    var title = String(node.label || node.id || "");
    var lines = [title];
    if (title.length > 26) {
      var words = title.split(" ");
      var half = Math.ceil(words.length / 2);
      lines = [words.slice(0, half).join(" "), words.slice(half).join(" ")];
    }
    lines.forEach(function (line, index) {
      context.fillText(line, 256, 70 + index * 34);
    });
    if (node.status) {
      context.fillStyle = cssTone(node);
      context.font = "500 24px ui-sans-serif, system-ui, sans-serif";
      context.fillText(String(node.status), 256, 148);
    }
    var texture = new three.CanvasTexture(canvas);
    texture.minFilter = three.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }

  function createThree(host, options) {
    var three = root.THREE;
    var nodes = options.nodes || [];
    var edges = options.edges || [];
    var positions = layout(nodes);
    var scene = new three.Scene();
    var camera = new three.PerspectiveCamera(38, 1, 0.1, 200);
    camera.position.set(0, 0, 27);
    var renderer = new three.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2));
    renderer.domElement.className = "usd-l1-diagram-canvas";
    host.appendChild(renderer.domElement);

    var group = new three.Group();
    scene.add(group);
    scene.add(new three.AmbientLight(0xffffff, 0.9));
    var light = new three.DirectionalLight(0xffffff, 0.6);
    light.position.set(4, 8, 12);
    scene.add(light);
    var backLight = new three.DirectionalLight(0x7fd8e8, 0.35);
    backLight.position.set(-6, -4, -10);
    scene.add(backLight);

    var geometry = new three.BoxGeometry(3.5, 1.55, 0.42);
    var meshes = [];
    var sprites = [];
    var lines = [];
    var textures = [];
    var disposables = [geometry];
    var highlight = normaliseHighlight(options.highlight);

    nodes.forEach(function (node) {
      var position = positions.get(node.id) || { x: 0, y: 0 };
      var material = new three.MeshStandardMaterial({
        color: nodeTone(node),
        transparent: true,
        opacity: node.tone === "muted" ? 0.45 : 0.82,
        roughness: 0.55,
        metalness: 0.05
      });
      var mesh = new three.Mesh(geometry, material);
      mesh.position.set(position.x, position.y, 0);
      mesh.userData.node = node;
      group.add(mesh);
      meshes.push(mesh);
      disposables.push(material);

      var texture = labelTexture(three, node);
      var spriteMaterial = new three.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
      var sprite = new three.Sprite(spriteMaterial);
      sprite.position.set(position.x, position.y, 0.28);
      sprite.scale.set(3.5, 1.31, 1);
      group.add(sprite);
      sprites.push({ id: node.id, material: spriteMaterial, base: 1 });
      textures.push(texture);
      disposables.push(spriteMaterial);
    });

    edges.forEach(function (edge) {
      var from = positions.get(edge.from);
      var to = positions.get(edge.to);
      if (!from || !to) return;
      var target = nodes.find(function (node) { return node.id === edge.to; }) || {};
      var lineGeometry = new three.BufferGeometry().setFromPoints([
        new three.Vector3(from.x + 1.78, from.y, -0.1),
        new three.Vector3(to.x - 1.78, to.y, -0.1)
      ]);
      var lineMaterial = new three.LineBasicMaterial({
        color: nodeTone(target),
        transparent: true,
        opacity: 0.34
      });
      group.add(new three.Line(lineGeometry, lineMaterial));
      lines.push({ edge: edge, material: lineMaterial });
      disposables.push(lineGeometry, lineMaterial);
    });

    // The 3D scene answers the same question as the printed list: which chain is selected. Everything off the
    // path fades rather than disappears, so a reader can still see the route they could take next.
    function applyHighlight() {
      meshes.forEach(function (mesh) {
        var node = mesh.userData.node || {};
        mesh.material.opacity = !highlight ? (node.tone === "muted" ? 0.45 : 0.82) : onPath(highlight, node.id) ? 1 : 0.16;
      });
      sprites.forEach(function (sprite) {
        sprite.material.opacity = !highlight ? 1 : onPath(highlight, sprite.id) ? 1 : 0.22;
      });
      lines.forEach(function (entry) {
        entry.material.opacity = !highlight ? 0.34 : edgeOnPath(highlight, entry.edge) ? 0.95 : 0.06;
      });
    }
    applyHighlight();

    var raycaster = new three.Raycaster();
    var pointer = new three.Vector2();
    var dragging = false;
    var moved = false;
    var lastX = 0;
    var lastY = 0;
    var rotation = 0;
    var targetRotation = 0;
    var frame = null;

    function resize() {
      var width = Math.max(host.clientWidth, 320);
      var height = Math.max(host.clientHeight, 240);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      // Fit the whole scene rather than a fixed distance: the map runs to five columns, and a phone-sized frame
      // must still show both ends of the selected path.
      var halfWidth = 1.8;
      var halfHeight = 1;
      nodes.forEach(function (node) {
        var position = positions.get(node.id);
        if (!position) return;
        halfWidth = Math.max(halfWidth, Math.abs(position.x) + 1.9);
        halfHeight = Math.max(halfHeight, Math.abs(position.y) + 1.1);
      });
      var fovHalf = Math.tan((camera.fov * Math.PI) / 360);
      var zForWidth = halfWidth / Math.max(fovHalf * camera.aspect, 0.01);
      var zForHeight = halfHeight / fovHalf;
      camera.position.z = Math.max(zForWidth, zForHeight) * 1.12;
      camera.updateProjectionMatrix();
    }

    function pick(event) {
      var rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      var hits = raycaster.intersectObjects(meshes, false);
      return hits.length ? hits[0].object.userData.node : null;
    }

    function onPointerDown(event) {
      dragging = true;
      moved = false;
      lastX = event.clientX;
      lastY = event.clientY;
    }

    function onPointerMove(event) {
      if (!dragging) return;
      var dx = event.clientX - lastX;
      if (Math.abs(dx) > 2) moved = true;
      targetRotation += dx * 0.005;
      lastX = event.clientX;
      lastY = event.clientY;
    }

    function onPointerUp(event) {
      if (!dragging) return;
      dragging = false;
      if (moved) return;
      var node = pick(event);
      if (node && typeof options.onSelect === "function") options.onSelect(node);
    }

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

    function tick(time) {
      rotation += (targetRotation - rotation) * 0.12;
      group.rotation.y = rotation + Math.sin(time / 4200) * 0.06;
      group.rotation.x = Math.sin(time / 5600) * 0.025;
      renderer.render(scene, camera);
      frame = root.requestAnimationFrame(tick);
    }

    resize();
    frame = root.requestAnimationFrame(tick);

    return {
      mode: "webgl",
      nodes: nodes,
      edges: edges,
      resize: resize,
      setHighlight: function (ids) {
        highlight = normaliseHighlight(ids);
        applyHighlight();
      },
      destroy: function () {
        if (frame) root.cancelAnimationFrame(frame);
        renderer.domElement.removeEventListener("pointerdown", onPointerDown);
        renderer.domElement.removeEventListener("pointermove", onPointerMove);
        renderer.domElement.removeEventListener("pointerup", onPointerUp);
        textures.forEach(function (texture) { texture.dispose(); });
        disposables.forEach(function (item) { if (item && item.dispose) item.dispose(); });
        renderer.dispose();
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }

  function wrapText(context, text, maxWidth) {
    var words = String(text || "").split(/\s+/);
    var lines = [];
    var line = "";
    words.forEach(function (word) {
      var candidate = line ? line + " " + word : word;
      if (context.measureText(candidate).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    });
    if (line) lines.push(line);
    return lines;
  }

  function roundedRect(context, x, y, width, height, radius) {
    var r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + width, y, x + width, y + height, r);
    context.arcTo(x + width, y + height, x, y + height, r);
    context.arcTo(x, y + height, x, y, r);
    context.arcTo(x, y, x + width, y, r);
    context.closePath();
  }

  function createTwoD(host, options) {
    var nodes = options.nodes || [];
    var edges = options.edges || [];
    var positions = layout(nodes);
    var highlight = normaliseHighlight(options.highlight);
    var canvas = document.createElement("canvas");
    canvas.className = "usd-l1-diagram-canvas";
    host.appendChild(canvas);
    var context = canvas.getContext("2d");
    var hitBoxes = [];
    var ratio = 1;
    var width = 0;
    var height = 0;

    function scaleFor() {
      return {
        x: width / 24,
        y: height / 15,
        nodeW: Math.max(58, (width / 24) * 3.5),
        nodeH: Math.max(34, (height / 15) * 1.55)
      };
    }

    function pointFor(position, scale) {
      return {
        x: width / 2 + position.x * scale.x,
        y: height / 2 - position.y * scale.y
      };
    }

    function draw() {
      var scale = scaleFor();
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      hitBoxes = [];

      var headers = Array.isArray(options.columns) && options.columns.length
        ? options.columns.map(function (column) { return String(column.label || ""); })
        : ["Sources", "05:00 snapshot", "Factor families", "USD decision", "Four tests"];
      context.fillStyle = "rgba(215, 232, 240, 0.55)";
      context.font = "600 10px ui-monospace, SFMono-Regular, Menlo, monospace";
      context.textAlign = "center";
      context.textBaseline = "middle";
      headers.forEach(function (header, column) {
        context.fillText(header.toUpperCase(), width / 2 + (column - (headers.length - 1) / 2) * 4.6 * scale.x, 14);
      });

      edges.forEach(function (edge) {
        var from = positions.get(edge.from);
        var to = positions.get(edge.to);
        if (!from || !to) return;
        var start = pointFor(from, scale);
        var end = pointFor(to, scale);
        var target = nodes.find(function (node) { return node.id === edge.to; }) || {};
        context.strokeStyle = cssTone(target);
        context.globalAlpha = !highlight ? 0.3 : edgeOnPath(highlight, edge) ? 0.95 : 0.08;
        context.lineWidth = !highlight ? 1 : edgeOnPath(highlight, edge) ? 2.2 : 1;
        context.beginPath();
        context.moveTo(start.x + scale.nodeW / 2, start.y);
        var mid = (start.x + end.x) / 2;
        context.bezierCurveTo(mid, start.y, mid, end.y, end.x - scale.nodeW / 2, end.y);
        context.stroke();
      });
      context.globalAlpha = 1;

      nodes.forEach(function (node) {
        var position = positions.get(node.id);
        if (!position) return;
        var point = pointFor(position, scale);
        var x = point.x - scale.nodeW / 2;
        var y = point.y - scale.nodeH / 2;
        hitBoxes.push({ node: node, x: x, y: y, width: scale.nodeW, height: scale.nodeH });

        roundedRect(context, x, y, scale.nodeW, scale.nodeH, 7);
        context.fillStyle = "rgba(13, 27, 42, 0.9)";
        context.fill();
        context.strokeStyle = cssTone(node);
        context.globalAlpha = !highlight ? (node.tone === "muted" ? 0.4 : 0.85) : onPath(highlight, node.id) ? 1 : 0.16;
        context.lineWidth = !highlight ? 1.4 : onPath(highlight, node.id) ? 2 : 1;
        context.stroke();
        context.globalAlpha = !highlight ? 1 : onPath(highlight, node.id) ? 1 : 0.28;

        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillStyle = "#f2f8fb";
        context.font = "600 " + (scale.nodeW < 90 ? "8px" : "10px") + " ui-monospace, SFMono-Regular, Menlo, monospace";
        var lines = wrapText(context, node.label, scale.nodeW - 10).slice(0, 3);
        var lineHeight = scale.nodeW < 90 ? 9 : 12;
        var startY = point.y - ((lines.length - 1) * lineHeight) / 2 - (node.status ? 5 : 0);
        lines.forEach(function (line, index) {
          context.fillText(line, point.x, startY + index * lineHeight);
        });
        if (node.status) {
          context.fillStyle = cssTone(node);
          context.font = "500 " + (scale.nodeW < 90 ? "7px" : "9px") + " ui-sans-serif, system-ui, sans-serif";
          context.fillText(String(node.status), point.x, y + scale.nodeH - 8);
        }
      });
    }

    function resize() {
      ratio = Math.min(root.devicePixelRatio || 1, 2);
      width = Math.max(host.clientWidth, 320);
      height = Math.max(host.clientHeight, 240);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      draw();
    }

    function onClick(event) {
      var rect = canvas.getBoundingClientRect();
      var x = event.clientX - rect.left;
      var y = event.clientY - rect.top;
      var hit = hitBoxes.find(function (box) {
        return x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;
      });
      if (hit && typeof options.onSelect === "function") options.onSelect(hit.node);
    }

    canvas.addEventListener("click", onClick);
    resize();

    return {
      mode: "canvas2d",
      nodes: nodes,
      edges: edges,
      resize: resize,
      setHighlight: function (ids) {
        highlight = normaliseHighlight(ids);
        draw();
      },
      redraw: draw,
      destroy: function () {
        canvas.removeEventListener("click", onClick);
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      }
    };
  }

  function create(host, options) {
    if (!host) throw new Error("the diagram needs a host element");
    var settings = options || {};
    if (root.THREE && typeof root.THREE.WebGLRenderer === "function") {
      try {
        return createThree(host, settings);
      } catch (error) {
        host.innerHTML = "";
      }
    }
    return createTwoD(host, settings);
  }

  return {
    create: create,
    layout: layout
  };
});
