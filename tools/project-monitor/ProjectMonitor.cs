using System;
using System.IO;
using System.Linq;
using System.Drawing;
using System.Diagnostics;
using System.Collections.Generic;
using System.ComponentModel;
using System.Threading;
using System.Text;
using System.Runtime.InteropServices;
using System.Drawing.Drawing2D;
using System.Web.Script.Serialization;
using System.Windows.Forms;

public class Worker { public string id, state, task, assignment, next, updated_at, file, folder; public int? age_minutes; }
public class Update { public string id, worker, title, detail, time, file; }
public class UsageProject { public string provider, project; public long input, output, cached, total; }
public class UsageCoverage { public string source, status; public int records; }
public class Usage { public string day, timezone, scanned_at, latest_record, scope, note; public long input, output, cached, total; public int records; public UsageProject[] projects; public UsageCoverage[] coverage; public string[] errors; }
public class Snapshot { public string scanned_at, controller; public int pending; public string[] errors; public Worker[] workers; public Update[] events; public Usage usage; }
public class Preferences { public bool pin = true, alerts = true; public int x = -1, y = -1; public string[] seen = new string[0]; }

public class MonitorPanel : Form {
    readonly string root, node, storage, smoke;
    readonly JavaScriptSerializer json = new JavaScriptSerializer { MaxJsonLength = 2097152 };
    readonly Color background = Color.FromArgb(23,32,28), foreground = Color.FromArgb(225,238,231), muted = Color.FromArgb(137,164,149);
    readonly Label summary = new Label(), status = new Label(), usageTotal = new Label(), usageDetail = new Label();
    Usage currentUsage;
    [DllImport("user32.dll")] static extern bool ReleaseCapture();
    [DllImport("user32.dll")] static extern IntPtr SendMessage(IntPtr hWnd,int msg,IntPtr wParam,IntPtr lParam);
    void Drag(object sender,MouseEventArgs e){if(e.Button==MouseButtons.Left){ReleaseCapture();SendMessage(Handle,0xA1,(IntPtr)2,IntPtr.Zero);}}
    void Round(){if(Width<20||Height<20)return;using(var shape=new GraphicsPath()){int d=20;shape.AddArc(0,0,d,d,180,90);shape.AddArc(Width-d,0,d,d,270,90);shape.AddArc(Width-d,Height-d,d,d,0,90);shape.AddArc(0,Height-d,d,d,90,90);shape.CloseFigure();var old=Region;Region=new Region(shape);if(old!=null)old.Dispose();}}
    readonly ListBox list = new ListBox();
    readonly CheckBox pin = new CheckBox(), alerts = new CheckBox();
    readonly NotifyIcon tray = new NotifyIcon();
    readonly System.Windows.Forms.Timer timer = new System.Windows.Forms.Timer();
    readonly BackgroundWorker scanner = new BackgroundWorker();
    Preferences prefs = new Preferences();
    HashSet<string> seen = new HashSet<string>();
    bool initialized, quitting;
    int scans;

