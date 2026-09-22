'use strict';
const vscode = require('vscode');
const path = require('node:path');
const fs = require('node:fs');
const {normalize, read, workerEvent, deliverOnce} = require('./core');
const ROOT = 'D:/trading-agent-dashboard-codex';

function activate(context) {
  const output = vscode.window.createOutputChannel('Agent mailbox');
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 20);
  status.command = 'tradingMailbox.status'; status.text = '$(mail) Mailbox off';
  let bound = null, busy = false, lastError = '';
  function health(state, detail) {
    const worker = findWorker();
    if (!worker) return;
    const dir = path.join(ROOT, '.local/orchestration/connections');
    fs.mkdirSync(dir, {recursive:true});
    const file = path.join(dir, worker.id + '.json');
    const temp = file + '.' + process.pid + '.tmp';
    fs.writeFileSync(temp, JSON.stringify({worker_id:worker.id, state, detail,
      extension_version:'0.2.0', updated_at:new Date().toISOString()}, null, 2)+'\n');
    fs.renameSync(temp, file);
  }
  function findWorker() {
    const first = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!first || !vscode.workspace.isTrusted) return null;
    const register = read(path.join(ROOT,'docs/orchestration/projects.json'));
    return register.workers.find(w => normalize(w.path) === normalize(first));
  }
  async function tick() {
    if (!bound || busy || !vscode.workspace.isTrusted) return;
    busy = true;
    try {
      const worker = findWorker();
      if (!worker || worker.id !== bound) throw new Error('Workspace changed; disconnect and reconnect');
      const api = vscode.extensions.getExtension('saoudrizwan.claude-dev');
      if (!api?.isActive || typeof api.exports?.sendMessage !== 'function') throw new Error('Cline is not active or its sendMessage API is unavailable');
      const {createMailbox} = require(path.join(ROOT,'scripts/coordination.js'));
      const scan = createMailbox(ROOT).check(worker.id);
      const event = workerEvent(ROOT, worker, scan);
      if (!event) { status.text = '$(mail) Mailbox watching'; lastError=''; health('watching','Connected; no worker wake due'); return; }
      const directory = path.join(ROOT,'.local/orchestration/dispatch',worker.id);
      const record = await deliverOnce(directory, event, prompt => api.exports.sendMessage(prompt));
      status.text = record.state === 'sent_unconfirmed' ? '$(mail) Sent; awaiting pickup' : '$(warning) Check mailbox delivery';
      status.tooltip = `${worker.id}: ${record.state}. Cline does not provide a delivery receipt. Worker activity confirms pickup.`;
      health(record.state, event.key);
    } catch(e) { status.text='$(warning) Mailbox held'; status.tooltip=e.message; if(lastError!==e.message)output.appendLine(e.message);lastError=e.message; try { health('held',e.message); } catch {} }
    finally { busy=false; }
  }
  async function connect(manual) {
    const worker=findWorker();
    if(!worker) return;
    try {
      const api=vscode.extensions.getExtension('saoudrizwan.claude-dev');
      if(!api) throw new Error('Cline is not installed');
      await api.activate();
      if(typeof api.exports?.sendMessage!=='function') throw new Error('Cline has no compatible sendMessage API');
      if(manual) await context.workspaceState.update('mailboxBinding',worker.id);
      bound=worker.id;status.show();health('connected','Dedicated worker workspace connected');
      output.appendLine(`Connected ${bound}. Keep its existing Cline task open; disconnect before switching tasks.`);
      await tick();
    } catch(e) {lastError=e.message;status.text='$(warning) Mailbox held';output.appendLine(e.message);health('held',e.message);}
  }
  context.subscriptions.push(output,status,
    vscode.commands.registerCommand('tradingMailbox.connect', async()=>{
      const worker=findWorker();
      if(!worker) return vscode.window.showErrorMessage('Open the registered worker checkout as the first workspace folder.');
      await connect(true);
    }),
    vscode.commands.registerCommand('tradingMailbox.disconnect',async()=>{bound=null;await context.workspaceState.update('mailboxBinding',false);status.text='$(mail) Mailbox off';health('disconnected','Explicitly disconnected; automatic reconnection disabled');}),
    vscode.commands.registerCommand('tradingMailbox.status',()=>{output.appendLine(bound?`Watching ${bound}; delivery records: ${ROOT}/.local/orchestration/dispatch/${bound}`:'Not connected in this window.');output.show();})
  );
  const timer=setInterval(tick,5000);context.subscriptions.push({dispose:()=>clearInterval(timer)});
  const worker=findWorker();
  if(worker) {
    status.show();
    const saved=context.workspaceState.get('mailboxBinding');
    if(saved===worker.id || (saved===undefined && worker.mailbox_auto_connect===true)) return connect(false);
    health('disconnected','Use Mailbox: Connect This Cline Worker');
  }
}
module.exports={activate};
