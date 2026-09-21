'use strict';
const vscode = require('vscode');
const path = require('node:path');
const {normalize, read, workerEvent, deliverOnce} = require('./core');
const ROOT = 'D:/trading-agent-dashboard-codex';

function activate(context) {
  const output = vscode.window.createOutputChannel('Agent mailbox');
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 20);
  status.command = 'tradingMailbox.status'; status.text = '$(mail) Mailbox off';
  let bound = null, busy = false, lastError = '';
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
      if (!event) { status.text = '$(mail) Mailbox watching'; lastError=''; return; }
      const directory = path.join(ROOT,'.local/orchestration/dispatch',worker.id);
      const record = await deliverOnce(directory, event, prompt => api.exports.sendMessage(prompt));
      status.text = record.state === 'sent_unconfirmed' ? '$(mail) Sent; awaiting pickup' : '$(warning) Check mailbox delivery';
      status.tooltip = `${worker.id}: ${record.state}. Cline does not provide a delivery receipt. Worker activity confirms pickup.`;
    } catch(e) { status.text='$(warning) Mailbox held'; status.tooltip=e.message; if(lastError!==e.message)output.appendLine(e.message);lastError=e.message; }
    finally { busy=false; }
  }
  context.subscriptions.push(output,status,
    vscode.commands.registerCommand('tradingMailbox.connect', async()=>{
      const worker=findWorker();
      if(!worker) return vscode.window.showErrorMessage('Open the registered worker checkout as the first workspace folder.');
      // Explicit per-window binding; never create/replace an existing Cline task.
      const api=vscode.extensions.getExtension('saoudrizwan.claude-dev');
      if(!api) return vscode.window.showErrorMessage('Cline is not installed.');
      await api.activate();
      if(typeof api.exports?.sendMessage!=='function') return vscode.window.showErrorMessage('This Cline version has no compatible sendMessage API.');
      bound=worker.id; status.show(); output.appendLine(`Bound ${bound}. Keep this window dedicated to its current Cline task. Disconnect before switching tasks. Binding expires on window reload.`);
      vscode.window.showInformationMessage(`Mailbox connected for ${bound}. Keep its existing Cline task open; disconnect before switching tasks.`);
      await tick();
    }),
    vscode.commands.registerCommand('tradingMailbox.disconnect',()=>{bound=null;status.text='$(mail) Mailbox off';}),
    vscode.commands.registerCommand('tradingMailbox.status',()=>{output.appendLine(bound?`Watching ${bound}; delivery records: ${ROOT}/.local/orchestration/dispatch/${bound}`:'Not connected in this window.');output.show();})
  );
  const timer=setInterval(tick,5000);context.subscriptions.push({dispose:()=>clearInterval(timer)});
  if(findWorker()) status.show();
}
module.exports={activate};