    public MonitorPanel(string projectRoot, string nodePath, string smokeOutput) {
        root=projectRoot; node=nodePath; smoke=smokeOutput; storage=Path.Combine(root,".local","project-monitor");
        Directory.CreateDirectory(storage);
        if(smoke==null) try { if(File.Exists(Path.Combine(storage,"preferences.json"))) prefs=json.Deserialize<Preferences>(File.ReadAllText(Path.Combine(storage,"preferences.json"))); } catch { }
        seen=new HashSet<string>(prefs.seen??new string[0]); initialized=seen.Count>0;
        Text="Project Monitor"; Icon=SystemIcons.Application; BackColor=background; ForeColor=foreground;
        Font=new Font("Segoe UI",8.5f); AutoScaleMode=AutoScaleMode.Dpi; FormBorderStyle=FormBorderStyle.None; Padding=new Padding(1);
        ClientSize=new Size(354,548); MinimumSize=new Size(324,440); TopMost=prefs.pin;
        StartPosition=FormStartPosition.Manual;
        var area=Screen.PrimaryScreen.WorkingArea;
        Location=new Point(prefs.x<0?area.Right-Width-20:prefs.x,prefs.y<0?area.Top+30:prefs.y);
        if(!Screen.AllScreens.Any(s=>s.WorkingArea.IntersectsWith(Bounds))) Location=new Point(area.Right-Width-20,area.Top+30);
        var heading=new Panel { Dock=DockStyle.Top, Height=52, Padding=new Padding(12,8,12,4) };
        var title=new Label { Text="", Dock=DockStyle.Top, Height=0 };
        summary.Dock=DockStyle.Fill; summary.ForeColor=muted; summary.Text="Reading coordination files...";
        heading.Controls.Add(summary); heading.Controls.Add(title);
        var buttons=new FlowLayoutPanel { Dock=DockStyle.Bottom, Height=34, Padding=new Padding(8,2,0,0), WrapContents=false };
        pin.Text="Pin"; pin.Checked=prefs.pin; pin.AutoSize=true; pin.Margin=new Padding(4,7,5,0);
        alerts.Text="Alerts"; alerts.Checked=prefs.alerts; alerts.AutoSize=true; alerts.Margin=new Padding(3,7,5,0);
        pin.CheckedChanged+=(s,e)=>{TopMost=pin.Checked;Save();}; alerts.CheckedChanged+=(s,e)=>Save();
        buttons.Controls.Add(alerts);
        buttons.Controls.Add(Button("Details",(s,e)=>Details())); buttons.Controls.Add(Button("Refresh",(s,e)=>Scan()));
        status.Dock=DockStyle.Bottom; status.Height=26; status.Padding=new Padding(12,4,12,2); status.ForeColor=muted; status.AutoEllipsis=true;
        list.Dock=DockStyle.Fill; list.BackColor=background; list.ForeColor=foreground; list.BorderStyle=BorderStyle.None;
        list.DrawMode=DrawMode.OwnerDrawFixed; list.ItemHeight=56; list.IntegralHeight=false;
        list.DrawItem+=DrawWorker; list.DoubleClick+=(s,e)=>Details();
        list.KeyDown+=(s,e)=>{if(e.KeyCode==Keys.Enter) Details();};
        var usagePanel=new Panel {Dock=DockStyle.Bottom,Height=116,Padding=new Padding(12,8,12,6),BackColor=Color.FromArgb(29,44,36)};
        var usageTitle=new Label {Text="TOKEN USAGE   \u00b7   TODAY",Dock=DockStyle.Top,Height=20,ForeColor=muted,Font=new Font("Segoe UI",8,FontStyle.Bold)};
        usageTotal.Dock=DockStyle.Top;usageTotal.Height=25;usageTotal.Text="Reading local usage...";usageTotal.Font=new Font("Segoe UI",13,FontStyle.Bold);
        usageDetail.Dock=DockStyle.Fill;usageDetail.ForeColor=muted;usageDetail.Cursor=Cursors.Hand;usageTotal.Cursor=Cursors.Hand;
        usageDetail.Click+=(s,e)=>UsageDetails();usageTotal.Click+=(s,e)=>UsageDetails();
        usagePanel.Controls.Add(usageDetail);usagePanel.Controls.Add(usageTotal);usagePanel.Controls.Add(usageTitle);
        var chrome=new Panel {Dock=DockStyle.Top,Height=32,BackColor=Color.FromArgb(27,41,33)};
        var caption=new Label {Text="\u22ee  Project monitor",Dock=DockStyle.Fill,Padding=new Padding(12,7,0,0),ForeColor=muted};caption.MouseDown+=Drag;chrome.MouseDown+=Drag;
        var close=Button("\u00d7",(s,e)=>{Hide();Save();});close.Dock=DockStyle.Right;close.Width=30;close.AutoSize=false;close.FlatAppearance.BorderSize=0;
        var minimize=Button("\u2212",(s,e)=>{Hide();Save();});minimize.Dock=DockStyle.Right;minimize.Width=30;minimize.AutoSize=false;minimize.FlatAppearance.BorderSize=0;
        pin.Appearance=Appearance.Button;pin.FlatStyle=FlatStyle.Flat;pin.FlatAppearance.BorderSize=0;pin.FlatAppearance.CheckedBackColor=Color.FromArgb(39,78,56);pin.ForeColor=Color.FromArgb(135,204,166);pin.Text="Pin";pin.TextAlign=ContentAlignment.MiddleCenter;pin.AutoSize=false;pin.Dock=DockStyle.Right;pin.Width=36;pin.BackColor=Color.FromArgb(35,62,47);
        chrome.Controls.Add(caption);chrome.Controls.Add(pin);chrome.Controls.Add(minimize);chrome.Controls.Add(close);
        Controls.Add(list);Controls.Add(usagePanel);Controls.Add(status);Controls.Add(buttons);Controls.Add(heading);Controls.Add(chrome);
        SizeChanged+=(s,e)=>Round();Round();
        tray.Icon=SystemIcons.Application; tray.Text="Project Monitor"; tray.Visible=smoke==null;
        tray.DoubleClick+=(s,e)=>ShowPanel(); tray.BalloonTipClicked+=(s,e)=>ShowPanel();
        var menu=new ContextMenuStrip(); menu.Items.Add("Show monitor",null,(s,e)=>ShowPanel());
        menu.Items.Add("Open coordination folder",null,(s,e)=>OpenFile(Path.Combine(root,"docs","orchestration")));
        menu.Items.Add("Exit",null,(s,e)=>{quitting=true;Close();}); tray.ContextMenuStrip=menu;
        FormClosing+=(s,e)=>{if(!quitting&&e.CloseReason==CloseReason.UserClosing){e.Cancel=true;Hide();Save();}else{Save();tray.Dispose();timer.Stop();}};
        Resize+=(s,e)=>{if(WindowState==FormWindowState.Minimized)Hide();list.Invalidate();};
        scanner.DoWork+=(s,e)=>e.Result=ReadSnapshot();
        scanner.RunWorkerCompleted+=Scanned;
        timer.Interval=5000; timer.Tick+=(s,e)=>Scan(); timer.Start();
        Shown+=(s,e)=>Scan();
    }
    Button Button(string text, EventHandler click) { var b=new Button {Text=text,AutoSize=true,FlatStyle=FlatStyle.Flat,BackColor=Color.FromArgb(37,61,47),ForeColor=Color.FromArgb(166,216,185)};b.FlatAppearance.BorderColor=Color.FromArgb(53,81,62);b.Click+=click;return b; }
    void ShowPanel(){Show();WindowState=FormWindowState.Normal;Activate();}
    protected override void WndProc(ref Message message){
        base.WndProc(ref message);
        if(message.Msg==0x84&&message.Result==(IntPtr)1){long packed=message.LParam.ToInt64();var p=PointToClient(new Point((short)(packed&65535),(short)((packed>>16)&65535)));if(p.X>=ClientSize.Width-8&&p.Y>=ClientSize.Height-8)message.Result=(IntPtr)17;}
    }
    void Scan(){if(!scanner.IsBusy)scanner.RunWorkerAsync();}
    Snapshot ReadSnapshot(){
        var info=new ProcessStartInfo(node,"\""+Path.Combine(root,"scripts","monitor-state.js")+"\" snapshot") { UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true,StandardOutputEncoding=Encoding.UTF8,StandardErrorEncoding=Encoding.UTF8,WorkingDirectory=root };
        using(var process=Process.Start(info)){
            var output=process.StandardOutput.ReadToEndAsync(); var errors=process.StandardError.ReadToEndAsync();
            if(!process.WaitForExit(8000)){process.Kill();throw new Exception("Coordination scan timed out");}
            if(process.ExitCode!=0)throw new Exception(errors.Result.Trim());
            return json.Deserialize<Snapshot>(output.Result);
        }
    }
    void Scanned(object sender,RunWorkerCompletedEventArgs e){
        if(IsDisposed)return;
        if(e.Error!=null){status.Text="SCAN FAILED · last display may be stale\n"+e.Error.Message;status.ForeColor=Color.Salmon;if(smoke!=null)FinishSmoke(null,e.Error.Message);return;}
        var data=(Snapshot)e.Result; scans++; currentUsage=data.usage;
        if(currentUsage!=null){usageTotal.Text=currentUsage.records==0?"No usage recorded today":Compact(currentUsage.total)+" tokens";usageDetail.Text="Input "+Compact(currentUsage.input)+"  \u00b7  Output "+Compact(currentUsage.output)+"\nIncludes "+Compact(currentUsage.cached)+" cached \u00b7 local projects\n"+(currentUsage.errors.Length>0?"Partial coverage \u00b7 click for details":"Updates ~30s \u00b7 click for project breakdown");}
        string selected=list.SelectedItem is Worker?((Worker)list.SelectedItem).id:null;
        list.BeginUpdate();list.Items.Clear();foreach(var w in data.workers)list.Items.Add(w);
        for(int i=0;i<list.Items.Count;i++)if(((Worker)list.Items[i]).id==selected)list.SelectedIndex=i;
        if(list.SelectedIndex<0&&list.Items.Count>0)list.SelectedIndex=0;list.EndUpdate();
        summary.Text=data.pending+" awaiting review \u00b7 "+data.workers.Length+" projects\nAutomatic dispatch: not configured";
        status.ForeColor=data.errors.Length>0?Color.Salmon:muted;
        status.Text=data.errors.Length>0?"DATA NEEDS ATTENTION · "+data.errors[0]:"\u25cf Watching \u00b7 "+DateTime.Now.ToString("HH:mm:ss")+" \u00b7 refresh 5s";
        var fresh=data.events.Where(x=>!seen.Contains(x.id)).ToArray();
        if(initialized&&alerts.Checked&&fresh.Length>0&&smoke==null){
            var last=fresh.Last();tray.BalloonTipTitle=fresh.Length==1?last.worker+": "+last.title:fresh.Length+" project updates";
            tray.BalloonTipText=(last.detail.Length>180?last.detail.Substring(0,177)+"...":last.detail);tray.ShowBalloonTip(5000);
        }
        foreach(var item in data.events)seen.Add(item.id);initialized=true;Save();
        if(smoke!=null)FinishSmoke(data,null);
    }
    void DrawWorker(object sender,DrawItemEventArgs e){
        if(e.Index<0)return;var w=(Worker)list.Items[e.Index];
        using(var fill=new SolidBrush((e.State&DrawItemState.Selected)!=0?Color.FromArgb(36,55,43):background))e.Graphics.FillRectangle(fill,e.Bounds);
        var x=e.Bounds.X+12;var width=e.Bounds.Width-24;var y=e.Bounds.Y+4;
        var format=new StringFormat { Trimming=StringTrimming.EllipsisCharacter,FormatFlags=StringFormatFlags.NoWrap };
        using(var bold=new Font(Font,FontStyle.Bold))using(var fg=new SolidBrush(foreground))using(var secondary=new SolidBrush(muted)){
            e.Graphics.DrawString(w.id,bold,fg,new RectangleF(x,y,width,20),format);
            Color tone=w.state.StartsWith("Working")?Color.FromArgb(100,214,178):w.state.Contains("Blocked")||w.state.Contains("changes")?Color.FromArgb(239,188,110):muted;
            using(var brush=new SolidBrush(tone))e.Graphics.DrawString(w.state+" · "+(w.age_minutes.HasValue?w.age_minutes+"m ago":"no heartbeat"),Font,brush,new RectangleF(x,y+17,width,16),format);
            e.Graphics.DrawString(w.task,Font,secondary,new RectangleF(x,y+33,width,17),format);
        }
        using(var pen=new Pen(Color.FromArgb(48,68,55)))e.Graphics.DrawLine(pen,x,e.Bounds.Bottom-1,e.Bounds.Right-12,e.Bounds.Bottom-1);
        e.DrawFocusRectangle();
    }
    static string Compact(long n){return n>=1000000?(n/1000000d).ToString("0.00")+"M":n>=1000?(n/1000d).ToString("0.0")+"k":n.ToString();}
    void UsageDetails(){if(currentUsage==null)return;var u=currentUsage;var text=new StringBuilder();text.AppendLine(u.scope+" ? "+u.day+" ("+u.timezone+")");text.AppendLine("Checked: "+u.scanned_at);text.AppendLine("Latest recorded usage: "+(u.latest_record??"None today"));text.AppendLine();foreach(var p in u.projects){text.AppendLine(p.provider+" ? "+p.project);text.AppendLine("Total "+p.total.ToString("N0")+" | Input "+p.input.ToString("N0")+" | Output "+p.output.ToString("N0")+" | Cached "+p.cached.ToString("N0"));text.AppendLine();}foreach(var c in u.coverage)text.AppendLine(c.source+": "+c.status);foreach(var e in u.errors)text.AppendLine("Coverage warning: "+e);text.AppendLine();text.AppendLine(u.note);using(var dialog=new Form{Text="Recorded token usage",ClientSize=new Size(640,450),StartPosition=FormStartPosition.CenterParent,TopMost=TopMost,BackColor=background,Padding=new Padding(12)}){dialog.Controls.Add(new TextBox{Multiline=true,ReadOnly=true,ScrollBars=ScrollBars.Both,WordWrap=true,Dock=DockStyle.Fill,BackColor=background,ForeColor=foreground,Font=Font,Text=text.ToString()});dialog.ShowDialog(this);}}
    void Details(){
        var w=list.SelectedItem as Worker;if(w==null)return;
        using(var dialog=new Form {Text=w.id+" · project details",ClientSize=new Size(590,420),MinimumSize=new Size(360,300),StartPosition=FormStartPosition.CenterParent,BackColor=background,ForeColor=foreground,TopMost=TopMost}){
            var text=new TextBox {Multiline=true,ReadOnly=true,ScrollBars=ScrollBars.Vertical,Dock=DockStyle.Fill,BackColor=background,ForeColor=foreground,Font=Font,BorderStyle=BorderStyle.None};
            text.Text=w.id+Environment.NewLine+w.state+Environment.NewLine+"Assignment: "+w.assignment+Environment.NewLine+"Last update: "+(w.updated_at??"None")+Environment.NewLine+Environment.NewLine+w.task+Environment.NewLine+Environment.NewLine+"Next / assigned scope:"+Environment.NewLine+w.next;
            var open=Button("Open report / assignment",(s,e)=>OpenFile(w.file));open.Dock=DockStyle.Bottom;open.Height=36;
            dialog.Padding=new Padding(12);dialog.Controls.Add(text);dialog.Controls.Add(open);dialog.ShowDialog(this);
        }
    }
    void OpenFile(string file){try{Process.Start(new ProcessStartInfo(file){UseShellExecute=true});}catch(Exception e){MessageBox.Show(this,e.Message,"Could not open file");}}
    void Save(){if(smoke!=null)return;try{prefs.pin=pin.Checked;prefs.alerts=alerts.Checked;prefs.x=Location.X;prefs.y=Location.Y;prefs.seen=seen.Reverse().Take(500).ToArray();File.WriteAllText(Path.Combine(storage,"preferences.json"),json.Serialize(prefs));}catch{}}
    void FinishSmoke(Snapshot data,string error){
        BeginInvoke((Action)(()=>{using(var bitmap=new Bitmap(Width,Height)){DrawToBitmap(bitmap,new Rectangle(0,0,Width,Height));bitmap.Save(smoke+".png");}
            Size normal=Size;Size=MinimumSize;PerformLayout();using(var narrow=new Bitmap(Width,Height)){DrawToBitmap(narrow,new Rectangle(0,0,Width,Height));narrow.Save(smoke+"-narrow.png");}
            pin.Checked=false;bool unpinned=!TopMost;pin.Checked=true;
            File.WriteAllText(smoke+".json",json.Serialize(new {workers=data==null?0:data.workers.Length,scans=scans,pin=TopMost,unpinWorks=unpinned,error=error,width=normal.Width,height=normal.Height,narrowWidth=Width,narrowHeight=Height}));quitting=true;Close();}));
    }
    [STAThread] public static void Main(string[] args){
        if(args.Length<2)return;bool created;
        using(var mutex=new Mutex(true,"Local\\TradingProjectMonitor"+(args.Length>2?"Smoke":""),out created)){
            using(var show=new EventWaitHandle(false,EventResetMode.AutoReset,"Local\\TradingProjectMonitorShow"+(args.Length>2?"Smoke":""))){
                if(!created){show.Set();return;}
                Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
                var panel=new MonitorPanel(Path.GetFullPath(args[0]),args[1],args.Length>3&&args[2]=="--smoke"?args[3]:null);
                var registration=ThreadPool.RegisterWaitForSingleObject(show,(s,t)=>{if(panel.IsHandleCreated&&!panel.IsDisposed)panel.BeginInvoke((Action)(()=>panel.ShowPanel()));},null,-1,false);
                try{Application.Run(panel);}finally{registration.Unregister(null);}
            }
        }
    }
}
