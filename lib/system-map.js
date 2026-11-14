(() => {
  'use strict';
  const stages = [
    ['Asset', 'US dollar', 'Start with one question. Which way will USD move from 05:00 London to 05:00 the next day?', ['Asset under study: USD', 'Direction reference: DXY'], -4.3, 0, 0],
    ['Research', 'Macro factor research', 'Investigate the 25 USD factors. Challenge each hypothesis and record the rule and evidence that survive review.', ['Research', 'Red-team review', 'Adjudication'], -2.5, .6, -3.1],
    ['Backtester', 'Four-stage backtester', 'Replay the morning using information available at the cut-off. Compare the challenger with original Layer 1 calls on matching dates.', ['01  DXY direction', '02  Four-market performance', '03  Full L2L execution · 5R', '04  Half L2L execution · 3R'], 0, .45, 0],
    ['Layer 1', 'Independent asset engines', 'Each engine reads its own logic and the market snapshot to produce an asset direction and confidence. Challenger rules require validation before adoption.', ['USD · EUR · Gold · NQ · BTC', 'Output: independent asset calls'], 2.8,.6,-3.1],
    ['Layer 2', 'Pair selection', 'Pair an asset with USD when both calls are directional and oppose each other. The lower of their confidence scores becomes the pair confidence.', ['EUR/USD · XAU/USD', 'NQ/USD · BTC/USD'],4.2,0,.3],
    ['VPS traders', 'Automated execution', 'The Windows VPS runs the directional traders. Each lane watches its levels, applies its entry rules and manages its own MT5 orders.', ['Full L2L directional · 5R', 'Half L2L directional · 3R'],2.3,0,3.4],
    ['FTMO', 'FTMO accounts', 'Each directional lane connects to its corresponding FTMO account. Accepted orders, fills and closed trades feed the execution record.', ['ftmo-1 · Full L2L', 'ftmo-2 · Half L2L'], -2.4,0,3.4]
  ];
  const el = id => document.getElementById(id);
  const field = el('field');
  let selected = 2;
  let redraw = () => {};
  const buttons = stages.map(([label], index) => {
    const button = document.createElement('button');
    button.className = 'node';
    button.textContent = label;
    button.onclick = () => select(index);
    el('nodes').append(button);
    return button;
  });
  function select(index) {
    selected = index;
    const [, title, detail, items] = stages[index];
    el('position').textContent = 'Stage ' + String(index + 1).padStart(2, '0') + ' / 07';
    el('title').textContent = title;
    el('details').textContent = detail;
    el('items').replaceChildren(...items.map(item => {
      const row = document.createElement('li');
      row.textContent = item;
      return row;
    }));
    buttons.forEach((button, i) => button.setAttribute('aria-pressed', i === index));
    redraw();
  }
  function fallback() {
    field.classList.add('flat');
    el('hint').textContent = 'Select a stage to inspect';
    el('motion').hidden = el('reset').hidden = true;
  }
  select(selected);
  if (!window.THREE) return fallback();
  const T = window.THREE;
  let renderer;
  try { renderer = new T.WebGLRenderer({alpha:true, antialias:true}); }
  catch { return fallback(); }
  field.classList.remove('flat');
  field.prepend(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new T.Scene();
  const camera = new T.OrthographicCamera(-6,6,4,-4,.1,100);
  const cyan = 0x68dced, gold = 0xffc574;
  const points = stages.map(s => new T.Vector3(...s.slice(4)));
  function line(points, colour, opacity, parent = scene) {
    const geo = new T.BufferGeometry().setFromPoints(points);
    parent.add(new T.Line(geo,new T.LineBasicMaterial({color:colour, transparent:true,opacity})));
  }
  function ring(group, radius, y, colour, start=0, arc=Math.PI*2) {
    const pts = Array.from({length:81}, (_,i) => {
      const a = start + arc*i/80;
      return new T.Vector3(Math.cos(a)*radius,y,Math.sin(a)*radius);
    });
    line(pts,colour,.75,group);
  }
  const grid = new T.GridHelper(16,32,0x296276,0x163b49);
  grid.position.y = -.62;
  scene.add(grid);
  const shapes = [new T.IcosahedronGeometry(.42,1),new T.IcosahedronGeometry(.47,0),
    new T.SphereGeometry(.58,18,12),new T.OctahedronGeometry(.53),new T.TorusKnotGeometry(.29,.065,64,5),
    new T.BoxGeometry(.72,.6,.55),new T.CylinderGeometry(.39,.46,.54,6)];
  const modules = points.map((point,i) => {
    const group = new T.Group();
    group.position.copy(point);
    scene.add(group);
    const solid = new T.Mesh(shapes[i],new T.MeshBasicMaterial({color:0x102e3d}));
    const wire = new T.LineSegments(new T.WireframeGeometry(shapes[i]),new T.LineBasicMaterial({color:cyan,transparent:true,opacity:.75}));
    solid.add(wire);
    group.add(solid);
    ring(group,i===2?.99:.63,-.32,cyan);
    ring(group,i===2?.91:.57,-.23,cyan,.4,4.8);
    if(i===2) {
      for(let n=0;n<4;n++) ring(group,1.16,-.4,gold,n*Math.PI/2,1.05);
      const orbit = new T.Group();
      orbit.rotation.z = .95;
      group.add(orbit);
      ring(orbit,.84,0,gold);
    }
    return {solid,wire};
  });
  const paths = points.slice(1).map((end,i) => {
    const start = points[i];
    const mid = start.clone().lerp(end,.5);
    mid.y += .26;
    const curve = new T.QuadraticBezierCurve3(start,mid,end);
    line(curve.getPoints(44),cyan,.62);
    const packet = new T.Mesh(new T.SphereGeometry(.075,8,8),new T.MeshBasicMaterial({color:gold}));
    scene.add(packet);
    return {curve,packet};
  });
  let angle = 0, time = 0, last = 0, frame = 0, visible = true;
  let moving = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  function draw() {
    const w = field.clientWidth, h = field.clientHeight;
    if (!w || !h) return;
    const halfWidth = Math.max(5.8, 3.7*w/h);
    camera.left = -halfWidth; camera.right = halfWidth;
    camera.top = halfWidth*h/w; camera.bottom = -camera.top;
    camera.position.set(10*Math.sin(angle),8.6,10*Math.cos(angle));
    camera.lookAt(0,0,.12);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    modules.forEach(({solid,wire},i) => {
      solid.rotation.y = time*.17;
      wire.material.color.setHex(i===selected ? gold : cyan);
      const p = points[i].clone();
      p.y -= i===2 ? .92 : .72;
      p.project(camera);
      buttons[i].style.left = (p.x+1)*50+'%';
      buttons[i].style.top = (1-p.y)*50+'%';
    });
    paths.forEach(({curve,packet},i) => curve.getPoint((time*.42+i*.16)%1,packet.position));
    renderer.render(scene,camera);
  }
  redraw = draw;
  function tick(now) {
    frame = 0;
    if (!visible || document.hidden || !moving) return;
    if (last) time += Math.min((now-last)/1000,.06);
    last = now;
    draw();
    frame = requestAnimationFrame(tick);
  }
  function schedule() {
    cancelAnimationFrame(frame);
    last = 0;
    frame = requestAnimationFrame(tick);
  }
  function motionLabel() {el('motion').textContent = moving ? 'Pause motion' : 'Play motion';}
  motionLabel();
  el('motion').onclick = () => {moving = !moving; motionLabel(); schedule();};
  el('reset').onclick = () => {angle = 0; select(2);};
  el('hint').textContent = 'Drag to orbit · Select a stage';
  let origin;
  const canvas = renderer.domElement;
  canvas.onpointerdown = e => {origin = [e.clientX,angle]; canvas.setPointerCapture(e.pointerId);};
  canvas.onpointermove = e => {
    if (origin) {angle = origin[1]+(e.clientX-origin[0])*.007; draw();}
  };
  canvas.onlostpointercapture = () => {origin = null;};
  function resize() {renderer.setSize(field.clientWidth,field.clientHeight); draw();}
  new ResizeObserver(resize).observe(field);
  new IntersectionObserver(([entry]) => {visible = entry.isIntersecting; schedule();}).observe(field);
  document.addEventListener('visibilitychange',schedule);
  canvas.addEventListener('webglcontextlost', () => {moving=false; schedule(); canvas.hidden=true; redraw=()=>{}; fallback();});
  resize();
  schedule();
})();
